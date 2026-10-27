"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAccess } from "@/modules/access/access-context";
import { adminApi, ApiError, type OpeningHourInput, type RestaurantSettingsAdmin } from "@/modules/catalog/admin-client";
import { Button, Card, Field, PageHeader, Pill, ReadOnlyNotice, Toggle, inputCls } from "@/shared/ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Ordering controls: the on/off switch, the message customers see, extra kitchen minutes, whether a name and phone are required, and
 * the weekly opening hours. Saved to the server and audited; the customer app and checkout follow within about ten seconds.
 */
export default function SettingsPage() {
  const manage = useAccess().canManage("settings");
  const [saved, setSaved] = useState<RestaurantSettingsAdmin | null>(null);
  const [form, setForm] = useState<RestaurantSettingsAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminApi.settings.get().then(
      (s) => { if (!cancelled) { setSaved(s); setForm(s); } },
      (e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : "Could not load the settings. Check your connection and try again."); },
    );
    return () => { cancelled = true; };
  }, []);

  if (!form || !saved) {
    return (
      <>
        <PageHeader title="Settings" description="Ordering controls for the restaurant." />
        {error ? <p role="alert" className="text-sm text-error">{error}</p> : <p className="text-sm text-ink-2">Loading…</p>}
      </>
    );
  }

  const set = <K extends keyof RestaurantSettingsAdmin>(k: K, v: RestaurantSettingsAdmin[K]) => { setForm({ ...form, [k]: v }); setDone(false); };
  const setHour = (i: number, patch: Partial<OpeningHourInput>) => set("opening_hours", form.opening_hours.map((h, n) => (n === i ? { ...h, ...patch } : h)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const s = await adminApi.settings.update({
        accepting_orders: form.accepting_orders,
        closed_message: form.closed_message,
        extra_prep_minutes: Number(form.extra_prep_minutes) || 0,
        enforce_opening_hours: form.enforce_opening_hours,
        require_contact_details: form.require_contact_details,
        opening_hours: form.opening_hours,
      });
      setSaved(s);
      setForm(s);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  return (
    <>
      <PageHeader title="Settings" description="Ordering controls for the restaurant. Changes reach the app within about ten seconds." />
      {!manage && <ReadOnlyNotice />}
      <form onSubmit={save} noValidate>
        <div className="max-w-2xl space-y-4">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Taking orders</h2>
                <p className="mt-1 text-sm text-ink-2">Turn off to stop new orders at once, for example when the kitchen is full.</p>
              </div>
              <Toggle checked={form.accepting_orders} onChange={(v) => set("accepting_orders", v)} label="Taking orders" disabled={!manage} />
            </div>
            <div className="mt-3">
              {saved.open_now
                ? <Pill tone="success">Open for orders now</Pill>
                : <Pill tone="error">{saved.closed_reason === "outside_hours" ? "Closed: outside opening hours" : "Closed: ordering is switched off"}</Pill>}
            </div>
            <fieldset disabled={!manage} className="mt-4 space-y-4">
              <Field label="Message shown to customers when closed" hint="Leave empty for the standard message.">
                {(id) => <input id={id} value={form.closed_message} maxLength={200} onChange={(e) => set("closed_message", e.target.value)} className={inputCls} />}
              </Field>
              <Field label="Extra preparation time (minutes)" hint="Added to every delivery estimate while the kitchen is busy.">
                {(id) => <input id={id} inputMode="numeric" value={form.extra_prep_minutes} onChange={(e) => set("extra_prep_minutes", Number(e.target.value.replace(/\D/g, "")) || 0)} className={`${inputCls} num max-w-32`} />}
              </Field>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={form.require_contact_details} onChange={(e) => set("require_contact_details", e.target.checked)} className="mt-1 size-4" />
                <span><span className="font-medium">Require name and phone at checkout</span><span className="block text-ink-2">Turn on once customers have the updated app; older versions cannot send them.</span></span>
              </label>
            </fieldset>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Opening hours</h2>
                <p className="mt-1 text-sm text-ink-2">Times are in {form.time_zone}. Enter a break or a shift past midnight as separate rows.</p>
              </div>
              <Toggle checked={form.enforce_opening_hours} onChange={(v) => set("enforce_opening_hours", v)} label="Refuse orders outside opening hours" disabled={!manage} />
            </div>
            <p className="mt-2 text-sm text-ink-2">{form.enforce_opening_hours ? "Orders outside these hours are refused." : "Not enforced yet: the hours are only a record until you switch this on."}</p>
            <fieldset disabled={!manage} className="mt-4 space-y-2">
              {form.opening_hours.length === 0 && <p className="text-sm text-ink-2">No hours yet. With enforcement on and no hours, every order is refused.</p>}
              {form.opening_hours.map((h, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select aria-label="Day" value={h.weekday} onChange={(e) => setHour(i, { weekday: Number(e.target.value) })} className={`${inputCls} w-36`}>
                    {DAYS.map((d, n) => <option key={d} value={n + 1}>{d}</option>)}
                  </select>
                  <input aria-label="Opens" type="time" value={h.opens_at} onChange={(e) => setHour(i, { opens_at: e.target.value })} className={`${inputCls} w-32`} />
                  <span aria-hidden className="text-ink-2">to</span>
                  <input aria-label="Closes" type="time" value={h.closes_at} onChange={(e) => setHour(i, { closes_at: e.target.value })} className={`${inputCls} w-32`} />
                  <button type="button" aria-label="Remove this shift" onClick={() => set("opening_hours", form.opening_hours.filter((_, n) => n !== i))} className="rounded p-2 text-ink-2 hover:bg-line/40 hover:text-error">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
              {manage && (
                <Button type="button" variant="secondary" onClick={() => set("opening_hours", [...form.opening_hours, { weekday: 1, opens_at: "11:00", closes_at: "22:00" }])}>
                  <Plus className="size-4" aria-hidden /> Add a shift
                </Button>
              )}
            </fieldset>
          </Card>

          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          {manage && (
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={busy || !dirty}>{busy ? "Saving…" : "Save settings"}</Button>
              <span role="status" aria-live="polite" className="text-sm font-medium text-success">{done ? "Saved." : ""}</span>
            </div>
          )}
        </div>
      </form>
    </>
  );
}
