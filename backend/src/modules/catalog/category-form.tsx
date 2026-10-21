"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Field, Toggle, inputCls } from "@/shared/ui";
import { ApiError, adminApi, type AttachmentWithPrices, type CategoryAdmin, type GroupDetail, type OptionGroupSummary, type PortionSet } from "./admin-client";
import { ImageField } from "./image-field";
import { PriceGrid } from "./price-grid";
import { columnsFor, type PriceRow } from "./price-grid-logic";

export const CATEGORY_FORM_ID = "category-form";

interface Props {
  /** The category being edited, or null to create one. */
  category: CategoryAdmin | null;
  all: CategoryAdmin[];
  portionSets: PortionSet[];
  /** Null when the user cannot see the menu module: the choices-and-extras section is then left out. */
  groups: OptionGroupSummary[] | null;
  /** `saved` is the category as stored, so the list can show it before it reloads. */
  onSaved: (message: string, saved: CategoryAdmin) => void;
  onDeleted: (message: string, deletedId: string) => void;
  /** Lets the footer buttons reflect what the form is doing. */
  onBusy: (busy: boolean) => void;
}

/**
 * Create a category in one step, or edit one: name, size template, the choices and extras every item in it gets, a picture, and
 * whether it shows in the app. Saving a new category creates it and attaches the chosen groups.
 */
export function CategoryForm({ category, all, portionSets, groups, onSaved, onDeleted, onBusy }: Props) {
  const editing = category !== null;
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [parentId, setParentId] = useState(category?.parent_id ?? "");
  const [portionSetId, setPortionSetId] = useState(category?.default_portion_set_id ?? "");
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [image, setImage] = useState<{ path: string | null; url: string | null }>({ path: category?.image_path ?? null, url: category?.image_url ?? null });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attached, setAttached] = useState<AttachmentWithPrices[] | null>(editing ? null : []);
  const [gridGroup, setGridGroup] = useState<GroupDetail | null>(null);
  const [gridError, setGridError] = useState("");
  const [nameError, setNameError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // When editing, learn which groups already apply to every item in this category.
  useEffect(() => {
    if (!category || groups === null) return;
    let live = true;
    adminApi.attachments.forCategoryWithPrices(category.id).then(
      (items) => { if (live) { setAttached(items); setSelected(new Set(items.map((a) => a.group_id))); } },
      () => { if (live) setAttached([]); },
    );
    return () => { live = false; };
  }, [category, groups]);

  const hasChildren = editing && all.some((c) => c.parent_id === category.id);
  const parents = useMemo(() => all.filter((c) => c.parent_id === null && c.id !== category?.id), [all, category]);
  const empty = editing && category.product_count === 0 && !hasChildren;

  const setBusy = (b: boolean) => { setSaving(b); onBusy(b); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setNameError("Enter a category name.");
    setNameError("");
    setError("");
    setBusy(true);
    try {
      let saved: CategoryAdmin;
      const fields = {
        name: trimmed, description: description.trim(), parent_id: parentId || null,
        default_portion_set_id: portionSetId || null, image_path: image.path, is_active: isActive,
      };
      if (editing) {
        const patch: Partial<typeof fields> = {};
        if (fields.name !== category.name) patch.name = fields.name;
        if (fields.description !== category.description) patch.description = fields.description;
        if (fields.parent_id !== category.parent_id) patch.parent_id = fields.parent_id;
        if (fields.default_portion_set_id !== category.default_portion_set_id) patch.default_portion_set_id = fields.default_portion_set_id;
        if (fields.image_path !== category.image_path) patch.image_path = fields.image_path;
        if (fields.is_active !== category.is_active) patch.is_active = fields.is_active;
        saved = Object.keys(patch).length > 0 ? await adminApi.categories.update(category.id, patch) : category;
      } else {
        saved = await adminApi.categories.create(fields);
      }

      // Groups: attach the newly ticked ones, detach the unticked ones that were attached.
      let groupProblem = "";
      if (groups !== null && attached !== null) {
        try {
          const before = new Map(attached.map((a) => [a.group_id, a.id]));
          let order = attached.length;
          for (const id of selected) if (!before.has(id)) await adminApi.attachments.attachToCategory(saved.id, id, ++order);
          for (const [groupId, attachmentId] of before) if (!selected.has(groupId)) await adminApi.attachments.remove(attachmentId);
        } catch (err) {
          groupProblem = err instanceof ApiError ? err.message : "The choices could not be saved.";
        }
      }
      if (groupProblem) {
        setError(`${saved.name} was saved, but its choices were not: ${groupProblem}`);
        setBusy(false);
        onSaved(`Saved ${saved.name}, but not its choices.`, saved);
        return;
      }
      onSaved(editing ? `Saved ${saved.name}.` : `Added ${saved.name}.`, saved);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save. Please try again.";
      if (err instanceof ApiError && err.code === "SLUG_TAKEN") setNameError(message);
      else setError(message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!category) return;
    setBusy(true);
    setError("");
    try {
      await adminApi.categories.remove(category.id);
      onDeleted(`Deleted ${category.name}.`, category.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete. Please try again.");
      setConfirmingDelete(false);
      setBusy(false);
    }
  }

  async function openGrid(groupId: string) {
    setGridError("");
    try {
      setGridGroup(await adminApi.groups.get(groupId));
    } catch (err) {
      setGridError(err instanceof ApiError ? err.message : "Could not load the prices.");
    }
  }

  const sizesForGrid = () => (portionSets.find((s) => s.id === portionSetId)?.items ?? []).map((i) => ({ key: i.key, label: i.label }));
  const rowsOf = (a: AttachmentWithPrices | undefined): PriceRow[] => (a?.prices ?? []).map((p) => ({ option_id: p.option_id, portion_key: p.portion_key, price_minor: p.price_minor }));

  const toggleGroup = (id: string) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <form id={CATEGORY_FORM_ID} onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {error && <p role="alert" className="rounded-control border border-error/30 bg-error-soft px-3 py-2 text-sm text-error">{error}</p>}

      <Field label="Name" error={nameError}>
        {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} maxLength={120} autoFocus aria-invalid={nameError ? true : undefined} />}
      </Field>

      <Field label="Description (optional)">
        {(id) => <textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} min-h-20 py-2`} maxLength={1000} />}
      </Field>

      <ImageField kind="category" label="Picture" url={image.url} disabled={saving} onChange={(next) => setImage(next ? { path: next.path, url: next.url } : { path: null, url: null })} />

      <Field label="Size template" hint="New items in this category start with these sizes, so you only enter the prices.">
        {(id) => (
          <select id={id} value={portionSetId} onChange={(e) => setPortionSetId(e.target.value)} className={inputCls}>
            <option value="">No template</option>
            {portionSets.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.items.map((i) => i.label).join(", ")})</option>)}
          </select>
        )}
      </Field>

      <Field label="Part of" hint={hasChildren ? "This category has sub-categories, so it stays at the top level." : "Leave empty for a main category."}>
        {(id) => (
          <select id={id} value={parentId} onChange={(e) => setParentId(e.target.value)} disabled={hasChildren} className={inputCls}>
            <option value="">Nothing (main category)</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </Field>

      {groups !== null && (
        <fieldset className="flex flex-col gap-2" disabled={attached === null || saving}>
          <legend className="text-[13px] font-medium">Choices and extras for every item</legend>
          <p className="text-xs text-ink-2">Ticked groups apply to each item in this category, for example the pasta type for pasta. Prices are set per item or per size on the Menu page.</p>
          {attached === null ? <p className="text-sm text-ink-2">Loading…</p> : groups.length === 0 ? <p className="text-sm text-ink-2">No groups exist yet.</p> : (
            <ul className="flex flex-col">
              {groups.map((g) => (
                <li key={g.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-1 hover:bg-subtle">
                    <input type="checkbox" className="size-4 accent-brand" checked={selected.has(g.id)} onChange={() => toggleGroup(g.id)} />
                    <span className="flex-1">{g.name}</span>
                    <span className="text-xs text-ink-2">{g.kind === "extra" ? "Extra (costs money)" : "Free choice"} · {g.option_count} option{g.option_count === 1 ? "" : "s"}</span>
                  </label>
                  {editing && g.kind === "extra" && selected.has(g.id) && attached.some((a) => a.group_id === g.id) && (
                    <div className="pb-2 pl-8">
                      <Button type="button" size="sm" variant="secondary" onClick={() => void openGrid(g.id)}>
                        Prices by size ({attached.find((a) => a.group_id === g.id)?.prices.length ?? 0} set)
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {gridError && <p role="alert" className="text-sm text-error">{gridError}</p>}
          {gridGroup && category && (() => {
            const current = attached?.find((a) => a.group_id === gridGroup.id);
            return (
              <div className="mt-2 rounded-control border border-line p-3">
                <p className="mb-2 font-medium">{gridGroup.name}: price by size, for every item in {category.name}</p>
                <PriceGrid
                  options={gridGroup.options}
                  columns={columnsFor(sizesForGrid(), rowsOf(current))}
                  initial={rowsOf(current)}
                  onCancel={() => setGridGroup(null)}
                  onSave={async (rows) => {
                    await adminApi.attachments.set({
                      scope: "category", target_id: category.id, group_id: gridGroup.id, sort_order: current?.sort_order ?? 1,
                      default_option_id: current?.default_option_id ?? null, prices: rows,
                    });
                    setAttached(await adminApi.attachments.forCategoryWithPrices(category.id));
                    setGridGroup(null);
                  }}
                />
              </div>
            );
          })()}
        </fieldset>
      )}

      <div className="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2">
        <div>
          <p className="font-medium">Shown in the app</p>
          <p className="text-xs text-ink-2">Hidden categories and everything in them disappear from the menu.</p>
        </div>
        <Toggle label="Shown in the app" checked={isActive} onChange={setIsActive} disabled={saving} />
      </div>

      {editing && (
        <div className="border-t border-line pt-4">
          {confirmingDelete ? (
            <div role="alert" className="flex flex-col gap-2 rounded-control border border-error/30 bg-error-soft p-3 text-sm">
              <p className="font-medium text-error">Delete {category.name} for good?</p>
              <div className="flex gap-2">
                <Button type="button" variant="danger" size="sm" loading={saving} onClick={() => void remove()}>Yes, delete</Button>
                <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => setConfirmingDelete(false)}>Keep it</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Button type="button" variant="danger" size="sm" className="self-start" disabled={!empty || saving} onClick={() => setConfirmingDelete(true)}>
                <Trash2 className="size-4" aria-hidden /> Delete category
              </Button>
              {!empty && <p className="text-xs text-ink-2">{category.product_count > 0 ? `It still has ${category.product_count} item${category.product_count === 1 ? "" : "s"}. Move them first, or hide the category with the switch above.` : "It has sub-categories. Move or delete them first, or hide the category."}</p>}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
