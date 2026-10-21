"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Pill, inputCls } from "@/shared/ui";
import { ApiError, adminApi, type AttachmentWithPrices, type GroupDetail, type OptionGroupSummary, type ProductDetail } from "./admin-client";
import { PriceGrid } from "./price-grid";
import { columnsFor, type PriceRow } from "./price-grid-logic";

const messageOf = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/**
 * The extras and choices of one item. A group can reach an item two ways: from its category (shared by every item in it) or set on
 * the item itself. "Customize for this item" turns a category group into the item's own, so its prices and default can differ.
 */
export function ProductChoices({ detail, groups, canEdit, onChanged }: {
  detail: ProductDetail;
  groups: OptionGroupSummary[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const productId = detail.product.id;
  const own = detail.attachments;
  const inherited = detail.inherited_attachments.filter((a) => !own.some((o) => o.group_id === a.group_id));
  const shown = [...inherited, ...own].sort((a, b) => a.sort_order - b.sort_order);
  const used = new Set(shown.map((a) => a.group_id));
  const available = groups.filter((g) => !used.has(g.id) && g.is_active);

  const [toAdd, setToAdd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(messageOf(e, "That did not work. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const nextOrder = Math.max(0, ...shown.map((a) => a.sort_order)) + 1;

  return (
    <div className="flex flex-col gap-3">
      {error && <p role="alert" className="rounded-control border border-error/30 bg-error-soft px-3 py-2 text-sm text-error">{error}</p>}
      {shown.length === 0 && <p className="text-sm text-ink-2">No choices or extras yet. This item is ordered as it is.</p>}
      {shown.map((a) => {
        const mine = own.some((o) => o.id === a.id);
        const summary = groups.find((g) => g.id === a.group_id);
        return (
          <GroupCard
            key={a.id}
            attachment={a}
            summary={summary}
            mine={mine}
            productId={productId}
            detail={detail}
            canEdit={canEdit && !busy}
            run={run}
          />
        );
      })}

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="add-group" className="text-[13px] font-medium">Add choices or extras</label>
            <select id="add-group" value={toAdd} onChange={(e) => setToAdd(e.target.value)} className={`${inputCls} mt-1.5`} disabled={available.length === 0}>
              <option value="">{available.length === 0 ? "Every group is already used" : "Pick a group"}</option>
              {available.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.kind === "extra" ? "extra" : "free choice"})</option>)}
            </select>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={!toAdd || busy}
            onClick={() => void run(async () => {
              await adminApi.attachments.set({ scope: "product", target_id: productId, group_id: toAdd, sort_order: nextOrder, default_option_id: null });
              setToAdd("");
            })}
          >
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </div>
      )}
    </div>
  );
}

function GroupCard({ attachment, summary, mine, productId, detail, canEdit, run }: {
  attachment: AttachmentWithPrices;
  summary: OptionGroupSummary | undefined;
  mine: boolean;
  productId: string;
  detail: ProductDetail;
  canEdit: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editingPrices, setEditingPrices] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    let live = true;
    adminApi.groups.get(attachment.group_id).then(
      (g) => { if (live) setGroup(g); },
      (e) => { if (live) setLoadError(messageOf(e, "Could not load this group.")); },
    );
    return () => { live = false; };
  }, [attachment.group_id]);

  const categoryAttachment = detail.inherited_attachments.find((a) => a.group_id === attachment.group_id);
  const sizes = detail.portions.map((p) => ({ key: p.key, label: p.label }));
  const priceRows = (a: AttachmentWithPrices | undefined): PriceRow[] => (a?.prices ?? []).map((p) => ({ option_id: p.option_id, portion_key: p.portion_key, price_minor: p.price_minor }));
  const base = { scope: "product" as const, target_id: productId, group_id: attachment.group_id, sort_order: attachment.sort_order };

  return (
    <div className="rounded-control border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{summary?.name ?? group?.name ?? "Group"}</p>
        <Pill tone="neutral">{(summary?.kind ?? group?.kind) === "extra" ? "Extra (costs money)" : "Free choice"}</Pill>
        <Pill tone={mine ? "info" : "neutral"}>{mine ? "Set on this item" : "From the category"}</Pill>
        <div className="ml-auto flex gap-2">
          {canEdit && !mine && (
            <Button type="button" size="sm" variant="secondary" onClick={() => void run(() => adminApi.attachments.set({ ...base, default_option_id: attachment.default_option_id }))}>
              Customize for this item
            </Button>
          )}
          {canEdit && mine && !confirmRemove && (
            <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${summary?.name ?? "group"} from this item`} onClick={() => setConfirmRemove(true)}>
              <Trash2 className="size-4" aria-hidden /> Remove
            </Button>
          )}
        </div>
      </div>

      {confirmRemove && (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-control bg-error-soft p-2 text-sm text-error">
          <span>Remove it from this item? {categoryAttachment ? "The category's version will apply again." : ""}</span>
          <Button type="button" size="sm" variant="danger" onClick={() => void run(() => adminApi.attachments.remove(attachment.id))}>Yes, remove</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmRemove(false)}>Keep</Button>
        </div>
      )}

      {loadError && <p role="alert" className="mt-2 text-sm text-error">{loadError}</p>}
      {!group && !loadError && <p className="mt-2 text-sm text-ink-2">Loading…</p>}

      {group && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-ink-2">
            {group.options.filter((o) => o.is_active).length} options · choose {group.min_select === group.max_select ? group.min_select : `${group.min_select} to ${group.max_select}`}
            {group.is_required ? " (required)" : " (optional)"}
          </p>

          {group.kind === "choice" && mine && (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor={`default-${attachment.id}`} className="text-[13px] font-medium">Comes with</label>
              <select
                id={`default-${attachment.id}`}
                value={attachment.default_option_id ?? ""}
                disabled={!canEdit}
                onChange={(e) => void run(() => adminApi.attachments.set({ ...base, default_option_id: e.target.value || null }))}
                className={`${inputCls} max-w-xs`}
              >
                <option value="">No preselected option</option>
                {group.options.filter((o) => o.is_active).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          {group.kind === "choice" && !mine && attachment.default_option_id && (
            <p className="text-sm">Comes with: {group.options.find((o) => o.id === attachment.default_option_id)?.name ?? "—"}</p>
          )}

          {group.kind === "extra" && mine && !editingPrices && (
            <div>
              <Button type="button" size="sm" variant="secondary" disabled={!canEdit} onClick={() => setEditingPrices(true)}>
                Prices by size{attachment.prices.length > 0 ? ` (${attachment.prices.length} set)` : ""}
              </Button>
              {attachment.prices.length === 0 && <span className="ml-2 text-xs text-ink-2">{categoryAttachment ? "Using the category's prices." : "Using each extra's own price."}</span>}
            </div>
          )}
          {group.kind === "extra" && mine && editingPrices && (
            <PriceGrid
              options={group.options}
              columns={columnsFor(sizes, priceRows(attachment))}
              initial={priceRows(attachment)}
              inherited={priceRows(categoryAttachment)}
              onCancel={() => setEditingPrices(false)}
              onSave={async (rows) => {
                await adminApi.attachments.set({ ...base, default_option_id: attachment.default_option_id, prices: rows });
                setEditingPrices(false);
                await run(async () => undefined);
              }}
            />
          )}
          {group.kind === "extra" && !mine && (
            <p className="text-xs text-ink-2">Prices come from the category. Customize this group to set prices for this item only.</p>
          )}
        </div>
      )}
    </div>
  );
}
