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

  // Client breadcrumb segments were dropped along with the hidden Client UI.
  useBreadcrumbs(
    environment
      ? [
          HOME_SEGMENT,
          { label: "Projects", href: "/projects" },
          { label: environment.project.name, href: `/projects/${environment.project.id}` },
          { label: "Environments", href: "/environments" },
          { label: environment.name },
        ]
      : [HOME_SEGMENT, { label: "Environments", href: "/environments" }]
  );
  // Environment update is admin-only — verified against
  // backend/src/routes/environments.routes.ts.
  const canEdit = useHasRole(["admin"]);

  // Only the ?edit escape hatch of usePagination is used here — this page
  // has nothing to paginate. Reflecting edit mode in the URL (rather than
  // local state) is what makes the list page's row-action "Edit" and this
  // page's own Edit button converge on the same state, and keeps edit mode
  // shareable/deep-linkable/bookmarkable.
  const { getParam, setParams } = usePagination();
  const isEditing = canEdit && getParam("edit") === "true";

  function enterEdit() {
    setParams({ edit: "true" });
  }

  function exitEdit() {
    setParams({ edit: undefined });
  }

  // Servers is out of scope for its own CRUD/migration in this ticket —
  // useServers already exists and is read-only-safe to reuse here as-is.
  const { data: servers = [], isLoading: serversLoading } = useServers(environment?.id);

  return (
    /**
     * No `aside`: the Servers grid below is `sm:grid-cols-2 lg:grid-cols-3`
     * and already uses the full content width well. Moving it into the
     * shell's 400px rail would flatten it to a one-card-per-row list for no
     * gain, so this page stays single-column and takes the shell purely to
     * drop its duplicated back-link and loading/error/not-found chain.
     */
    <DetailPageShell<EnvironmentDetail>
      backTo="/environments"
      backLabel="Back to environments"
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
                <h2>Servers ({servers.length})</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* This section owns its own query, so it keeps its own
                  loading/empty chain — the shell's loading state is
                  page-level and has already resolved by the time this
                  renders. */}
              {serversLoading ? (
                <LoadingState message="Loading servers..." />
              ) : servers.length === 0 ? (
                <EmptyState title="No servers" message="This environment has no servers yet." />
              ) : (
                <ServerTable servers={servers} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    />
  );
}
