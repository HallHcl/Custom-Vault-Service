import { useEffect, useState } from "react";
import { ProjectPicker } from "@/components/ProjectPicker";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { LoadingState } from "@/components/state/LoadingState";
import { PageHeader } from "@/components/layout/PageHeader";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import { useProjects } from "@/hooks/useProjects";
import { useEnvironments } from "@/hooks/useEnvironments";
import { useServers } from "@/hooks/useServers";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import EnvironmentTabs from "./components/EnvironmentTabs";
import ServerTable from "./components/ServerTable";

export default function InfrastructurePage() {
  useBreadcrumbs([HOME_SEGMENT, { label: "Infrastructure" }]);

  const pagination = usePagination({ initialPerPage: 20 });

  // The Client picker was removed with the hidden Client UI — the project
  // list is no longer scoped to a client.
  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsIsError,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects();
  const [projectId, setProjectId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (projects.length > 0) {
      setProjectId((curr) => (curr && projects.some((p) => p.id === curr) ? curr : projects[0].id));
    }
  }, [projects]);

  const {
    data: environments = [],
    isLoading: environmentsLoading,
    isError: environmentsIsError,
    error: environmentsError,
    refetch: refetchEnvironments,
  } = useEnvironments(projectId);
  const [environmentId, setEnvironmentId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (environments.length > 0) {
      setEnvironmentId((curr) =>
        curr && environments.some((e) => e.id === curr) ? curr : environments[0].id
      );
    } else {
      setEnvironmentId(undefined);
    }
  }, [environments]);

  function handleEnvironmentChange(id: string) {
    setEnvironmentId(id);
    pagination.setPage(1);
  }

  function handleProjectChange(id: string | undefined) {
    setProjectId(id);
    pagination.setPage(1);
  }

  const {
    data: servers = [],
    pagination: pageInfo,
    isLoading: serversLoading,
    isError: serversIsError,
    error: serversError,
    refetch: refetchServers,
  } = useServers(environmentId, pagination.params);

  const totalServers = pageInfo?.total ?? 0;
  const totalPages = pageInfo?.total_pages ?? 1;

  // Defensive: if page is out of bounds, snap to totalPages
  useEffect(() => {
    if (pageInfo && pageInfo.total_pages > 0 && pagination.page > pageInfo.total_pages) {
      pagination.setPage(pageInfo.total_pages);
    }
  }, [pageInfo?.total_pages, pagination.page, pagination.setPage]);

  const from = totalServers === 0 ? 0 : (pagination.page - 1) * pagination.perPage + 1;
  const to = Math.min(pagination.page * pagination.perPage, totalServers);

  const isLoading = projectsLoading || environmentsLoading || serversLoading;
  const isError = projectsIsError || environmentsIsError || serversIsError;
  const error = projectsError ?? environmentsError ?? serversError;

  function retry() {
    refetchProjects();
    refetchEnvironments();
    refetchServers();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Infrastructure"
        className="flex flex-wrap items-center justify-between gap-3"
        actions={
          <ProjectPicker
            value={projectId}
            onChange={handleProjectChange}
            placeholder="Project"
            className="w-48"
            aria-label="Project"
          />
        }
      />

      {isLoading ? (
        <LoadingState message="Loading infrastructure..." />
      ) : isError ? (
        <ErrorState error={error} onRetry={retry} />
      ) : (
        <>
          <EnvironmentTabs
            environments={environments}
            value={environmentId}
            onValueChange={handleEnvironmentChange}
          />

          {environmentId && (
            <div className="space-y-4">
              {servers.length === 0 && totalServers === 0 ? (
                <EmptyState title="No servers found" message="No servers in this environment." />
              ) : (
                <>
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
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
