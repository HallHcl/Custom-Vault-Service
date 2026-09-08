import {
  BookText,
  CalendarClock,
  FolderKanban,
  HardDrive,
  Layers,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import { MetricCard } from "@/components/MetricCard";
import UrgentActionItems from "./UrgentActionItems";
import CriticalExpirationsCard from "./CriticalExpirationsCard";
import { useProjects } from "@/hooks/useProjects";
import { useEnvironments } from "@/hooks/useEnvironments";
import { useServers } from "@/hooks/useServers";
import { useResources } from "@/hooks/useResources";
import { useSchedules } from "@/hooks/useSchedules";
import { useExpirationsSummary } from "@/hooks/useExpirations";

export default function OverviewPage() {
  useBreadcrumbs([HOME_SEGMENT, { label: "Overview" }]);

  // System-wide KPI counts. Each is its own independent query asking for a
  // single row and reading `pagination.total` off it — the same trick
  // useChildCounts.ts uses per row, except this fires once per page load, not
  // once per visible row. Independent queries are the point: one failing
  // endpoint greys out its own tile and leaves the others intact.
  //
  // The per-client scoping card and the "Total Clients" tile were removed
  // along with the hidden Client UI.
  const projectCount = useProjects(undefined, { per_page: 1 });
  const environmentCount = useEnvironments(undefined, { per_page: 1 });
  const serverCount = useServers(undefined, { per_page: 1 });
  const resourceCount = useResources({ per_page: 1 });
  const pendingScheduleCount = useSchedules({ status: "pending", per_page: 1 });
  const expiringSoonCount = useExpirationsSummary();
  const expiringSoonTotal = expiringSoonCount.data
    ? (expiringSoonCount.data.critical_count ?? 0) +
      (expiringSoonCount.data.warning_count ?? 0) +
      (expiringSoonCount.data.expired_count ?? 0)
    : undefined;

  // `to` carries any pre-applied filter as search params — the destination
  // page reads them back through usePagination's getParam, so the filter
  // survives a refresh or a shared link.
  const metrics = [
    { label: "Total Projects", query: projectCount, icon: FolderKanban, to: "/projects" },
    { label: "Environments", query: environmentCount, icon: Layers, to: "/environments" },
    { label: "Servers", query: serverCount, icon: HardDrive, to: "/servers" },
    { label: "Resources", query: resourceCount, icon: BookText, to: "/resources" },
    {
      label: "Pending Schedules",
      query: pendingScheduleCount,
      icon: CalendarClock,
      to: "/schedule?status=pending",
    },
    {
      label: "Expiring (30d)",
      query: {
        pagination: { total: expiringSoonTotal },
        isLoading: expiringSoonCount.isLoading,
        isError: expiringSoonCount.isError,
      },
      icon: ShieldAlert,
      to: "/expirations?days_ahead=30",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" />

      <UrgentActionItems />

      <CriticalExpirationsCard />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map(({ label, query, icon, to }) => (
          <MetricCard
            key={label}
            label={label}
            icon={icon}
            to={to}
            count={query.pagination?.total}
            isLoading={query.isLoading}
            isError={query.isError}
          />
        ))}
      </div>
    </div>
  );
}
