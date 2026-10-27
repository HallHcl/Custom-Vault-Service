import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { RequireRole } from "@/components/auth/RequireRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailPageShell } from "@/components/DetailPageShell";
import { EmptyState } from "@/components/state/EmptyState";
import { LoadingState } from "@/components/state/LoadingState";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import EnvironmentEditCard from "./components/EnvironmentEditCard";
import { VpnResourceStatus } from "./components/VpnResourceStatus";
import ServerTable from "@/features/infrastructure/components/ServerTable";
import { PaginationControls } from "@/components/PaginationControls";
import { Badge } from "@/components/ui/badge";
import {
  useEnvironment,
  environmentStatusLabel,
  type EnvironmentDetail,
} from "@/hooks/useEnvironments";
import { useServers } from "@/hooks/useServers";
import { useHasRole } from "@/hooks/useHasRole";
import { usePagination } from "@/hooks/usePagination";

export default function EnvironmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: environment, isLoading, isError, error, refetch } = useEnvironment(id);

  // Google Drive folder breadcrumbs: Projects > [Project Name] > [Environment Name]
  useBreadcrumbs(
    environment
      ? [
          HOME_SEGMENT,
          { label: "Projects", href: "/projects" },
          { label: environment.project.name, href: `/projects/${environment.project.id}` },
          { label: environment.name },
        ]
      : [HOME_SEGMENT, { label: "Projects", href: "/projects" }]
  );
  // Environment update is admin-only — verified against
  // backend/src/routes/environments.routes.ts.
  const canEdit = useHasRole(["admin"]);

  const pagination = usePagination({ initialSort: "display_name", initialOrder: "asc" });
  const isEditing = canEdit && pagination.getParam("edit") === "true";

  function enterEdit() {
    pagination.setParams({ edit: "true" });
  }

  function exitEdit() {
    pagination.setParams({ edit: undefined });
  }

  const {
    data: servers = [],
    pagination: pageInfo,
    isLoading: serversLoading,
  } = useServers(environment?.id, pagination.params);

  const totalServers = pageInfo?.total ?? 0;
  const totalPages = pageInfo?.total_pages ?? 1;

  useEffect(() => {
    if (pageInfo && pageInfo.total_pages > 0 && pagination.page > pageInfo.total_pages) {
      pagination.setPage(pageInfo.total_pages);
    }
  }, [pageInfo?.total_pages, pagination.page, pagination.setPage]);

  const from = totalServers === 0 ? 0 : (pagination.page - 1) * pagination.perPage + 1;
  const to = Math.min(pagination.page * pagination.perPage, totalServers);

  return (
    /**
     * No `aside`: the Servers grid below is `sm:grid-cols-2 lg:grid-cols-3`
     * and already uses the full content width well. Moving it into the
     * shell's 400px rail would flatten it to a one-card-per-row list for no
     * gain, so this page stays single-column and takes the shell purely to
     * drop its duplicated back-link and loading/error/not-found chain.
     */
    <DetailPageShell<EnvironmentDetail>
      backTo={environment ? `/projects/${environment.project.id}` : "/projects"}
      backLabel={environment ? `Back to ${environment.project.name}` : "Back to projects"}
      entity={environment}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      loadingMessage="Loading environment..."
      notFoundMessage="This environment could not be found."
      main={(environment) => (
        <>
          <Card>
            {/* The header is rendered in both modes so the page's <h1> is
                always present — it previously lived inside a `!isEditing`
                guard, which left the page with no heading at all while
                editing. Only the subtitle and the Edit button are still
                mode-dependent; view mode is unchanged. */}
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle asChild>
                  <h1>{environment.name}</h1>
                </CardTitle>
              </div>
              {!isEditing && (
                <RequireRole roles={["admin"]}>
                  <Button variant="secondary" size="sm" onClick={enterEdit}>
                    Edit
                  </Button>
                </RequireRole>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditing ? (
                <EnvironmentEditCard environment={environment} onSaved={exitEdit} onCancel={exitEdit} />
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-label text-muted-foreground">Status</span>
                    <Badge variant="neutral">
                      {environmentStatusLabel(environment.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {environment.description ?? "No description provided."}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-label text-muted-foreground">
                      VPN resource
                    </span>
                    <VpnResourceStatus resourceId={environment.vpn_resource_id} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle asChild>
                <h2>Servers ({totalServers})</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* This section owns its own query, so it keeps its own
                  loading/empty chain — the shell's loading state is
                  page-level and has already resolved by the time this
                  renders. */}
              {serversLoading ? (
                <LoadingState message="Loading servers..." />
              ) : servers.length === 0 && totalServers === 0 ? (
                <EmptyState title="No servers" message="This environment has no servers yet." />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      Showing <span className="font-mono font-medium text-foreground">{from}–{to}</span> of{" "}
                      <span className="font-mono font-medium text-foreground">{totalServers}</span> servers
                    </span>
                  </div>

                  <ServerTable servers={servers} />

                  <PaginationControls
                    page={pagination.page}
                    totalPages={totalPages}
                    perPage={pagination.perPage}
                    onPrevPage={pagination.prevPage}
                    onNextPage={pagination.nextPage}
                    onPerPageChange={(newPerPage) => {
                      pagination.setPerPage(newPerPage);
                      pagination.setPage(1);
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    />
  );
}
