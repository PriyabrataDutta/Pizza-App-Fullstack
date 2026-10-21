"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, ImageIcon, Pencil, Plus } from "lucide-react";
import { useAccess } from "@/modules/access/access-context";
import { Button, Card, Drawer, EmptyState, ErrorState, PageHeader, Pill, ReadOnlyNotice, Toggle } from "@/shared/ui";
import { ApiError, adminApi, type CategoryAdmin, type OptionGroupSummary, type PortionSet } from "./admin-client";
import { applyOrder, buildRows, dropOnto, moveId, sameOrder, siblingIds } from "./categories-tree";
import { CATEGORY_FORM_ID, CategoryForm } from "./category-form";

type DrawerState = { mode: "create" } | { mode: "edit"; id: string } | null;

/** Categories: the order here is the order customers see in the app. Everything saves straight to the database. */
export function CategoriesView() {
  const access = useAccess();
  const manage = access.canManage("categories");
  const canSeeGroups = access.can("menu");

  const [categories, setCategories] = useState<CategoryAdmin[] | null>(null);
  const [portionSets, setPortionSets] = useState<PortionSet[]>([]);
  const [groups, setGroups] = useState<OptionGroupSummary[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" }>({ text: "", tone: "ok" });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Bumping this reloads everything (after a save, or on "Try again").
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);
  // Counts local changes (a switch, a reorder, a save). A load that started before one of them holds older data, so it must not overwrite the screen.
  const changes = useRef(0);

  useEffect(() => {
    let live = true;
    const startedAt = changes.current;
    Promise.all([
      adminApi.categories.list(),
      adminApi.portionSets.list(),
      canSeeGroups ? adminApi.groups.list().catch(() => null) : Promise.resolve(null),
    ]).then(
      ([list, sets, groupList]) => {
        if (!live) return;
        if (changes.current !== startedAt) return reload(); // something changed meanwhile: fetch again instead of showing old data
        setCategories(list);
        setPortionSets(sets);
        setGroups(groupList);
        setLoadError("");
      },
      (e) => { if (live) setLoadError(e instanceof ApiError ? e.message : "Could not load the categories."); },
    );
    return () => { live = false; };
  }, [canSeeGroups, reloadToken, reload]);

  const rows = useMemo(() => (categories ? buildRows(categories) : []), [categories]);
  const editing = drawer?.mode === "edit" ? categories?.find((c) => c.id === drawer.id) ?? null : null;
  const say = (text: string, tone: "ok" | "error" = "ok") => setNotice({ text, tone });

  async function setShown(c: CategoryAdmin, value: boolean) {
    if (!categories) return;
    const before = categories;
    changes.current++;
    setCategories(categories.map((x) => (x.id === c.id ? { ...x, is_active: value } : x)));
    try {
      await adminApi.categories.update(c.id, { is_active: value });
      say(`${c.name} is now ${value ? "shown in" : "hidden from"} the app.`);
    } catch (e) {
      setCategories(before);
      say(e instanceof ApiError ? e.message : `Could not change ${c.name}.`, "error");
    }
  }

  /** Saves a new order for the categories that share a parent. Shows it at once and puts it back if the server refuses. */
  async function commitOrder(parentId: string | null, ids: string[]) {
    if (!categories || sameOrder(siblingIds(categories, parentId), ids)) return;
    const before = categories;
    changes.current++;
    setCategories(applyOrder(categories, ids));
    try {
      await adminApi.categories.reorder(ids);
      say("Order saved.");
    } catch (e) {
      setCategories(before);
      say(e instanceof ApiError ? e.message : "Could not save the order.", "error");
    }
  }

  const move = (c: CategoryAdmin, delta: -1 | 1) => {
    if (!categories) return;
    void commitOrder(c.parent_id, moveId(siblingIds(categories, c.parent_id), c.id, delta));
  };

  function drop(target: CategoryAdmin) {
    const dragged = categories?.find((c) => c.id === draggingId);
    setDraggingId(null);
    setOverId(null);
    if (!categories || !dragged || dragged.parent_id !== target.parent_id) return;
    void commitOrder(dragged.parent_id, dropOnto(siblingIds(categories, dragged.parent_id), dragged.id, target.id));
  }

  const closeDrawer = () => { if (!formBusy) setDrawer(null); };
  const afterDelete = (message: string, deletedId: string) => {
    setCategories((prev) => (prev ? prev.filter((c) => c.id !== deletedId) : prev));
    afterChange(message);
  };

  const afterChange = (message: string, saved?: CategoryAdmin) => {
    changes.current++;
    setDrawer(null);
    setFormBusy(false);
    say(message);
    // Show the saved category right away; the reload that follows brings the counts and order up to date.
    if (saved) setCategories((prev) => (prev ? (prev.some((c) => c.id === saved.id) ? prev.map((c) => (c.id === saved.id ? { ...c, ...saved } : c)) : [...prev, { ...saved, product_count: 0 }]) : prev));
    reload();
  };

  const body = () => {
    if (loadError) return <ErrorState title="That didn’t work" body={loadError} onRetry={() => { setLoadError(""); reload(); }} />;
    if (categories === null) return <Card><p className="px-5 py-8 text-ink-2" role="status">Loading categories…</p></Card>;
    if (categories.length === 0) {
      return <Card><EmptyState title="No categories yet" body="Add your first category, such as Pizza or Drinks, then add items to it." action={manage ? <Button onClick={() => setDrawer({ mode: "create" })}><Plus className="size-4" aria-hidden /> New category</Button> : undefined} /></Card>;
    }
    return (
      <Card>
        <ul className="divide-y divide-line">
          {rows.map(({ category: c, depth, hiddenByParent }) => {
            const siblings = siblingIds(categories, c.parent_id);
            const index = siblings.indexOf(c.id);
            const droppable = draggingId !== null && draggingId !== c.id && categories.find((x) => x.id === draggingId)?.parent_id === c.parent_id;
            return (
              <li
                key={c.id}
                draggable={manage}
                onDragStart={(e) => { setDraggingId(c.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.id); }}
                onDragEnd={() => { setDraggingId(null); setOverId(null); }}
                onDragOver={(e) => { if (droppable) { e.preventDefault(); setOverId(c.id); } }}
                onDragLeave={() => setOverId((cur) => (cur === c.id ? null : cur))}
                onDrop={(e) => { e.preventDefault(); drop(c); }}
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5 ${depth === 1 ? "pl-8 sm:pl-12" : ""} ${overId === c.id ? "bg-brand-soft" : ""} ${draggingId === c.id ? "opacity-50" : ""}`}
              >
                {manage && (
                  <div className="order-5 flex items-center sm:order-none">
                    <span aria-hidden className="hidden cursor-grab text-ink-2 sm:block"><GripVertical className="size-4" /></span>
                    <button aria-label={`Move ${c.name} up`} disabled={index === 0} onClick={() => move(c, -1)} className="grid size-11 place-items-center rounded-control text-ink-2 hover:bg-subtle disabled:opacity-30"><ArrowUp className="size-4" aria-hidden /></button>
                    <button aria-label={`Move ${c.name} down`} disabled={index === siblings.length - 1} onClick={() => move(c, 1)} className="grid size-11 place-items-center rounded-control text-ink-2 hover:bg-subtle disabled:opacity-30"><ArrowDown className="size-4" aria-hidden /></button>
                  </div>
                )}
                <div className="order-1 grid size-12 shrink-0 place-items-center overflow-hidden rounded-control border border-line bg-subtle text-ink-2 sm:order-none">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a public storage URL
                    <img src={c.image_url} alt="" className="size-full object-cover" />
                  ) : <ImageIcon className="size-5" aria-hidden />}
                </div>
                <div className="order-2 min-w-0 flex-1 sm:order-none">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="num text-xs text-ink-2">
                    {c.product_count} item{c.product_count === 1 ? "" : "s"}
                    {depth === 1 && " · sub-category"}
                  </p>
                </div>
                {hiddenByParent && c.is_active && <span className="order-3 sm:order-none"><Pill tone="warning">Hidden with its parent</Pill></span>}
                <span className="hidden text-xs text-ink-2 sm:inline">{c.is_active ? "Shown" : "Hidden"}</span>
                <span className="order-3 sm:order-none"><Toggle disabled={!manage} label={`${c.name} shown in app`} checked={c.is_active} onChange={(v) => void setShown(c, v)} /></span>
                <span aria-hidden className="order-4 h-0 basis-full sm:hidden" />
                {manage && (
                  <Button variant="secondary" size="sm" className="order-5 ml-auto sm:order-none sm:ml-0" onClick={() => setDrawer({ mode: "edit", id: c.id })} aria-label={`Edit ${c.name}`}>
                    <Pencil className="size-4" aria-hidden /> Edit
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title="Categories"
        description="The order here is the order customers see in the app. Drag a row, or use the arrows."
        actions={manage ? <Button onClick={() => setDrawer({ mode: "create" })}><Plus className="size-4" aria-hidden /> New category</Button> : undefined}
      />
      {!manage && <ReadOnlyNotice />}
      <div role="status" aria-live="polite" className={`mb-3 min-h-5 text-sm font-medium ${notice.tone === "error" ? "text-error" : "text-success"}`}>{notice.text}</div>
      {body()}

      <Drawer
        open={drawer !== null && (drawer.mode === "create" || editing !== null)}
        onClose={closeDrawer}
        title={drawer?.mode === "edit" ? "Edit category" : "New category"}
        footer={
          <>
            <Button type="button" variant="secondary" disabled={formBusy} onClick={closeDrawer}>Cancel</Button>
            <Button type="submit" form={CATEGORY_FORM_ID} loading={formBusy}>{drawer?.mode === "edit" ? "Save changes" : "Add category"}</Button>
          </>
        }
      >
        {drawer && categories && (
          <CategoryForm
            key={drawer.mode === "edit" ? drawer.id : "new"}
            category={editing}
            all={categories}
            portionSets={portionSets}
            groups={groups}
            onBusy={setFormBusy}
            onSaved={afterChange}
            onDeleted={afterDelete}
          />
        )}
      </Drawer>
    </>
  );
}
