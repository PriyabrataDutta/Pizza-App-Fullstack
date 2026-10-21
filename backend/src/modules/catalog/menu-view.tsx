"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Flame, ImageIcon, Leaf, Pencil, Plus, Search, Sparkles, Star } from "lucide-react";
import { useAccess } from "@/modules/access/access-context";
import { Button, Card, EmptyState, ErrorState, PageHeader, Pill, ReadOnlyNotice, Table, Toggle, inputCls, td, th } from "@/shared/ui";
import { ApiError, adminApi, type CategoryAdmin, type OptionGroupSummary, type PortionSet, type ProductSummary } from "./admin-client";
import { formatEuro } from "./money";
import { OptionLibrary } from "./option-library";
import { ProductEditor, type EditorTarget } from "./product-editor";

const PAGE = 50;
const messageOf = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

type StatusFilter = "all" | "shown" | "hidden";

/** The menu: every item with its sizes and prices, quick show/hide, and the editor. A second tab holds the shared choices and extras. */
export function MenuView() {
  const access = useAccess();
  const manage = access.canManage("menu");

  const [tab, setTab] = useState<"items" | "library">("items");
  const [categories, setCategories] = useState<CategoryAdmin[]>([]);
  const [portionSets, setPortionSets] = useState<PortionSet[]>([]);
  const [groups, setGroups] = useState<OptionGroupSummary[]>([]);
  const [items, setItems] = useState<ProductSummary[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [reloadToken, setReloadToken] = useState(0);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" }>({ text: "", tone: "ok" });
  const changes = useRef(0);
  const say = (text: string, tone: "ok" | "error" = "ok") => setNotice({ text, tone });
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  // Search waits for a short pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Categories, templates and groups change rarely: load them once, and again after the library changes.
  const [lookupToken, setLookupToken] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all([adminApi.categories.list(), adminApi.portionSets.list().catch(() => []), adminApi.groups.list().catch(() => [])]).then(
      ([c, s, g]) => { if (live) { setCategories(c); setPortionSets(s); setGroups(g); } },
      (e) => { if (live) setLoadError(messageOf(e, "Could not load the menu.")); },
    );
    return () => { live = false; };
  }, [lookupToken]);

  // The first page of items, whenever the filters change or something was saved.
  useEffect(() => {
    let live = true;
    const startedAt = changes.current;
    adminApi.products.list({ category: categoryFilter || undefined, search: search || undefined, active: status === "all" ? undefined : status === "shown", limit: PAGE }).then(
      (page) => {
        if (!live) return;
        if (changes.current !== startedAt) return reload(); // something changed while loading: fetch again
        setItems(page.items);
        setHasMore(page.has_more);
        setLoadError("");
      },
      (e) => { if (live) setLoadError(messageOf(e, "Could not load the items.")); },
    );
    return () => { live = false; };
  }, [categoryFilter, search, status, reloadToken, reload]);

  async function loadMore() {
    if (!items) return;
    setLoadingMore(true);
    try {
      const page = await adminApi.products.list({ category: categoryFilter || undefined, search: search || undefined, active: status === "all" ? undefined : status === "shown", offset: items.length, limit: PAGE });
      setItems((prev) => [...(prev ?? []), ...page.items.filter((p) => !(prev ?? []).some((x) => x.id === p.id))]);
      setHasMore(page.has_more);
    } catch (e) {
      say(messageOf(e, "Could not load more items."), "error");
    } finally {
      setLoadingMore(false);
    }
  }

  async function setShown(p: ProductSummary, value: boolean) {
    if (!items) return;
    const before = items;
    changes.current++;
    setItems(items.map((x) => (x.id === p.id ? { ...x, is_active: value } : x)));
    try {
      await adminApi.products.availability(p.id, { is_active: value });
      say(`${p.name} is now ${value ? "shown in" : "hidden from"} the app.`);
    } catch (e) {
      setItems(before);
      say(messageOf(e, `Could not change ${p.name}.`), "error");
    }
  }

  async function duplicate(p: ProductSummary) {
    try {
      const copy = await adminApi.products.duplicate(p.id);
      changes.current++;
      say(`Made a hidden copy of ${p.name}. Edit it, then switch it on.`);
      reload();
      setEditor({ mode: "edit", id: copy.product.id });
    } catch (e) {
      say(messageOf(e, `Could not copy ${p.name}.`), "error");
    }
  }

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const sortedCategories = useMemo(() => {
    const tops = categories.filter((c) => c.parent_id === null);
    return tops.flatMap((t) => [t, ...categories.filter((c) => c.parent_id === t.id)]);
  }, [categories]);

  const badges = (p: ProductSummary) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-medium">{p.name}</span>
      <Pill tone={p.diet === "veg" ? "success" : "error"}><Leaf className="size-3" aria-hidden />{p.diet === "veg" ? "Veg" : "Non-veg"}</Pill>
      {p.is_spicy && <Pill tone="warning"><Flame className="size-3" aria-hidden />Spicy</Pill>}
      {p.is_new && <Pill tone="info"><Sparkles className="size-3" aria-hidden />New</Pill>}
      {p.is_bestseller && <Pill tone="info"><Star className="size-3" aria-hidden />Popular</Pill>}
      {p.fulfillment === "pickup_only" && <Pill tone="neutral">Pickup only</Pill>}
    </div>
  );
  const thumb = (p: ProductSummary) => (
    <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-control border border-line bg-subtle text-ink-2">
      {p.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a public storage URL
        <img src={p.thumb_url ?? p.image_url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : <ImageIcon className="size-5" aria-hidden />}
    </div>
  );
  const sizesList = (p: ProductSummary) => p.portions.map((s) => (
    <span key={s.key} className={`block whitespace-nowrap text-xs ${s.is_available ? "" : "text-ink-2 line-through"}`}>
      <span className="text-ink-2">{s.label}</span> {formatEuro(s.price_minor)}{!s.is_available && <span className="no-underline"> (sold out)</span>}
    </span>
  ));
  const actions = (p: ProductSummary) => (
    <div className="flex justify-end gap-2">
      {manage && <Button variant="ghost" size="sm" aria-label={`Copy ${p.name}`} onClick={() => void duplicate(p)}><Copy className="size-4" aria-hidden /></Button>}
      <Button variant="secondary" size="sm" aria-label={`${manage ? "Edit" : "View"} ${p.name}`} onClick={() => setEditor({ mode: "edit", id: p.id })}>
        <Pencil className="size-4" aria-hidden /> {manage ? "Edit" : "View"}
      </Button>
    </div>
  );
  const shownSwitch = (p: ProductSummary) => (
    <div className="flex items-center gap-2">
      <Toggle disabled={!manage} label={`${p.name} shown in app`} checked={p.is_active} onChange={(v) => void setShown(p, v)} />
      <span className="text-xs text-ink-2">{p.is_active ? "Shown" : "Hidden"}</span>
    </div>
  );

  const tabCls = (active: boolean) => `min-h-11 rounded-control px-4 text-sm font-semibold ${active ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-subtle"}`;

  const list = () => {
    if (loadError) return <ErrorState title="That didn’t work" body={loadError} onRetry={() => { setLoadError(""); reload(); setLookupToken((t) => t + 1); }} />;
    if (items === null) return <Card><p className="px-5 py-8 text-ink-2" role="status">Loading the menu…</p></Card>;
    if (items.length === 0) {
      return <Card><EmptyState title="No items found" body={search || categoryFilter || status !== "all" ? "Try other filters, or clear the search." : "Add your first item to the menu."} action={manage && !search ? <Button onClick={() => setEditor({ mode: "create" })}><Plus className="size-4" aria-hidden /> Add item</Button> : undefined} /></Card>;
    }
    return (
      <Card>
        <div className="hidden md:block">
          <Table>
            <thead>
              <tr><th className={th}>Item</th><th className={th}>Category</th><th className={`${th} min-w-44`}>Sizes and prices</th><th className={th}>In the app</th><th className={th}><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className={p.is_active ? "" : "bg-subtle/60"}>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      {thumb(p)}
                      <div className="min-w-0">
                        {badges(p)}
                        {p.description && <p className="max-w-xs truncate text-xs text-ink-2">{p.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{categoryName.get(p.category_id) ?? "—"}</td>
                  <td className={`${td} num`}>{sizesList(p)}</td>
                  <td className={td}>{shownSwitch(p)}</td>
                  <td className={`${td} text-right`}>{actions(p)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <ul className="divide-y divide-line md:hidden">
          {items.map((p) => (
            <li key={p.id} className={`flex flex-col gap-3 px-4 py-4 ${p.is_active ? "" : "bg-subtle/60"}`}>
              <div className="flex items-start gap-3">
                {thumb(p)}
                <div className="min-w-0 flex-1">
                  {badges(p)}
                  <p className="text-xs text-ink-2">{categoryName.get(p.category_id) ?? "—"}</p>
                  {p.description && <p className="truncate text-xs text-ink-2">{p.description}</p>}
                </div>
              </div>
              <div className="num grid grid-cols-2 gap-x-4 gap-y-0.5">{sizesList(p)}</div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {shownSwitch(p)}
                {actions(p)}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-2">
          <span role="status">Showing {items.length} item{items.length === 1 ? "" : "s"}{hasMore ? ", more available" : ""}</span>
          {hasMore && <Button variant="secondary" size="sm" loading={loadingMore} onClick={() => void loadMore()}>Show more</Button>}
        </div>
      </Card>
    );
  };

  return (
    <>
      <PageHeader
        title="Menu"
        description="Items, their sizes and prices, and the choices and extras that go with them. Changes save to the database straight away."
        actions={manage && tab === "items" ? <Button onClick={() => setEditor({ mode: "create", categoryId: categoryFilter || undefined })}><Plus className="size-4" aria-hidden /> Add item</Button> : undefined}
      />
      {!manage && <ReadOnlyNotice />}

      <div role="tablist" aria-label="Menu sections" className="mb-4 flex gap-2">
        <button role="tab" aria-selected={tab === "items"} className={tabCls(tab === "items")} onClick={() => setTab("items")}>Items</button>
        <button role="tab" aria-selected={tab === "library"} className={tabCls(tab === "library")} onClick={() => setTab("library")}>Choices and extras</button>
      </div>

      <div role="status" aria-live="polite" className={`mb-3 min-h-5 text-sm font-medium ${notice.tone === "error" ? "text-error" : "text-success"}`}>{notice.text}</div>

      {tab === "library" ? (
        <OptionLibrary manage={manage} onChanged={() => setLookupToken((t) => t + 1)} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
              <label htmlFor="menu-q" className="sr-only">Search items</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-2" aria-hidden />
              <input id="menu-q" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search items" className={`${inputCls} pl-9`} />
            </div>
            <div>
              <label htmlFor="menu-cat" className="sr-only">Category</label>
              <select id="menu-cat" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputCls}>
                <option value="">All categories</option>
                {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? `   ${c.name}` : c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="menu-status" className="sr-only">Visibility</label>
              <select id="menu-status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={inputCls}>
                <option value="all">Shown and hidden</option>
                <option value="shown">Shown in the app</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>
          {list()}
        </>
      )}

      {editor && (
        <ProductEditor
          key={editor.mode === "edit" ? editor.id : "new"}
          target={editor}
          categories={categories}
          portionSets={portionSets}
          groups={groups}
          canEdit={manage}
          onChanged={(message) => { changes.current++; say(message); reload(); }}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
