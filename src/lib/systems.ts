import { LucideIcon, Tags, Boxes, ShoppingCart, Truck } from "lucide-react";

export type SystemStatus = "active" | "coming-soon";

export interface AppSystem {
  key: string;          // stable id used in user.systems[]
  name: string;
  description: string;
  icon: LucideIcon;
  path: string;         // route to navigate to when launched
  status: SystemStatus;
}

/**
 * Catalogue of all systems available in the portal. Add new entries here
 * and grant access via the Admin → Access tab (or the `systems` field in
 * users.json / Postgres `user_systems` table).
 */
export const SYSTEMS: AppSystem[] = [
  {
    key: "price-management",
    name: "Price Management",
    description: "Contract prices, bulk updates, and audit history.",
    icon: Tags,
    path: "/prices",
    status: "active",
  },
  {
    key: "inventory",
    name: "Inventory Control",
    description: "Stock levels, movements, and warehouse visibility.",
    icon: Boxes,
    path: "/inventory",
    status: "coming-soon",
  },
  {
    key: "purchase-orders",
    name: "Purchase Orders",
    description: "Create, approve, and track purchase orders.",
    icon: ShoppingCart,
    path: "/purchase-orders",
    status: "coming-soon",
  },
  {
    key: "supplier-portal",
    name: "Supplier Portal",
    description: "Supplier registry, documents, and qualification.",
    icon: Truck,
    path: "/suppliers",
    status: "coming-soon",
  },
];

export function getSystem(key: string): AppSystem | undefined {
  return SYSTEMS.find((s) => s.key === key);
}

export function userCanAccess(
  user: { role?: string; systems?: string[] } | null,
  systemKey: string,
): boolean {
  if (!user) return false;
  if ((user.role ?? "").toLowerCase() === "admin") return true;
  return (user.systems ?? []).includes(systemKey);
}