// RBAC rules. Pure functions, no I/O, so they are easy to test and safe to share between server and UI.
// The server is the authority: the UI only uses these to decide what to show.

export const ROLES = ["super_admin", "manager", "staff"] as const;
export type Role = (typeof ROLES)[number];

/** Modules a super admin can assign. Matches the sidebar and the user_modules table check constraint. */
export const MODULES = ["overview", "orders", "menu", "categories", "customers", "offers", "delivery", "reports", "settings"] as const;
export type Module = (typeof MODULES)[number];

/** Not assignable: only super admins can ever use it. */
export const USERS_MODULE = "users" as const;
export type AnyModule = Module | typeof USERS_MODULE;

export const ACCESS_LEVELS = ["view", "manage"] as const;
export type Access = (typeof ACCESS_LEVELS)[number];

export type Grants = Partial<Record<Module, Access>>;

export interface Principal {
  id: string;
  role: Role;
  status: "active" | "inactive";
  grants: Grants;
}

export const ROLE_LABEL: Record<Role, string> = { super_admin: "Super admin", manager: "Manager", staff: "Staff" };
export const MODULE_LABEL: Record<AnyModule, string> = {
  overview: "Overview", orders: "Orders", menu: "Menu", categories: "Categories", customers: "Customers",
  offers: "Offers & Coupons", delivery: "Delivery", reports: "Reports", settings: "Settings", users: "Users & Access",
};
export const MODULE_PATH: Record<AnyModule, string> = {
  overview: "/", orders: "/orders", menu: "/menu", categories: "/categories", customers: "/customers",
  offers: "/offers", delivery: "/delivery", reports: "/reports", settings: "/settings", users: "/users",
};

/** Starting points offered when a super admin creates a user. Fully editable per user. */
export const DEFAULT_GRANTS: Record<Exclude<Role, "super_admin">, Grants> = {
  manager: { overview: "manage", orders: "manage", menu: "manage", categories: "manage", customers: "view", offers: "manage", delivery: "manage", reports: "view", settings: "view" },
  staff: { overview: "view", orders: "manage", menu: "view" },
};

const LEVEL: Record<Access, number> = { view: 1, manage: 2 };

/** Effective access to a module, or null. Inactive users have none. */
export function accessFor(p: Principal, module: AnyModule): Access | null {
  if (p.status !== "active") return null;
  if (p.role === "super_admin") return "manage";
  if (module === USERS_MODULE) return null;
  return p.grants[module] ?? null;
}

export function can(p: Principal, module: AnyModule, need: Access = "view"): boolean {
  const have = accessFor(p, module);
  return have !== null && LEVEL[have] >= LEVEL[need];
}

/** Modules the user can open, in sidebar order. */
export function visibleModules(p: Principal): AnyModule[] {
  const all: AnyModule[] = [...MODULES, USERS_MODULE];
  return all.filter((m) => can(p, m));
}

/** Where to send someone after login or when they hit a page they can't use. */
export function homePath(p: Principal): string | null {
  const first = visibleModules(p)[0];
  return first ? MODULE_PATH[first] : null;
}

/** Only super admins manage users. Managers and staff never do, whatever modules they hold. */
export function canManageUsers(p: Principal): boolean {
  return p.status === "active" && p.role === "super_admin";
}

export interface UserChangeCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Rules for deleting, deactivating or demoting a user.
 * `activeSuperAdmins` is the current count of active super admins, including the target if it is one.
 * The database trigger enforces the last-super-admin rule too; this gives a friendly message first.
 */
export function checkUserChange(
  actor: Principal,
  target: { id: string; role: Role; status: "active" | "inactive" },
  change: "delete" | "deactivate" | "demote",
  activeSuperAdmins: number,
): UserChangeCheck {
  if (!canManageUsers(actor)) return { ok: false, reason: "Only a super admin can change users." };
  if (actor.id === target.id) {
    return { ok: false, reason: change === "demote" ? "You can’t change your own role." : "You can’t remove or deactivate your own account." };
  }
  if (target.role === "super_admin" && target.status === "active" && activeSuperAdmins <= 1) {
    return { ok: false, reason: "This is the last active super admin. Create another one first." };
  }
  return { ok: true };
}

export interface GrantsCheck {
  ok: boolean;
  grants: Grants;
  errors: string[];
}

/** Validates and cleans a module assignment coming from the client. Unknown input is rejected, not trusted. */
export function sanitizeGrants(role: Role, input: unknown): GrantsCheck {
  if (role === "super_admin") return { ok: true, grants: {}, errors: [] }; // implicit full access
  const errors: string[] = [];
  const grants: Grants = {};
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, grants, errors: ["Modules must be an object."] };
  }
  for (const [key, value] of Object.entries(input)) {
    if (key === USERS_MODULE) {
      errors.push("Users & Access can’t be assigned.");
    } else if (!(MODULES as readonly string[]).includes(key)) {
      errors.push(`Unknown module: ${key}.`);
    } else if (value === null || value === "none") {
      continue;
    } else if (!(ACCESS_LEVELS as readonly string[]).includes(value as string)) {
      errors.push(`Invalid access for ${key}.`);
    } else {
      grants[key as Module] = value as Access;
    }
  }
  return { ok: errors.length === 0, grants, errors };
}
