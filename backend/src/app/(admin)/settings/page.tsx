"use client";

import { useState } from "react";
import { useAccess } from "@/modules/access/access-context";
import { Button, Card, DemoNotice, ReadOnlyNotice, Field, PageHeader, inputCls } from "@/shared/ui";

export default function SettingsPage() {
  const manage = useAccess().canManage("settings");
  const [v, setV] = useState({ name: "Crust & Co. Pizza House", phone: "022 4000 1234", tax: "5", min: "199", opens: "11:00", closes: "23:00" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof v, val: string) => { setV({ ...v, [k]: val }); setDone(false); };

  function save(e: React.FormEvent) {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!v.name.trim()) x.name = "Enter the restaurant name.";
    const tax = parseFloat(v.tax);
    if (!(tax >= 0 && tax <= 100)) x.tax = "Enter a tax rate from 0 to 100.";
    if (!(parseFloat(v.min) >= 0)) x.min = "Enter an amount of 0 or more.";
    if (v.opens >= v.closes) x.closes = "Closing time must be after opening time.";
    setErr(x);
    setDone(Object.keys(x).length === 0);
  }

  return (
    <>
      <PageHeader title="Settings" description="Restaurant details that apply to every order." />
      {!manage && <ReadOnlyNotice />}
      <DemoNotice />
      <form onSubmit={save} noValidate>
        <Card className="max-w-2xl p-5">
          <fieldset disabled={!manage} className="space-y-4">
          <Field label="Restaurant name" error={err.name}>{(id) => <input id={id} value={v.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />}</Field>
          <Field label="Phone shown to customers">{(id) => <input id={id} value={v.phone} onChange={(e) => set("phone", e.target.value)} className={`${inputCls} num`} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tax rate (%)" error={err.tax}>{(id) => <input id={id} inputMode="decimal" value={v.tax} onChange={(e) => set("tax", e.target.value)} className={`${inputCls} num`} />}</Field>
            <Field label="Minimum order (₹)" error={err.min}>{(id) => <input id={id} inputMode="decimal" value={v.min} onChange={(e) => set("min", e.target.value)} className={`${inputCls} num`} />}</Field>
            <Field label="Opens">{(id) => <input id={id} type="time" value={v.opens} onChange={(e) => set("opens", e.target.value)} className={inputCls} />}</Field>
            <Field label="Closes" error={err.closes}>{(id) => <input id={id} type="time" value={v.closes} onChange={(e) => set("closes", e.target.value)} className={inputCls} />}</Field>
          </div>
          {manage && <div className="flex items-center gap-3">
            <Button type="submit">Save settings</Button>
            <span role="status" aria-live="polite" className="text-sm font-medium text-success">{done ? "Settings saved for this demo session." : ""}</span>
          </div>}
          </fieldset>
        </Card>
      </form>
    </>
  );
}
