"use client";

import { useState } from "react";
import { useAccess } from "@/modules/access/access-context";
import { Button, Card, DemoNotice, ReadOnlyNotice, Drawer, Field, PageHeader, Table, Toggle, inputCls, td, th } from "@/shared/ui";
import { formatMoney } from "@/shared/format";
import { deliveryZones as seed, type DeliveryZone } from "@/shared/demo/fixtures";

type Draft = { id: string; name: string; fee: string; min: string; eta: string };

export default function DeliveryPage() {
  const manage = useAccess().canManage("delivery");
  const [zones, setZones] = useState<DeliveryZone[]>(seed);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});

  function edit(z: DeliveryZone) {
    setErr({});
    setDraft({ id: z.id, name: z.name, fee: String(z.feeMinor / 100), min: String(z.minOrderMinor / 100), eta: String(z.etaMinutes) });
  }
  function save() {
    if (!draft) return;
    const e: Record<string, string> = {};
    const fee = parseFloat(draft.fee), min = parseFloat(draft.min), eta = parseInt(draft.eta, 10);
    if (!(fee >= 0)) e.fee = "Enter a fee of 0 or more.";
    if (!(min >= 0)) e.min = "Enter an amount of 0 or more.";
    if (!(eta > 0)) e.eta = "Enter the minutes it takes, above 0.";
    setErr(e);
    if (Object.keys(e).length) return;
    setZones(zones.map((z) => (z.id === draft.id ? { ...z, feeMinor: Math.round(fee * 100), minOrderMinor: Math.round(min * 100), etaMinutes: eta } : z)));
    setDraft(null);
  }
  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <>
      <PageHeader title="Delivery" description="Where you deliver, what it costs, and the smallest order each area can place." />
      {!manage && <ReadOnlyNotice />}
      <DemoNotice />
      <Card>
        <Table>
          <thead><tr><th className={th}>Area</th><th className={th}>Postal codes</th><th className={`${th} text-right`}>Fee</th><th className={`${th} text-right`}>Minimum order</th><th className={`${th} text-right`}>Time</th><th className={th}>Delivering</th><th className={th}><span className="sr-only">Edit</span></th></tr></thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id}>
                <td className={`${td} font-medium`}>{z.name}</td>
                <td className={`${td} num`}>{z.postalCodes}</td>
                <td className={`${td} num text-right`}>{formatMoney(z.feeMinor)}</td>
                <td className={`${td} num text-right`}>{formatMoney(z.minOrderMinor)}</td>
                <td className={`${td} num text-right`}>{z.etaMinutes} min</td>
                <td className={td}><Toggle disabled={!manage} label={`Deliver to ${z.name}`} checked={z.isActive} onChange={(v) => setZones(zones.map((x) => (x.id === z.id ? { ...x, isActive: v } : x)))} /></td>
                <td className={`${td} text-right`}>{manage && <Button variant="secondary" size="sm" onClick={() => edit(z)}>Edit<span className="sr-only"> {z.name}</span></Button>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Drawer open={!!draft} onClose={() => setDraft(null)} title={draft ? `Edit ${draft.name}` : ""} footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save}>Save changes</Button></>}>
        {draft && (
          <div className="space-y-4">
            <Field label="Delivery fee (₹)" error={err.fee}>{(id) => <input id={id} inputMode="decimal" value={draft.fee} onChange={(e) => set({ fee: e.target.value })} className={`${inputCls} num`} />}</Field>
            <Field label="Minimum order (₹)" error={err.min}>{(id) => <input id={id} inputMode="decimal" value={draft.min} onChange={(e) => set({ min: e.target.value })} className={`${inputCls} num`} />}</Field>
            <Field label="Estimated time (minutes)" error={err.eta}>{(id) => <input id={id} inputMode="numeric" value={draft.eta} onChange={(e) => set({ eta: e.target.value })} className={`${inputCls} num`} />}</Field>
          </div>
        )}
      </Drawer>
    </>
  );
}
