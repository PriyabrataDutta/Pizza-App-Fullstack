"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAccess } from "@/modules/access/access-context";
import { Button, Card, DemoNotice, ReadOnlyNotice, Drawer, Field, PageHeader, Pill, Table, Toggle, inputCls, td, th } from "@/shared/ui";
import { formatMoney } from "@/shared/format";
import { coupons as seed, type Coupon } from "@/shared/demo/fixtures";
import { BannersView } from "@/modules/promotions/banners-view";

const blank = { code: "", type: "fixed" as Coupon["type"], value: "", min: "", expires: "" };

const tabCls = (on: boolean) => `min-h-10 rounded-[8px] px-4 text-sm font-medium ${on ? "bg-brand-soft text-brand" : "text-ink-2 hover:text-ink"}`;

/** Offers: the banners on the app's Home screen (live), and the coupon codes (still sample data). */
export default function OffersPage() {
  const [tab, setTab] = useState<"banners" | "coupons">("banners");
  return (
    <>
      <PageHeader title="Offers" description="What customers see on the app’s Home screen, and the codes they can use at checkout." />
      <div role="tablist" className="mb-4 flex gap-1">
        <button role="tab" aria-selected={tab === "banners"} className={tabCls(tab === "banners")} onClick={() => setTab("banners")}>Home banners</button>
        <button role="tab" aria-selected={tab === "coupons"} className={tabCls(tab === "coupons")} onClick={() => setTab("coupons")}>Coupons</button>
      </div>
      {tab === "banners" ? <BannersView /> : <CouponsTab />}
    </>
  );
}

function CouponsTab() {
  const manage = useAccess().canManage("offers");
  const [list, setList] = useState<Coupon[]>(seed);
  const [draft, setDraft] = useState<typeof blank | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});

  function save() {
    if (!draft) return;
    const e: Record<string, string> = {};
    const code = draft.code.trim().toUpperCase();
    const value = parseFloat(draft.value);
    if (!/^[A-Z0-9]{3,20}$/.test(code)) e.code = "Use 3–20 letters or numbers, no spaces.";
    else if (list.some((c) => c.code === code)) e.code = "This code already exists.";
    if (!(value > 0) || (draft.type === "percentage" && value > 100)) e.value = draft.type === "percentage" ? "Enter a percentage from 1 to 100." : "Enter an amount above 0.";
    if (!draft.expires) e.expires = "Pick an expiry date.";
    setErr(e);
    if (Object.keys(e).length) return;
    setList([{ id: `k${Date.now()}`, code, type: draft.type, value: draft.type === "fixed" ? Math.round(value * 100) : value, minOrderMinor: Math.round((parseFloat(draft.min) || 0) * 100), used: 0, expiresAt: draft.expires, isActive: true }, ...list]);
    setDraft(null);
  }
  const set = (p: Partial<typeof blank>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">Codes customers can apply at checkout. The server checks every code again when the order is placed.</p>
        {manage && <Button onClick={() => { setErr({}); setDraft(blank); }}><Plus className="size-4" aria-hidden /> New coupon</Button>}
      </div>
      {!manage && <ReadOnlyNotice />}
      <DemoNotice />
      <Card>
        <Table>
          <thead><tr><th className={th}>Code</th><th className={th}>Discount</th><th className={th}>Minimum order</th><th className={th}>Used</th><th className={th}>Expires</th><th className={th}>Active</th></tr></thead>
          <tbody>
            {list.map((c) => {
              const exhausted = c.usageLimit !== undefined && c.used >= c.usageLimit;
              return (
                <tr key={c.id}>
                  <td className={`${td} num font-semibold`}>{c.code}</td>
                  <td className={`${td} num`}>{c.type === "fixed" ? `${formatMoney(c.value)} off` : `${c.value}% off`}{c.maxDiscountMinor ? <span className="block text-xs text-ink-2">up to {formatMoney(c.maxDiscountMinor)}</span> : null}</td>
                  <td className={`${td} num`}>{formatMoney(c.minOrderMinor)}</td>
                  <td className={`${td} num`}>{c.used}{c.usageLimit ? ` / ${c.usageLimit}` : ""} {exhausted && <Pill tone="error">Limit reached</Pill>}</td>
                  <td className={`${td} num`}>{c.expiresAt}</td>
                  <td className={td}><Toggle disabled={!manage} label={`${c.code} active`} checked={c.isActive} onChange={(v) => setList(list.map((x) => (x.id === c.id ? { ...x, isActive: v } : x)))} /></td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Drawer open={!!draft} onClose={() => setDraft(null)} title="New coupon" footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save}>Create coupon</Button></>}>
        {draft && (
          <div className="space-y-4">
            <Field label="Code" hint="Customers type this at checkout." error={err.code}>{(id) => <input id={id} value={draft.code} onChange={(e) => set({ code: e.target.value })} className={`${inputCls} uppercase`} />}</Field>
            <Field label="Discount type">{(id) => <select id={id} value={draft.type} onChange={(e) => set({ type: e.target.value as Coupon["type"] })} className={inputCls}><option value="fixed">Fixed amount (₹)</option><option value="percentage">Percentage (%)</option></select>}</Field>
            <Field label={draft.type === "fixed" ? "Amount off (₹)" : "Percent off"} error={err.value}>{(id) => <input id={id} inputMode="decimal" value={draft.value} onChange={(e) => set({ value: e.target.value })} className={`${inputCls} num`} />}</Field>
            <Field label="Minimum order (₹)" hint="Leave empty for no minimum.">{(id) => <input id={id} inputMode="decimal" value={draft.min} onChange={(e) => set({ min: e.target.value })} className={`${inputCls} num`} />}</Field>
            <Field label="Expires on" error={err.expires}>{(id) => <input id={id} type="date" value={draft.expires} onChange={(e) => set({ expires: e.target.value })} className={inputCls} />}</Field>
          </div>
        )}
      </Drawer>
    </>
  );
}
