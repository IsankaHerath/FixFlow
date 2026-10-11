import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { actor } from "./policies";
import { AppError } from "./errors";
import {
  workspace,
  workDetail,
  type WorkspaceData,
  type WorkDetailData,
} from "./services/queries";
import { Workspace } from "@/components/workspace";
import { WorkDetail } from "@/components/work-detail";
const allowed: Record<string, string[]> = {
  dashboard: [
    "",
    "vehicles",
    "appointments",
    "repairs",
    "estimates",
    "invoices",
    "history",
    "maintenance",
    "notifications",
    "profile",
  ],
  manager: [
    "",
    "appointments",
    "work-orders",
    "vehicles",
    "technicians",
    "services",
    "estimates",
    "inventory",
    "invoices",
    "reports",
    "notifications",
    "settings",
    "profile",
  ],
  technician: ["", "jobs", "notifications", "profile"],
  admin: [
    "",
    "service-centers",
    "users",
    "audit-logs",
    "profile",
    "notifications",
  ],
};
export async function WorkspacePage({
  base,
  params,
  searchParams,
}: {
  base: string;
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  let user;
  try {
    user = await actor(await headers());
  } catch (e) {
    if (e instanceof AppError && [401, 403].includes(e.status))
      redirect("/login");
    throw e;
  }
  const home =
    user.role === "SUPER_ADMIN"
      ? "admin"
      : user.memberships.some((m) => m.role === "MANAGER")
        ? "manager"
        : user.memberships.some((m) => m.role === "TECHNICIAN")
          ? "technician"
          : "dashboard";
  if (base !== home) redirect(`/${home}`);
  const { slug = [] } = await params;
  const [section = "", id] = slug;
  if (!allowed[base].includes(section) || slug.length > 2) notFound();
  const search = await searchParams;
  const page = Math.max(1, Math.min(10000, Number(search.page) || 1));
  const raw = await workspace(user, page, (search.q ?? "").slice(0, 100));
  const data: WorkspaceData = JSON.parse(JSON.stringify(raw));
  if (id) {
    if (!["repairs", "work-orders", "jobs"].includes(section)) notFound();
    const work = await workDetail(user, id);
    if (!work) notFound();
    const serialized: WorkDetailData = JSON.parse(JSON.stringify(work));
    return <WorkDetail data={data} work={serialized} base={`/${base}`} />;
  }
  return <Workspace data={data} base={`/${base}`} section={section} />;
}
