// Tipe yang akan dipindahkan dari page.tsx
export type AdminSection = "overview" | "models" | "users" | "logs" | "settings";
export type ModelFilter = "all" | "active" | "maintenance" | "disabled" | "free" | "paid";

// User interface — pindahkan dari duplikasi
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  credit: number;
  totalSpent: number;
  createdAt: string;
}

// Props untuk sidebar items
export interface SidebarItem {
  id: AdminSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}