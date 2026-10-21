import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRANTS, canManageUsers, can, checkUserChange, homePath, sanitizeGrants, visibleModules, type Principal,
} from "./permissions";

const sa: Principal = { id: "sa1", role: "super_admin", status: "active", grants: {} };
const mgr: Principal = { id: "m1", role: "manager", status: "active", grants: DEFAULT_GRANTS.manager };
const staff: Principal = { id: "s1", role: "staff", status: "active", grants: DEFAULT_GRANTS.staff };

describe("access", () => {
  it("gives super admin everything, including Users & Access", () => {
    expect(can(sa, "orders", "manage")).toBe(true);
    expect(can(sa, "users", "manage")).toBe(true);
    expect(visibleModules(sa)).toContain("users");
  });

  it("never lets a manager or staff reach Users & Access, even with all modules", () => {
    const everything: Principal = { ...mgr, grants: { orders: "manage", settings: "manage" } };
    expect(can(everything, "users")).toBe(false);
    expect(can(staff, "users")).toBe(false);
    expect(canManageUsers(mgr)).toBe(false);
    expect(canManageUsers(staff)).toBe(false);
  });

  it("respects view vs manage", () => {
    expect(can(staff, "menu", "view")).toBe(true);
    expect(can(staff, "menu", "manage")).toBe(false);
    expect(can(staff, "orders", "manage")).toBe(true);
  });

  it("denies unassigned modules", () => {
    expect(can(staff, "reports")).toBe(false);
    expect(can(staff, "settings")).toBe(false);
  });

  it("denies everything to inactive users, even super admins", () => {
    expect(can({ ...sa, status: "inactive" }, "orders")).toBe(false);
    expect(can({ ...mgr, status: "inactive" }, "orders")).toBe(false);
    expect(canManageUsers({ ...sa, status: "inactive" })).toBe(false);
  });

  it("sends people to their first allowed module, or nowhere", () => {
    expect(homePath(staff)).toBe("/");
    expect(homePath({ ...staff, grants: { orders: "view" } })).toBe("/orders");
    expect(homePath({ ...staff, grants: {} })).toBeNull();
  });
});

describe("user changes", () => {
  const manager = { id: "m1", role: "manager" as const, status: "active" as const };

  it("blocks non-super-admins from changing users", () => {
    expect(checkUserChange(mgr, manager, "delete", 1).ok).toBe(false);
    expect(checkUserChange(staff, manager, "deactivate", 1).ok).toBe(false);
  });

  it("lets a super admin delete a manager or staff member", () => {
    expect(checkUserChange(sa, manager, "delete", 1).ok).toBe(true);
    expect(checkUserChange(sa, { id: "s9", role: "staff", status: "active" }, "deactivate", 1).ok).toBe(true);
  });

  it("blocks changing yourself", () => {
    expect(checkUserChange(sa, { id: "sa1", role: "super_admin", status: "active" }, "delete", 2).ok).toBe(false);
    expect(checkUserChange(sa, { id: "sa1", role: "super_admin", status: "active" }, "demote", 2).ok).toBe(false);
  });

  it("protects the last active super admin", () => {
    const other = { id: "sa2", role: "super_admin" as const, status: "active" as const };
    expect(checkUserChange(sa, other, "delete", 1).ok).toBe(false);
    expect(checkUserChange(sa, other, "delete", 2).ok).toBe(true);
  });
});

describe("sanitizeGrants", () => {
  it("accepts valid grants and drops 'none'", () => {
    const r = sanitizeGrants("staff", { orders: "manage", menu: "view", reports: "none" });
    expect(r.ok).toBe(true);
    expect(r.grants).toEqual({ orders: "manage", menu: "view" });
  });

  it("rejects the users module, unknown modules and bad levels", () => {
    expect(sanitizeGrants("manager", { users: "manage" }).ok).toBe(false);
    expect(sanitizeGrants("manager", { payroll: "view" }).ok).toBe(false);
    expect(sanitizeGrants("manager", { orders: "admin" }).ok).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(sanitizeGrants("staff", ["orders"]).ok).toBe(false);
    expect(sanitizeGrants("staff", null).ok).toBe(false);
  });

  it("ignores grants for super admins (implicit access)", () => {
    expect(sanitizeGrants("super_admin", { orders: "view" })).toEqual({ ok: true, grants: {}, errors: [] });
  });
});
