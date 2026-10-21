"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Card, Drawer, EmptyState, ErrorState, Field, Pill, Toggle, inputCls } from "@/shared/ui";
import { ApiError, adminApi, type GroupDetail, type OptionGroupSummary, type OptionInput } from "./admin-client";
import { centsToInput, parseEuro } from "./money";

const messageOf = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const FORM_ID = "group-form";

interface OptionRowState {
  id?: string;
  name: string;
  price: string;
  is_active: boolean;
}

/**
 * The shared library of choices and extras. A group is defined once ("Nudelsorte", "Extra Zutaten") and then used by many items
 * or whole categories. Prices by size are set where a group is used (the item or category), not here: here an extra only has
 * its own price, which applies when nothing more specific is set.
 */
export function OptionLibrary({ manage, onChanged }: { manage: boolean; onChanged: () => void }) {
  const [groups, setGroups] = useState<OptionGroupSummary[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [editing, setEditing] = useState<{ id: string } | "new" | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    adminApi.groups.list().then(
      (g) => { if (live) { setGroups(g); setLoadError(""); } },
      (e) => { if (live) setLoadError(messageOf(e, "Could not load the groups.")); },
    );
    return () => { live = false; };
  }, [reloadToken]);

  const reload = () => { setReloadToken((t) => t + 1); onChanged(); };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-ink-2">Groups of choices and extras that items and categories can use, such as pasta types, dressings or pizza toppings.</p>
        {manage && <Button onClick={() => setEditing("new")}><Plus className="size-4" aria-hidden /> New group</Button>}
      </div>
      <div role="status" aria-live="polite" className="mb-3 min-h-5 text-sm font-medium text-success">{notice}</div>
      {loadError ? <ErrorState title="That didn’t work" body={loadError} onRetry={() => { setLoadError(""); setReloadToken((t) => t + 1); }} />
        : groups === null ? <Card><p className="px-5 py-8 text-ink-2" role="status">Loading groups…</p></Card>
        : groups.length === 0 ? <Card><EmptyState title="No groups yet" body="Create a group such as Pasta type, then attach it to a category or an item." /></Card>
        : (
          <Card>
            <ul className="divide-y divide-line">
              {groups.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="text-xs text-ink-2">{g.option_count} option{g.option_count === 1 ? "" : "s"} · used in {g.attachment_count} place{g.attachment_count === 1 ? "" : "s"}</p>
                  </div>
                  <Pill tone="neutral">{g.kind === "extra" ? "Extra (costs money)" : "Free choice"}</Pill>
                  {!g.is_active && <Pill tone="warning">Hidden</Pill>}
                  {manage && <Button variant="secondary" size="sm" aria-label={`Edit ${g.name}`} onClick={() => setEditing({ id: g.id })}><Pencil className="size-4" aria-hidden /> Edit</Button>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      {editing && (
        <GroupEditor
          key={editing === "new" ? "new" : editing.id}
          groupId={editing === "new" ? null : editing.id}
          used={groups?.find((g) => editing !== "new" && g.id === editing.id)?.attachment_count ?? 0}
          onClose={() => setEditing(null)}
          onSaved={(message) => { setEditing(null); setNotice(message); reload(); }}
        />
      )}
    </>
  );
}

function GroupEditor({ groupId, used, onClose, onSaved }: { groupId: string | null; used: number; onClose: () => void; onSaved: (message: string) => void }) {
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    let live = true;
    adminApi.groups.get(groupId).then(
      (g) => { if (live) setDetail(g); },
      (e) => { if (live) setLoadError(messageOf(e, "Could not load this group.")); },
    );
    return () => { live = false; };
  }, [groupId]);

  const ready = groupId === null || detail !== null;
  return (
    <Drawer
      open
      onClose={() => { if (!saving) onClose(); }}
      title={groupId ? "Edit group" : "New group"}
      footer={<>
        <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button type="submit" form={FORM_ID} loading={saving} disabled={!ready}>{groupId ? "Save changes" : "Create group"}</Button>
      </>}
    >
      {loadError ? <p role="alert" className="text-sm text-error">{loadError}</p> : !ready ? <p className="text-ink-2" role="status">Loading…</p> : (
        <GroupForm detail={detail} used={used} onBusy={setSaving} onSaved={onSaved} onDeleted={(m) => onSaved(m)} />
      )}
    </Drawer>
  );
}

function GroupForm({ detail, used, onBusy, onSaved, onDeleted }: { detail: GroupDetail | null; used: number; onBusy: (b: boolean) => void; onSaved: (m: string) => void; onDeleted: (m: string) => void }) {
  const editing = detail !== null;
  const [name, setName] = useState(detail?.name ?? "");
  const [kind, setKind] = useState<"extra" | "choice">(detail?.kind ?? "choice");
  const [min, setMin] = useState(String(detail?.min_select ?? 1));
  const [max, setMax] = useState(String(detail?.max_select ?? 1));
  const [required, setRequired] = useState(detail?.is_required ?? true);
  const [isActive, setIsActive] = useState(detail?.is_active ?? true);
  const [rows, setRows] = useState<OptionRowState[]>(
    detail ? detail.options.map((o) => ({ id: o.id, name: o.name, price: centsToInput(o.default_price_minor), is_active: o.is_active })) : [{ name: "", price: "", is_active: true }],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const setWorking = (b: boolean) => { setBusy(b); onBusy(b); };

  const setRow = (i: number, patch: Partial<OptionRowState>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    const minN = Number(min), maxN = Number(max);
    if (!name.trim()) found.name = "Enter a name.";
    if (!Number.isInteger(minN) || minN < 0 || minN > 50) found.min = "Use a whole number from 0 to 50.";
    if (!Number.isInteger(maxN) || maxN < 1 || maxN > 50) found.max = "Use a whole number from 1 to 50.";
    if (!found.min && !found.max && maxN < minN) found.max = "The maximum cannot be below the minimum.";
    if (required && !found.min && minN < 1) found.min = "A required group needs a minimum of at least 1.";

    const options: OptionInput[] = [];
    const rowFound: Record<number, string> = {};
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      if (r.name.trim() === "" && r.price.trim() === "" && !r.id) return; // an untouched spare row
      if (!r.name.trim()) return void (rowFound[i] = "Name this option.");
      if (seen.has(r.name.trim().toLowerCase())) return void (rowFound[i] = "Two options have the same name.");
      seen.add(r.name.trim().toLowerCase());
      const cents = kind === "extra" ? (r.price.trim() === "" ? 0 : parseEuro(r.price)) : 0;
      if (cents === null) return void (rowFound[i] = "Enter a price like 1,00.");
      options.push({ ...(r.id ? { id: r.id } : {}), name: r.name.trim(), default_price_minor: cents, is_active: r.is_active });
    });
    if (options.length === 0) rowFound[-1] = "Add at least one option.";
    setErrors(found);
    setRowErrors(rowFound);
    if (Object.keys(found).length > 0 || Object.keys(rowFound).length > 0) return;

    setError("");
    setWorking(true);
    try {
      let id: string;
      if (editing) {
        await adminApi.groups.update(detail.id, { name: name.trim(), min_select: minN, max_select: maxN, is_required: required, is_active: isActive });
        id = detail.id;
      } else {
        id = (await adminApi.groups.create({ name: name.trim(), kind, min_select: minN, max_select: maxN, is_required: required, is_active: isActive })).id;
      }
      await adminApi.groups.replaceOptions(id, options);
      onSaved(editing ? `Saved ${name.trim()}.` : `Created ${name.trim()}.`);
    } catch (err) {
      setError(messageOf(err, "Could not save. Please try again."));
      setWorking(false);
    }
  }

  async function remove() {
    if (!detail) return;
    setWorking(true);
    try {
      await adminApi.groups.remove(detail.id);
      onDeleted(`Deleted ${detail.name}.`);
    } catch (err) {
      setError(messageOf(err, "Could not delete. Please try again."));
      setConfirmingDelete(false);
      setWorking(false);
    }
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-5">
      {error && <p role="alert" className="rounded-control border border-error/30 bg-error-soft px-3 py-2 text-sm text-error">{error}</p>}
      <Field label="Name" error={errors.name}>{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} maxLength={120} autoFocus aria-invalid={errors.name ? true : undefined} />}</Field>

      <fieldset className="flex flex-col gap-1" disabled={editing}>
        <legend className="text-[13px] font-medium">What is it?</legend>
        <label className="flex min-h-11 items-start gap-2"><input type="radio" name="kind" className="mt-1 size-4 accent-brand" checked={kind === "choice"} onChange={() => { setKind("choice"); setRequired(true); setMin("1"); }} /><span><strong className="font-medium">Free choice</strong><br /><span className="text-xs text-ink-2">The customer picks one, like pasta type or dressing. No extra cost.</span></span></label>
        <label className="flex min-h-11 items-start gap-2"><input type="radio" name="kind" className="mt-1 size-4 accent-brand" checked={kind === "extra"} onChange={() => { setKind("extra"); setRequired(false); setMin("0"); setMax("10"); }} /><span><strong className="font-medium">Extra that costs money</strong><br /><span className="text-xs text-ink-2">Optional add-ons with a price, like toppings or dips.</span></span></label>
        {editing && <p className="text-xs text-ink-2">The type cannot be changed after a group is created. Make a new group instead.</p>}
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Customer must pick at least" error={errors.min}>{(id) => <input id={id} inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} className={`${inputCls} num`} />}</Field>
        <Field label="...and at most" error={errors.max}>{(id) => <input id={id} inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} className={`${inputCls} num`} />}</Field>
      </div>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="size-4 accent-brand" checked={required} onChange={(e) => { setRequired(e.target.checked); if (e.target.checked && Number(min) < 1) setMin("1"); }} /> Required: the customer cannot skip it</label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-medium">Options</legend>
        {rowErrors[-1] && <p role="alert" className="text-sm text-error">{rowErrors[-1]}</p>}
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={r.id ?? `new-${i}`} className={`grid items-start gap-2 ${kind === "extra" ? "grid-cols-[1fr_6.5rem_auto_auto]" : "grid-cols-[1fr_auto_auto]"}`}>
              <div>
                <label className="sr-only" htmlFor={`opt-name-${i}`}>Option {i + 1} name</label>
                <input id={`opt-name-${i}`} value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="Name" className={inputCls} maxLength={120} aria-invalid={rowErrors[i] ? true : undefined} />
                {rowErrors[i] && <p className="mt-1 text-xs text-error">{rowErrors[i]}</p>}
              </div>
              {kind === "extra" && (
                <div>
                  <label className="sr-only" htmlFor={`opt-price-${i}`}>Option {i + 1} own price in euros</label>
                  <input id={`opt-price-${i}`} inputMode="decimal" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} placeholder="0,00" className={`${inputCls} num`} />
                </div>
              )}
              <label className="flex min-h-11 items-center gap-1.5 text-xs text-ink-2"><input type="checkbox" className="size-4 accent-brand" checked={r.is_active} onChange={(e) => setRow(i, { is_active: e.target.checked })} /> Shown</label>
              <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="grid size-11 place-items-center rounded-control text-ink-2 hover:bg-error-soft hover:text-error"><Trash2 className="size-4" aria-hidden /></button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setRows([...rows, { name: "", price: "", is_active: true }])}><Plus className="size-4" aria-hidden /> Add an option</Button>
        {kind === "extra" && <p className="text-xs text-ink-2">The price here is the extra&apos;s own price. Prices that depend on size are set where the group is used.</p>}
      </fieldset>

      <div className="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2">
        <div><p className="font-medium">In use</p><p className="text-xs text-ink-2">A hidden group is not offered to customers anywhere.</p></div>
        <Toggle label="Group in use" checked={isActive} onChange={setIsActive} />
      </div>

      {editing && (
        <div className="border-t border-line pt-4">
          {confirmingDelete ? (
            <div role="alert" className="flex flex-col gap-2 rounded-control border border-error/30 bg-error-soft p-3 text-sm">
              <p className="font-medium text-error">Delete {detail.name} for good?</p>
              <div className="flex gap-2">
                <Button type="button" variant="danger" size="sm" loading={busy} onClick={() => void remove()}>Yes, delete</Button>
                <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => setConfirmingDelete(false)}>Keep it</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Button type="button" variant="danger" size="sm" className="self-start" disabled={used > 0 || busy} onClick={() => setConfirmingDelete(true)}><Trash2 className="size-4" aria-hidden /> Delete group</Button>
              {used > 0 && <p className="text-xs text-ink-2">It is used in {used} place{used === 1 ? "" : "s"}. Remove it from those first, or hide the group with the switch above.</p>}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
