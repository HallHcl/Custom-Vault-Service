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
import EnvironmentTabs from "./components/EnvironmentTabs";
import ServerTable from "./components/ServerTable";

export default function InfrastructurePage() {
  useBreadcrumbs([HOME_SEGMENT, { label: "Infrastructure" }]);

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
    setProjectId(projects[0]?.id);
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
    setEnvironmentId(environments[0]?.id);
  }, [environments]);

  const {
    data: servers = [],
    isLoading: serversLoading,
    isError: serversIsError,
    error: serversError,
    refetch: refetchServers,
  } = useServers(environmentId);

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
            onChange={setProjectId}
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
            onValueChange={setEnvironmentId}
          />

          {environmentId && (
            <div>
              {servers.length === 0 ? (
                <EmptyState title="No servers found" message="No servers in this environment." />
              ) : (
                <ServerTable servers={servers} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
