"use client";

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, CircleDashed, Clock, Truck, XCircle, X, Inbox, ChefHat, PackageCheck, Loader2, Eye } from "lucide-react";
import { STATUS_META, type OrderStatus, type Tone } from "@/modules/ordering/domain";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

const TONE: Record<Tone, string> = {
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  error: "bg-error-soft text-error",
};

const STATUS_ICON: Record<OrderStatus, typeof Clock> = {
  placed: Clock,
  accepted: CheckCircle2,
  preparing: ChefHat,
  ready_for_dispatch: PackageCheck,
  out_for_delivery: Truck,
  delivered: CheckCircle2,
  rejected: XCircle,
  cancelled: XCircle,
};

/** Status is always icon + text, never colour alone. */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, tone } = STATUS_META[status];
  const Icon = STATUS_ICON[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", TONE[tone])}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

export function Pill({ tone, children }: { tone: Tone | "neutral"; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", tone === "neutral" ? "bg-subtle text-ink-2" : TONE[tone])}>
      {children}
    </span>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  size?: "sm" | "md";
};

export function Button({ variant = "primary", loading, size = "md", className, children, disabled, ...rest }: BtnProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = size === "sm" ? "min-h-9 px-3 text-[13px]" : "min-h-11 px-4 text-sm";
  const variants = {
    primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-hover",
    secondary: "border border-line bg-surface text-ink hover:bg-subtle",
    danger: "border border-error/40 bg-surface text-error hover:bg-error-soft",
    ghost: "text-ink-2 hover:bg-subtle hover:text-ink",
  }[variant];
  return (
    <button className={cx(base, sizes, variants, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold leading-tight">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function DemoNotice({ children }: { children?: ReactNode }) {
  return (
    <p className="mb-5 flex items-start gap-2 rounded-control border border-line bg-subtle px-3 py-2 text-[13px] text-ink-2">
      <CircleDashed className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children ?? "Showing seeded demo data. Changes on this page are not saved to the database yet."}</span>
    </p>
  );
}

export function ReadOnlyNotice() {
  return (
    <p role="note" className="mb-5 flex items-start gap-2 rounded-control border border-info/30 bg-info-soft px-3 py-2 text-[13px] text-info">
      <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>You have view-only access to this page. Ask a super admin if you need to make changes.</span>
    </p>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-card border border-line bg-surface", className)}>{children}</section>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Inbox className="size-8 text-ink-2" aria-hidden />
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-sm text-ink-2">{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-card border border-error/30 bg-error-soft p-4 text-error">
      <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{title}</p>
        <p>{body}</p>
        {onRetry && <Button variant="danger" size="sm" className="mt-2" onClick={onRetry}>Try again</Button>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">{label}</label>
      {children(id)}
      {error ? <p className="text-xs text-error">{error}</p> : hint ? <p className="text-xs text-ink-2">{hint}</p> : null}
    </div>
  );
}

export const inputCls =
  "min-h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-2/70 focus-visible:border-info";

/** Modal / side drawer built on <dialog> for focus trapping, Esc, and backdrop. */
export function Drawer({ open, onClose, title, children, footer, side = "right", wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; side?: "right" | "center";
  /** A roomier panel for forms with tables (the product editor). */
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const width = wide ? "max-w-3xl" : "max-w-md";
  const pos = side === "right"
    ? `ml-auto h-dvh max-h-dvh w-full ${width} rounded-l-feature`
    : `m-auto w-full ${width} rounded-feature`;
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx("bg-surface p-0 text-ink backdrop:bg-ink/40", pos)}
    >
      {open && (
        <div className="flex h-full max-h-dvh flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-control text-ink-2 hover:bg-subtle">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50", checked ? "bg-success" : "bg-line")}
    >
      <span className={cx("absolute top-1 size-5 rounded-full bg-white transition-all", checked ? "left-6" : "left-1")} />
    </button>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">{children}</table>
    </div>
  );
}
export const th = "border-b border-line px-4 py-3 text-xs font-medium text-ink-2";
export const td = "border-b border-line px-4 py-3 align-middle";
