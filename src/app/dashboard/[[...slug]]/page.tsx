import { WorkspacePage } from "@/server/page";
export const dynamic = "force-dynamic";
export default function Page(props: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  return <WorkspacePage base="dashboard" {...props} />;
}
