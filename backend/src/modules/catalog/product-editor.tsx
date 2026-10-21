"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Drawer, Field, Toggle, inputCls } from "@/shared/ui";
import { ApiError, adminApi, type CategoryAdmin, type OptionGroupSummary, type PortionSet, type ProductDetail, type ProductFields } from "./admin-client";
import { ImageField } from "./image-field";
import { checkPortions, rowsFromPortions, rowsFromTemplate, type PortionRowState } from "./portion-logic";
import { ProductChoices } from "./product-choices";

export type EditorTarget = { mode: "create"; categoryId?: string } | { mode: "edit"; id: string };

const FORM_ID = "product-form";
const messageOf = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

interface Props {
  target: EditorTarget;
  categories: CategoryAdmin[];
  portionSets: PortionSet[];
  groups: OptionGroupSummary[];
  canEdit: boolean;
  /** Called after anything is saved, so the list behind can refresh. The editor stays open. */
  onChanged: (message: string) => void;
  onClose: () => void;
}

/** Create or edit one item: details, sizes with prices, and (once it exists) its choices and extras. */
export function ProductEditor({ target, categories, portionSets, groups, canEdit, onChanged, onClose }: Props) {
  const [createdId, setCreatedId] = useState<string | null>(null);
  const editId = createdId ?? (target.mode === "edit" ? target.id : null);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [formVersion, setFormVersion] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editId) return;
    let live = true;
    adminApi.products.get(editId).then(
      (d) => { if (live) { setDetail(d); setLoadError(""); } },
      (e) => { if (live) setLoadError(messageOf(e, "Could not load this item.")); },
    );
    return () => { live = false; };
  }, [editId, reloadToken]);

  const ready = editId === null || (detail !== null && detail.product.id === editId);
  const reload = () => setReloadToken((t) => t + 1);

  function saved(next: ProductDetail, message: string) {
    setDetail(next);
    setCreatedId(next.product.id);
    setFormVersion((v) => v + 1);
    setSaving(false);
    onChanged(message);
  }

  return (
    <Drawer
      open
      wide
      onClose={() => { if (!saving) onClose(); }}
      title={editId ? "Edit item" : "New item"}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>{editId ? "Close" : "Cancel"}</Button>
          {canEdit && <Button type="submit" form={FORM_ID} loading={saving} disabled={!ready}>{editId ? "Save changes" : "Add item"}</Button>}
        </>
      }
    >
      {loadError ? (
        <p role="alert" className="rounded-control border border-error/30 bg-error-soft px-3 py-2 text-sm text-error">{loadError}</p>
      ) : !ready ? (
        <p className="text-ink-2" role="status">Loading…</p>
      ) : (
        <div className="flex flex-col gap-8">
          <ProductForm
            key={`${detail?.product.id ?? "new"}-${formVersion}`}
            detail={editId ? detail : null}
            categories={categories}
            portionSets={portionSets}
            defaultCategoryId={target.mode === "create" ? target.categoryId : undefined}
            canEdit={canEdit}
            onBusy={setSaving}
            onSaved={saved}
          />
          <section aria-labelledby="choices-heading" className="flex flex-col gap-3">
            <div>
              <h3 id="choices-heading" className="text-base font-semibold">Choices and extras</h3>
              <p className="text-xs text-ink-2">Toppings, pasta types, dressings and similar. These save as you change them.</p>
            </div>
            {detail && editId ? (
              <ProductChoices detail={detail} groups={groups} canEdit={canEdit} onChanged={reload} />
            ) : (
              <p className="rounded-control border border-line bg-subtle px-3 py-2 text-sm text-ink-2">Save the item first, then add its choices and extras here.</p>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}

function ProductForm({ detail, categories, portionSets, defaultCategoryId, canEdit, onBusy, onSaved }: {
  detail: ProductDetail | null;
  categories: CategoryAdmin[];
  portionSets: PortionSet[];
  defaultCategoryId?: string;
  canEdit: boolean;
  onBusy: (busy: boolean) => void;
  onSaved: (detail: ProductDetail, message: string) => void;
}) {
  const p = detail?.product;
  const firstCategory = defaultCategoryId ?? categories.find((c) => c.parent_id === null)?.id ?? categories[0]?.id ?? "";
  const [name, setName] = useState(p?.name ?? "");
  const [description, setDescription] = useState(p?.description ?? "");
  const [categoryId, setCategoryId] = useState(p?.category_id ?? firstCategory);
  const [diet, setDiet] = useState<"veg" | "non_veg">(p?.diet ?? "veg");
  const [isSpicy, setIsSpicy] = useState(p?.is_spicy ?? false);
  const [isNew, setIsNew] = useState(p?.is_new ?? false);
  const [isBestseller, setIsBestseller] = useState(p?.is_bestseller ?? false);
  const [fulfillment, setFulfillment] = useState<ProductFields["fulfillment"]>(p?.fulfillment ?? "delivery_and_pickup");
  const [isActive, setIsActive] = useState(p?.is_active ?? true);
  const [image, setImage] = useState<{ path: string | null; url: string | null }>({ path: p?.image_path ?? null, url: p?.image_url ?? null });
  const templateFor = (id: string) => portionSets.find((s) => s.id === categories.find((c) => c.id === id)?.default_portion_set_id);
  const [rows, setRows] = useState<PortionRowState[]>(() =>
    detail ? rowsFromPortions(detail.portions) : templateFor(firstCategory) ? rowsFromTemplate(templateFor(firstCategory)!.items) : [{ key: null, label: "Standard", price: "", available: true }],
  );
  const [rowsTouched, setRowsTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  const template = templateFor(categoryId);
  const sortedCategories = useMemo(() => {
    const tops = categories.filter((c) => c.parent_id === null);
    return tops.flatMap((t) => [t, ...categories.filter((c) => c.parent_id === t.id)]);
  }, [categories]);

  function changeCategory(id: string) {
    setCategoryId(id);
    // A new item that has not been given its own sizes yet follows the category's template.
    const t = templateFor(id);
    if (!detail && !rowsTouched) setRows(t ? rowsFromTemplate(t.items) : [{ key: null, label: "Standard", price: "", available: true }]);
  }
  const editRows = (next: PortionRowState[]) => { setRowsTouched(true); setRows(next); };
  const setRow = (i: number, patch: Partial<PortionRowState>) => editRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = "Enter a name.";
    if (!categoryId) found.category = "Pick a category.";
    const sizes = checkPortions(rows);
    setErrors(found);
    setRowErrors(sizes.errors);
    if (Object.keys(found).length > 0 || Object.keys(sizes.errors).length > 0) return;
    setError("");
    onBusy(true);
    const fields: ProductFields = {
      category_id: categoryId, name: name.trim(), description: description.trim(), image_path: image.path,
      diet, is_spicy: isSpicy, is_bestseller: isBestseller, is_new: isNew, fulfillment, is_active: isActive,
    };
    try {
      if (!detail) {
        const created = await adminApi.products.create({ ...fields, portions: sizes.payload });
        onSaved(created, `Added ${created.product.name}.`);
      } else {
        const before = detail.product;
        const patch: Partial<ProductFields> & { portions?: typeof sizes.payload } = {};
        (Object.keys(fields) as (keyof ProductFields)[]).forEach((k) => { if (fields[k] !== (before as ProductFields)[k]) (patch as Record<string, unknown>)[k] = fields[k]; });
        const same = JSON.stringify(sizes.payload) === JSON.stringify(detail.portions.map((x) => ({ key: x.key, label: x.label, price_minor: x.price_minor, is_available: x.is_available })));
        if (!same) patch.portions = sizes.payload;
        const next = Object.keys(patch).length > 0 ? await adminApi.products.update(detail.product.id, patch) : detail;
        onSaved(next, `Saved ${next.product.name}.`);
      }
    } catch (err) {
      setError(messageOf(err, "Could not save. Please try again."));
      onBusy(false);
    }
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-6">
      {error && <p role="alert" className="rounded-control border border-error/30 bg-error-soft px-3 py-2 text-sm text-error">{error}</p>}
      <fieldset disabled={!canEdit} className="flex flex-col gap-5">
        <h3 className="text-base font-semibold">Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name}>
            {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputCls} autoFocus={!detail} aria-invalid={errors.name ? true : undefined} />}
          </Field>
          <Field label="Category" error={errors.category}>
            {(id) => (
              <select id={id} value={categoryId} onChange={(e) => changeCategory(e.target.value)} className={inputCls}>
                {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? `   ${c.name}` : c.name}</option>)}
              </select>
            )}
          </Field>
        </div>
        <Field label="Description (optional)">
          {(id) => <textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className={`${inputCls} min-h-20 py-2`} />}
        </Field>
        <ImageField kind="product" label="Picture" url={image.url} disabled={!canEdit} onChange={(next) => setImage(next ? { path: next.path, url: next.url } : { path: null, url: null })} />

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-1">
            <legend className="text-[13px] font-medium">Diet</legend>
            <label className="flex min-h-11 items-center gap-2"><input type="radio" name="diet" className="size-4 accent-brand" checked={diet === "veg"} onChange={() => setDiet("veg")} /> Vegetarian</label>
            <label className="flex min-h-11 items-center gap-2"><input type="radio" name="diet" className="size-4 accent-brand" checked={diet === "non_veg"} onChange={() => setDiet("non_veg")} /> Non-vegetarian (meat or fish)</label>
          </fieldset>
          <Field label="Where it can be ordered">
            {(id) => (
              <select id={id} value={fulfillment} onChange={(e) => setFulfillment(e.target.value as ProductFields["fulfillment"])} className={inputCls}>
                <option value="delivery_and_pickup">Delivery and pickup</option>
                <option value="pickup_only">Pickup only (for example alcohol)</option>
              </select>
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-x-6">
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="size-4 accent-brand" checked={isSpicy} onChange={(e) => setIsSpicy(e.target.checked)} /> Spicy</label>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="size-4 accent-brand" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} /> Marked as new</label>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="size-4 accent-brand" checked={isBestseller} onChange={(e) => setIsBestseller(e.target.checked)} /> Popular (shown on the app&apos;s home screen)</label>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2">
          <div>
            <p className="font-medium">Shown in the app</p>
            <p className="text-xs text-ink-2">Switch off to hide it without deleting it.</p>
          </div>
          <Toggle label="Shown in the app" checked={isActive} onChange={setIsActive} />
        </div>
      </fieldset>

      <fieldset disabled={!canEdit} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Sizes and prices</h3>
          {template && (
            <Button type="button" size="sm" variant="secondary" onClick={() => editRows(rowsFromTemplate(template.items).map((r, i) => ({ ...r, price: rows[i]?.price ?? "" })))}>
              Use the category&apos;s sizes
            </Button>
          )}
        </div>
        <p className="text-xs text-ink-2">An item that comes in one size needs one row. Prices are in euros, for example 7,50. A size can be switched off when it runs out.</p>
        {rowErrors[-1] && <p role="alert" className="text-sm text-error">{rowErrors[-1]}</p>}
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-[1fr_7rem_auto_auto] items-start gap-2 sm:grid-cols-[1fr_8rem_auto_auto]">
              <div>
                <label className="sr-only" htmlFor={`size-name-${i}`}>Size {i + 1} name</label>
                <input id={`size-name-${i}`} value={r.label} onChange={(e) => setRow(i, { label: e.target.value })} placeholder="Name, e.g. Klein 28 cm" className={inputCls} maxLength={40} aria-invalid={rowErrors[i] ? true : undefined} />
                {rowErrors[i] && <p className="mt-1 text-xs text-error">{rowErrors[i]}</p>}
              </div>
              <div>
                <label className="sr-only" htmlFor={`size-price-${i}`}>Size {i + 1} price in euros</label>
                <input id={`size-price-${i}`} inputMode="decimal" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} placeholder="0,00" className={`${inputCls} num`} />
              </div>
              <label className="flex min-h-11 items-center gap-1.5 text-xs text-ink-2"><input type="checkbox" className="size-4 accent-brand" checked={r.available} onChange={(e) => setRow(i, { available: e.target.checked })} /> Available</label>
              <button type="button" aria-label={`Remove size ${i + 1}`} disabled={rows.length === 1} onClick={() => editRows(rows.filter((_, j) => j !== i))} className="grid size-11 place-items-center rounded-control text-ink-2 hover:bg-error-soft hover:text-error disabled:opacity-30">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => editRows([...rows, { key: null, label: "", price: "", available: true }])}>
          <Plus className="size-4" aria-hidden /> Add a size
        </Button>
      </fieldset>
    </form>
  );
}
