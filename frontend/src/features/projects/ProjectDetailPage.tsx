import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Folder, Plus, Server, Users } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailPageShell } from "@/components/DetailPageShell";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { RelatedCount } from "@/components/RelatedCount";
import ProjectFormDialog from "./components/ProjectFormDialog";
import ProjectRoster from "./components/ProjectRoster";
import EnvironmentFormDialog from "@/features/environments/components/EnvironmentFormDialog";
import { useProject } from "@/hooks/useProjects";
import {
  useEnvironments,
  environmentStatusLabel,
} from "@/hooks/useEnvironments";
import { SERVERS_PER_ENVIRONMENT, useChildCounts } from "@/hooks/useChildCounts";
import { useHasRole } from "@/hooks/useHasRole";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const canManage = useHasRole(["admin"]);
  const { data: project, isLoading, isError, error, refetch } = useProject(id);
  const {
    data: environments = [],
    isLoading: envsLoading,
    isError: envsError,
    error: envsErr,
    refetch: refetchEnvs,
  } = useEnvironments(id);

  const serverCounts = useChildCounts(
    environments.map((env) => env.id),
    SERVERS_PER_ENVIRONMENT
  );

  const [formOpen, setFormOpen] = useState(false);
  const [createEnvOpen, setCreateEnvOpen] = useState(false);

  // Google Drive folder breadcrumb navigation: Projects > [Project Name]
  useBreadcrumbs(
    project
      ? [
          HOME_SEGMENT,
          { label: "Projects", href: "/projects" },
          { label: project.name },
        ]
      : [HOME_SEGMENT, { label: "Projects", href: "/projects" }]
  );

  return (
    <DetailPageShell
      backTo="/projects"
      backLabel="Back to projects"
      entity={project}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      loadingMessage="Loading project..."
      notFoundMessage="This project could not be found."
      main={(project) => (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle asChild>
                  <h1>{project.name}</h1>
                </CardTitle>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline">{project.owner_status}</Badge>
                </div>
              </div>
              <RequireRole roles={["admin"]}>
                <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}>
                  Edit
                </Button>
              </RequireRole>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {project.description ?? "No description provided."}
              </p>
            </CardContent>
          </Card>

          <Tabs defaultValue="environments" className="space-y-4">
            <TabsList className="w-full justify-start border-b">
              <TabsTrigger value="environments" className="gap-2">
                <Folder className="h-4 w-4" />
                Environments
                {environments.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                    {environments.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="team" className="gap-2">
                <Users className="h-4 w-4" />
                Team & Details
              </TabsTrigger>
            </TabsList>

            <TabsContent value="environments" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Environments</h2>
                  <p className="text-xs text-muted-foreground">
                    Sub-folders and deployment environments for {project.name}
                  </p>
                </div>
                <RequireRole roles={["admin"]}>
                  <Button
                    onClick={() => setCreateEnvOpen(true)}
                    size="sm"
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    New environment
                  </Button>
                </RequireRole>
              </div>

              {envsLoading ? (
                <LoadingState message="Loading environments..." />
              ) : envsError ? (
                <ErrorState error={envsErr} onRetry={() => refetchEnvs()} />
              ) : environments.length === 0 ? (
                <EmptyState
                  title="No environments found"
                  message="This project doesn't have any environments yet. Create an environment to add servers and resources."
                  action={
                    canManage ? (
                      <Button onClick={() => setCreateEnvOpen(true)}>
                        Create environment
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                  data-testid="environments-grid"
                >
                  {environments.map((env) => {
                    const goToEnv = () => navigate(`/environments/${env.id}`);
                    return (
                      <div
                        key={env.id}
                        className="group relative flex flex-col justify-between p-4 rounded-xl border bg-card text-card-foreground shadow-sm hover:border-primary/50 hover:bg-accent/40 hover:shadow-md transition-all cursor-pointer select-none"
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${env.name} environment`}
                        onClick={goToEnv}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            goToEnv();
                          }
                        }}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20 group-hover:bg-blue-500/20 group-hover:scale-105 transition-all">
                                <Folder className="h-6 w-6 fill-blue-500/20" />
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-sm leading-tight text-foreground group-hover:text-primary transition-colors truncate block capitalize">
                                  {env.name}
                                </span>
                                <div className="mt-0.5">
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 font-normal capitalize"
                                  >
                                    {environmentStatusLabel(env.status)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          <p className="mt-3 text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                            {env.description ?? "No description provided."}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/60 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Server className="h-3.5 w-3.5 text-muted-foreground" />
                            <RelatedCount
                              result={serverCounts.get(env.id)}
                              noun="Server"
                            />
                          </div>
                          <span className="font-mono text-[11px] tabular-nums">
                            {new Date(env.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="team" forceMount className="data-[state=inactive]:hidden">
              <Card>
                <CardContent className="pt-6">
                  <ProjectRoster projectId={project.id} clientId={project.client_id} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={project} />
          <EnvironmentFormDialog
            open={createEnvOpen}
            onOpenChange={setCreateEnvOpen}
            defaultProjectId={project.id}
          />
        </div>
      )}
    />
  );
}
