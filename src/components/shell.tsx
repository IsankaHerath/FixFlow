"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CarFront,
  CalendarDays,
  Wrench,
  FileText,
  History,
  Bell,
  Settings,
  Users,
  Package,
  ChartNoAxesCombined,
  Building2,
  Shield,
  LogOut,
  Menu,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  UserRound,
} from "lucide-react";
import { Brand } from "./brand";
import { authClient } from "@/lib/auth-client";
import type { WorkspaceData } from "@/server/services/queries";
const customerNav = [
  ["", "Overview", LayoutDashboard],
  ["vehicles", "My vehicles", CarFront],
  ["appointments", "Appointments", CalendarDays],
  ["repairs", "Repair tracking", Wrench],
  ["estimates", "Estimates", FileText],
  ["history", "Service history", History],
  ["invoices", "Invoices", FileText],
  ["maintenance", "Maintenance", ClipboardList],
  ["notifications", "Notifications", Bell],
  ["profile", "Profile & settings", Settings],
] as const;
const managerNav = [
  ["", "Overview", LayoutDashboard],
  ["appointments", "Appointments", CalendarDays],
  ["work-orders", "Work orders", Wrench],
  ["vehicles", "Customer vehicles", CarFront],
  ["technicians", "Technicians", Users],
  ["services", "Service catalog", ClipboardList],
  ["estimates", "Estimates", FileText],
  ["inventory", "Inventory", Package],
  ["invoices", "Invoices & payments", FileText],
  ["reports", "Reports", ChartNoAxesCombined],
  ["notifications", "Notifications", Bell],
  ["settings", "Center settings", Settings],
  ["profile", "My profile", UserRound],
] as const;
const techNav = [
  ["", "Overview", LayoutDashboard],
  ["jobs", "Assigned jobs", Wrench],
  ["notifications", "Notifications", Bell],
  ["profile", "My profile", UserRound],
] as const;
const adminNav = [
  ["", "Platform overview", LayoutDashboard],
  ["service-centers", "Service centers", Building2],
  ["users", "Users & access", Users],
  ["audit-logs", "Audit logs", Shield],
  ["profile", "My profile", UserRound],
] as const;
export function Shell({
  data,
  base,
  children,
}: {
  data: WorkspaceData;
  base: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav =
    base === "/manager"
      ? managerNav
      : base === "/technician"
        ? techNav
        : base === "/admin"
          ? adminNav
          : customerNav;
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "mobile-open" : ""}`}>
        <Brand />
        <div className="workspace-label">
          {base === "/manager"
            ? "WORKSHOP WORKSPACE"
            : base === "/technician"
              ? "TECHNICIAN WORKSPACE"
              : base === "/admin"
                ? "PLATFORM ADMINISTRATION"
                : "YOUR VEHICLE WORKSPACE"}
        </div>
        <nav aria-label="Workspace">
          {nav.map(([slug, title, Icon]) => (
            <Link
              onClick={() => setOpen(false)}
              key={slug}
              href={`${base}${slug ? `/${slug}` : ""}`}
              className={
                path === `${base}${slug ? `/${slug}` : ""}` ? "active" : ""
              }
            >
              <Icon />
              {title}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/contact" className="inline-actions">
            <CircleHelp size={16} /> Need a hand?
          </Link>
          <p>We’re here to help you keep moving.</p>
          <button
            className="button button-ghost button-sm"
            onClick={async () => {
              await authClient.signOut();
              router.push("/login");
              router.refresh();
            }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              aria-label="Toggle menu"
              className="mobile-toggle"
              onClick={() => setOpen(!open)}
            >
              <Menu size={21} />
            </button>
            Workspace <ChevronRight size={12} />
            <span>
              {nav.find(([s]) => path === `${base}${s ? `/${s}` : ""}`)?.[1] ??
                "Details"}
            </span>
          </div>
          <div className="topbar-right">
            <Link
              href={`${base}/notifications`}
              aria-label={`${data.stats.unread} unread notifications`}
              className="notification-link"
            >
              <Bell size={18} />
              {data.stats.unread > 0 && <i />}
            </Link>
            <Link href={`${base}/profile`} className="profile-mini">
              <div className="avatar">
                {data.user.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <strong>{data.user.name}</strong>
                <small>
                  {data.user.role.toLowerCase().replaceAll("_", " ")}
                </small>
              </div>
            </Link>
          </div>
        </header>
        <main id="main" className="content">
          {children}
        </main>
      </div>
    </div>
  );
}
