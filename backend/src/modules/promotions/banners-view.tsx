"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useAccess } from "@/modules/access/access-context";
import { adminApi, ApiError, type PromotionAdmin, type PromotionInput } from "@/modules/catalog/admin-client";
import { ImageField } from "@/modules/catalog/image-field";
import { Button, Card, Drawer, EmptyState, Field, Pill, ReadOnlyNotice, Toggle, inputCls } from "@/shared/ui";

// The offer banners on the app's Home screen: scroll sideways, in the order set here. Changes reach phones within about a minute.

const STATE_LABEL: Record<PromotionAdmin["state"], { text: string; tone: "success" | "neutral" | "info" | "warning" }> = {
  showing: { text: "Showing", tone: "success" },
  hidden: { text: "Hidden", tone: "neutral" },
  scheduled: { text: "Scheduled", tone: "info" },
  ended: { text: "Ended", tone: "warning" },
};

interface Draft {
  id: string | null;
  title: string;
  detail: string;
  coupon: string;
  image: { path: string; url: string | null } | null;
  active: boolean;
  starts: string; // "YYYY-MM-DDTHH:mm" in this browser's time, or ""
  ends: string;
}

const blank: Draft = { id: null, title: "", detail: "", coupon: "", image: null, active: true, starts: "", ends: "" };

const pad = (n: number) => String(n).padStart(2, "0");
/** An ISO time as the value of a datetime-local input (in this browser's time zone). */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);
const show = (iso: string | null) => (iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : null);

function schedule(p: PromotionAdmin) {
  if (p.starts_at && p.ends_at) return `${show(p.starts_at)} to ${show(p.ends_at)}`;
  if (p.starts_at) return `From ${show(p.starts_at)}`;
  if (p.ends_at) return `Until ${show(p.ends_at)}`;
  return "Always";
}

export function BannersView() {
  const manage = useAccess().canManage("offers");
  const [items, setItems] = useState<PromotionAdmin[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" }>({ text: "", tone: "ok" });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi.promotions.list().then(
      (list) => { if (!cancelled) setItems(list); },
      (e) => { if (!cancelled) { setItems([]); setNotice({ text: e instanceof ApiError ? e.message : "Could not load the banners. Check your connection and try again.", tone: "error" }); } },
    );
    return () => { cancelled = true; };
  }, []);

  const fail = (e: unknown, fallback: string) => setNotice({ text: e instanceof ApiError ? e.message : fallback, tone: "error" });
  const replace = (p: PromotionAdmin) => setItems((list) => (list ?? []).map((x) => (x.id === p.id ? p : x)));

  async function toggle(p: PromotionAdmin, active: boolean) {
    try { replace(await adminApi.promotions.update(p.id, { is_active: active })); setNotice({ text: "", tone: "ok" }); } catch (e) { fail(e, "Could not change the banner."); }
  }

  async function move(index: number, by: -1 | 1) {
    if (!items) return;
    const next = [...items];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next); // shown at once; the server answer replaces it
    try { setItems(await adminApi.promotions.reorder(next.map((p) => p.id))); setNotice({ text: "", tone: "ok" }); } catch (e) { fail(e, "Could not change the order."); setItems(items); }
  }

  async function remove(p: PromotionAdmin) {
    try {
      await adminApi.promotions.remove(p.id);
      setItems((list) => (list ?? []).filter((x) => x.id !== p.id));
      setConfirmDelete(null);
      setNotice({ text: `Deleted “${p.title}”.`, tone: "ok" });
    } catch (e) { fail(e, "Could not delete the banner."); }
  }

  function edit(p: PromotionAdmin | null) {
    setErrors({});
    setDraft(p ? { id: p.id, title: p.title, detail: p.detail, coupon: p.coupon_code ?? "", image: p.image_path ? { path: p.image_path, url: p.image_url } : null, active: p.is_active, starts: toLocalInput(p.starts_at), ends: toLocalInput(p.ends_at) } : blank);
  }

  async function save() {
    if (!draft) return;
    const e: Record<string, string> = {};
    if (!draft.title.trim()) e.title = "Enter a headline.";
    if (draft.title.trim().length > 80) e.title = "Keep the headline under 80 characters.";
    if (draft.detail.trim().length > 200) e.detail = "Keep the detail under 200 characters.";
    if (draft.coupon.trim() && !/^[A-Za-z0-9_-]{3,30}$/.test(draft.coupon.trim())) e.coupon = "Use 3 to 30 letters or numbers, no spaces.";
    if (draft.starts && draft.ends && new Date(draft.ends) <= new Date(draft.starts)) e.ends = "The end must be after the start.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const body: PromotionInput = {
      title: draft.title.trim(), detail: draft.detail.trim(), coupon_code: draft.coupon.trim() ? draft.coupon.trim().toUpperCase() : null,
      image_path: draft.image?.path ?? null, is_active: draft.active, starts_at: toIso(draft.starts), ends_at: toIso(draft.ends),
    };
    setBusy(true);
    try {
      if (draft.id) replace(await adminApi.promotions.update(draft.id, body));
      else { const created = await adminApi.promotions.create(body); setItems((list) => [...(list ?? []), created]); }
      setDraft(null);
      setNotice({ text: "Saved. Phones show the change within about a minute.", tone: "ok" });
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : "Could not save. Check your connection and try again." });
    } finally { setBusy(false); }
  }

  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">The cards that scroll sideways at the top of the app’s Home screen. Use a wide picture (2:1, for example 1200 × 600) under 1 MB; the headline and detail are shown over it.</p>
        {manage && <Button onClick={() => edit(null)}><Plus className="size-4" aria-hidden /> New banner</Button>}
      </div>
      {!manage && <ReadOnlyNotice />}
      <div role="status" aria-live="polite" className={`mb-3 min-h-5 text-sm font-medium ${notice.tone === "error" ? "text-error" : "text-success"}`}>{notice.text}</div>

      {items === null ? <p className="text-sm text-ink-2">Loading…</p> : items.length === 0 ? (
        <Card><EmptyState title="No banners yet" body="The Home screen shows no offer cards until you add one." action={manage ? <Button onClick={() => edit(null)}><Plus className="size-4" aria-hidden /> New banner</Button> : undefined} /></Card>
      ) : (
        <ul className="space-y-3">
          {items.map((p, i) => (
            <li key={p.id}>
              <Card className="flex flex-wrap items-center gap-4 p-3">
                <div className="relative h-20 w-40 shrink-0 overflow-hidden rounded-control bg-gradient-to-r from-[#8e1b12] to-[#c5301f]">
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- a public storage URL; no need for the image optimizer
                    <img src={p.image_url} alt="" className="absolute inset-0 size-full object-cover" />
                  )}
                  <span className="absolute inset-0 bg-black/30" aria-hidden />
                  <span className="absolute inset-x-2 bottom-2 line-clamp-2 text-xs font-semibold text-white">{p.title}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">{p.title}</h3>
                    <Pill tone={STATE_LABEL[p.state].tone}>{STATE_LABEL[p.state].text}</Pill>
                    {p.coupon_code && <span className="num rounded bg-subtle px-2 py-0.5 text-xs font-medium">Code {p.coupon_code}</span>}
                  </div>
                  {p.detail && <p className="mt-1 line-clamp-2 text-sm text-ink-2">{p.detail}</p>}
                  <p className="mt-1 text-xs text-ink-2">{schedule(p)}</p>
                </div>
                {manage && (
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label={`Move ${p.title} earlier`} disabled={i === 0} onClick={() => void move(i, -1)} className="rounded p-2 text-ink-2 hover:bg-line/40 disabled:opacity-30"><ArrowUp className="size-4" aria-hidden /></button>
                    <button type="button" aria-label={`Move ${p.title} later`} disabled={i === items.length - 1} onClick={() => void move(i, 1)} className="rounded p-2 text-ink-2 hover:bg-line/40 disabled:opacity-30"><ArrowDown className="size-4" aria-hidden /></button>
                    <Toggle checked={p.is_active} onChange={(v) => void toggle(p, v)} label={`${p.title} shown`} />
                    <button type="button" aria-label={`Edit ${p.title}`} onClick={() => edit(p)} className="rounded p-2 text-ink-2 hover:bg-line/40"><Pencil className="size-4" aria-hidden /></button>
                    {confirmDelete === p.id ? (
                      <span className="flex items-center gap-1">
                        <Button variant="danger" size="sm" onClick={() => void remove(p)}>Delete</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>Keep</Button>
                      </span>
                    ) : (
                      <button type="button" aria-label={`Delete ${p.title}`} onClick={() => setConfirmDelete(p.id)} className="rounded p-2 text-ink-2 hover:bg-line/40 hover:text-error"><Trash2 className="size-4" aria-hidden /></button>
                    )}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit banner" : "New banner"}
        footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={() => void save()} loading={busy}>Save banner</Button></>}
      >
        {draft && (
          <div className="space-y-4">
            {errors.form && <p role="alert" className="text-sm text-error">{errors.form}</p>}
            <ImageField kind="promotion" label="Picture (optional)" url={draft.image?.url ?? null} onChange={(img) => set({ image: img })} />
            <Field label="Headline" error={errors.title}>{(id) => <input id={id} value={draft.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} className={inputCls} placeholder="Angebot 1 · 25 €" />}</Field>
            <Field label="Detail" hint="One or two lines under the headline." error={errors.detail}>{(id) => <textarea id={id} value={draft.detail} maxLength={200} rows={3} onChange={(e) => set({ detail: e.target.value })} className={inputCls} />}</Field>
            <Field label="Coupon code to show (optional)" hint="Shown on the banner. The server still checks the code when an order is placed." error={errors.coupon}>{(id) => <input id={id} value={draft.coupon} onChange={(e) => set({ coupon: e.target.value })} className={`${inputCls} uppercase`} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Show from (optional)">{(id) => <input id={id} type="datetime-local" value={draft.starts} onChange={(e) => set({ starts: e.target.value })} className={inputCls} />}</Field>
              <Field label="Show until (optional)" error={errors.ends}>{(id) => <input id={id} type="datetime-local" value={draft.ends} onChange={(e) => set({ ends: e.target.value })} className={inputCls} />}</Field>
            </div>
            <label className="flex items-center gap-3 text-sm"><Toggle checked={draft.active} onChange={(v) => set({ active: v })} label="Show this banner" /> Show this banner in the app</label>
          </div>
        )}
      </Drawer>
    </>
  );
}
