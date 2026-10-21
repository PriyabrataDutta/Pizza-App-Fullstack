"use client";

import { useMemo, useState, useTransition } from "react";
import { Copy, KeyRound, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { Button, Card, Drawer, EmptyState, Field, PageHeader, Pill, Table, inputCls, td, th } from "@/shared/ui";
import { formatDateTime } from "@/shared/format";
import { createUserAction, deleteUserAction, resetPasswordAction, updateUserAction } from "./actions";
import {
  DEFAULT_GRANTS, MODULES, MODULE_LABEL, ROLES, ROLE_LABEL, type Access, type Grants, type Module, type Role,
} from "./permissions";
import type { AuditEntry, StaffUser } from "./repository";

type Draft = { id?: string; fullName: string; email: string; role: Role; status: "active" | "inactive"; grants: Grants };
const blank: Draft = { fullName: "", email: "", role: "staff", status: "active", grants: { ...DEFAULT_GRANTS.staff } };

const ACTION_LABEL: Record<string, string> = {
  login: "signed in", user_created: "created", user_updated: "updated", user_deleted: "deleted", password_reset: "reset the password of", password_changed: "changed their password",
};

function summary(u: StaffUser): string {
  if (u.role === "super_admin") return "All modules";
  const n = Object.keys(u.grants).length;
  return n === 0 ? "No modules" : `${n} of ${MODULES.length} modules`;
}

export function UsersView({ users, audit, meId }: { users: StaffUser[]; audit: AuditEntry[]; meId: string }) {
  const [tab, setTab] = useState<"users" | "activity">("users");
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [toDelete, setToDelete] = useState<StaffUser | null>(null);
  const [toReset, setToReset] = useState<StaffUser | null>(null);
  const [secret, setSecret] = useState<{ email: string; password: string; why: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) => (roleFilter === "all" || u.role === roleFilter) && (!s || u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)));
  }, [users, q, roleFilter]);

  const open = (u?: StaffUser) => {
    setError("");
    setDraft(u ? { id: u.id, fullName: u.fullName, email: u.email, role: u.role, status: u.status, grants: { ...u.grants } } : blank);
  };
  const set = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  function changeRole(role: Role) {
    // Offer sensible starting modules when the role changes on a new user; leave existing users' modules alone.
    set(draft?.id || role === "super_admin" ? { role } : { role, grants: { ...DEFAULT_GRANTS[role] } });
  }

  function save() {
    if (!draft) return;
    setError("");
    start(async () => {
      if (draft.id) {
        const r = await updateUserAction(draft.id, { fullName: draft.fullName, role: draft.role, status: draft.status, grants: draft.grants });
        if (!r.ok) return setError(r.error);
        setNotice(`Saved ${draft.fullName}.`);
        setDraft(null);
      } else {
        const r = await createUserAction({ fullName: draft.fullName, email: draft.email, role: draft.role, grants: draft.grants });
        if (!r.ok) return setError(r.error);
        setSecret({ email: r.email, password: r.password, why: "Share this temporary password with them. They must choose their own at first sign-in." });
        setNotice(`Added ${draft.fullName}.`);
        setDraft(null);
      }
    });
  }

  function reset() {
    if (!toReset) return;
    start(async () => {
      const r = await resetPasswordAction(toReset.id);
      setToReset(null);
      if (!r.ok) return setNotice(r.error);
      setSecret({ email: r.email, password: r.password, why: "Their old password no longer works. They must choose a new one at next sign-in." });
    });
  }

  function remove() {
    if (!toDelete) return;
    start(async () => {
      const r = await deleteUserAction(toDelete.id);
      setNotice(r.ok ? `Deleted ${toDelete.fullName}.` : r.error);
      setToDelete(null);
    });
  }

  return (
    <>
      <PageHeader
        title="Users & access"
        description="Choose who can sign in and which parts of the dashboard each person can use."
        actions={<Button onClick={() => open()}><Plus className="size-4" aria-hidden /> Add user</Button>}
      />
      <div role="status" aria-live="polite" className="mb-3 min-h-5 text-sm font-medium text-success">{notice}</div>

      <div role="tablist" aria-label="Users and activity" className="mb-4 inline-flex rounded-control border border-line bg-surface p-0.5">
        {(["users", "activity"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-10 rounded-[8px] px-4 text-sm font-medium ${tab === t ? "bg-brand-soft text-brand" : "text-ink-2 hover:text-ink"}`}>
            {t === "users" ? "People" : "Activity"}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
              <label htmlFor="user-q" className="sr-only">Search people</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-2" aria-hidden />
              <input id="user-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className={`${inputCls} pl-9`} />
            </div>
            <div>
              <label htmlFor="user-role" className="sr-only">Filter by role</label>
              <select id="user-role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | "all")} className={inputCls}>
                <option value="all">All roles</option>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
          </div>
          <Card>
            {shown.length === 0 ? (
              <EmptyState title="No people found" body="Try another name or role, or add a new user." />
            ) : (
              <Table>
                <thead><tr><th className={th}>Name</th><th className={th}>Role</th><th className={th}>Modules</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {shown.map((u) => (
                    <tr key={u.id} className={u.status === "inactive" ? "bg-subtle/60" : ""}>
                      <td className={td}><span className="font-medium">{u.fullName}</span>{u.id === meId && <span className="ml-2 text-xs text-ink-2">(you)</span>}<span className="block text-xs text-ink-2">{u.email}</span></td>
                      <td className={td}><Pill tone={u.role === "super_admin" ? "error" : u.role === "manager" ? "info" : "neutral"}>{u.role === "super_admin" && <ShieldCheck className="size-3" aria-hidden />}{ROLE_LABEL[u.role]}</Pill></td>
                      <td className={td}>{summary(u)}</td>
                      <td className={td}><Pill tone={u.status === "active" ? "success" : "warning"}>{u.status === "active" ? "Active" : "Deactivated"}</Pill></td>
                      <td className={`${td} text-right`}>
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => open(u)}>Edit<span className="sr-only"> {u.fullName}</span></Button>
                          <Button variant="secondary" size="sm" onClick={() => setToReset(u)} aria-label={`Reset password for ${u.fullName}`}><KeyRound className="size-4" aria-hidden /></Button>
                          {u.id !== meId && <Button variant="danger" size="sm" onClick={() => setToDelete(u)} aria-label={`Delete ${u.fullName}`}><Trash2 className="size-4" aria-hidden /></Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      ) : (
        <Card>
          {audit.length === 0 ? <EmptyState title="No activity yet" body="Sign-ins and changes to users will show up here." /> : (
            <ul className="divide-y divide-line">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3">
                  <p><span className="font-medium">{a.actorEmail ?? "Someone"}</span> {ACTION_LABEL[a.action] ?? a.action}{a.targetEmail && a.targetEmail !== a.actorEmail ? <> <span className="font-medium">{a.targetEmail}</span></> : null}</p>
                  <span className="num text-xs text-ink-2">{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Add / edit */}
      <Drawer
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit user" : "Add user"}
        footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save} loading={pending}>{draft?.id ? "Save changes" : "Add user"}</Button></>}
      >
        {draft && (
          <div className="space-y-4">
            <Field label="Full name">{(id) => <input id={id} value={draft.fullName} onChange={(e) => set({ fullName: e.target.value })} className={inputCls} />}</Field>
            <Field label="Email" hint={draft.id ? "Email can’t be changed. Delete and re-add the user to use a different one." : "They sign in with this."}>
              {(id) => <input id={id} type="email" value={draft.email} disabled={!!draft.id} onChange={(e) => set({ email: e.target.value })} className={`${inputCls} disabled:bg-subtle`} />}
            </Field>
            <Field label="Role" hint={draft.id === meId ? "You can’t change your own role." : undefined}>
              {(id) => (
                <select id={id} value={draft.role} disabled={draft.id === meId} onChange={(e) => changeRole(e.target.value as Role)} className={`${inputCls} disabled:bg-subtle`}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              )}
            </Field>
            {draft.id && (
              <Field label="Status" hint={draft.id === meId ? "You can’t deactivate yourself." : "Deactivated people can’t sign in. Their history is kept."}>
                {(id) => (
                  <select id={id} value={draft.status} disabled={draft.id === meId} onChange={(e) => set({ status: e.target.value as "active" | "inactive" })} className={`${inputCls} disabled:bg-subtle`}>
                    <option value="active">Active</option>
                    <option value="inactive">Deactivated</option>
                  </select>
                )}
              </Field>
            )}

            {draft.role === "super_admin" ? (
              <p className="rounded-control bg-subtle px-3 py-2 text-ink-2">Super admins can use every module and manage all users. There’s nothing to assign.</p>
            ) : (
              <fieldset>
                <legend className="mb-1 text-[13px] font-medium">Modules</legend>
                <p className="mb-2 text-xs text-ink-2">View lets them look. Manage also lets them add, edit and change status.</p>
                <ul className="divide-y divide-line rounded-control border border-line">
                  {MODULES.map((m: Module) => (
                    <li key={m} className="flex items-center justify-between gap-3 px-3 py-2">
                      <label htmlFor={`mod-${m}`} className="min-w-0 flex-1">{MODULE_LABEL[m]}</label>
                      <select
                        id={`mod-${m}`}
                        value={draft.grants[m] ?? "none"}
                        onChange={(e) => {
                          const v = e.target.value as Access | "none";
                          const next = { ...draft.grants };
                          if (v === "none") delete next[m]; else next[m] = v;
                          set({ grants: next });
                        }}
                        className={`${inputCls} !min-h-10 !w-32`}
                      >
                        <option value="none">No access</option>
                        <option value="view">View</option>
                        <option value="manage">Manage</option>
                      </select>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={() => set({ grants: { ...DEFAULT_GRANTS[draft.role as "manager" | "staff"] } })}>Reset to {ROLE_LABEL[draft.role].toLowerCase()} defaults</Button>
                  <Button variant="ghost" size="sm" onClick={() => set({ grants: {} })}>Clear all</Button>
                </div>
              </fieldset>
            )}
            {error && <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-sm text-error">{error}</p>}
          </div>
        )}
      </Drawer>

      {/* Delete */}
      <Drawer
        side="center"
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={toDelete ? `Delete ${toDelete.fullName}?` : ""}
        footer={<><Button variant="secondary" onClick={() => setToDelete(null)}>Keep user</Button><Button onClick={remove} loading={pending}>Delete user</Button></>}
      >
        <p className="text-ink-2">{toDelete?.email} will lose access straight away and the account is removed for good. Past activity stays in the log. If you only want to stop them signing in, deactivate them instead.</p>
      </Drawer>

      {/* Reset password */}
      <Drawer
        side="center"
        open={!!toReset}
        onClose={() => setToReset(null)}
        title={toReset ? `Reset password for ${toReset.fullName}?` : ""}
        footer={<><Button variant="secondary" onClick={() => setToReset(null)}>Cancel</Button><Button onClick={reset} loading={pending}>Reset password</Button></>}
      >
        <p className="text-ink-2">A new temporary password is created and shown once. Their current password stops working immediately.</p>
      </Drawer>

      {/* Temporary password, shown once */}
      <Drawer
        side="center"
        open={!!secret}
        onClose={() => { setSecret(null); setCopied(false); }}
        title="Temporary password"
        footer={<Button onClick={() => { setSecret(null); setCopied(false); }}>Done</Button>}
      >
        {secret && (
          <div className="space-y-3">
            <p className="text-ink-2">{secret.why}</p>
            <p className="text-ink-2">Sign-in email: <span className="font-medium text-ink">{secret.email}</span></p>
            <div className="flex items-center gap-2 rounded-control border border-line bg-subtle p-3">
              <code className="num flex-1 select-all break-all text-base font-semibold">{secret.password}</code>
              <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(secret.password); setCopied(true); }}>
                <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-warning">This is the only time it’s shown. If it’s lost, reset the password again.</p>
          </div>
        )}
      </Drawer>
    </>
  );
}
