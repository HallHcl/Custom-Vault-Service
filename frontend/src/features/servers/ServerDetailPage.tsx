import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff, Monitor, ShieldCheck, Terminal } from "lucide-react";
import { RequireRole } from "@/components/auth/RequireRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailPageShell } from "@/components/DetailPageShell";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import CredentialRefList from "@/features/infrastructure/components/CredentialRefList";
import { useProject } from "@/hooks/useProjects";
import { useServer, type ServerDetail } from "@/hooks/useServers";
import { cn } from "@/lib/utils";
import { panelSurface } from "@/lib/panelSurface";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  application: "Application",
  database: "Database",
  proxy: "Proxy",
  monitoring: "Monitoring",
  repository: "Repository",
  metrics: "Metrics",
  jump_host: "Jump host",
  other: "Other",
};

const ACCESS_METHOD_LABELS: Record<string, string> = {
  ssh: "SSH",
  rdp: "RDP",
  telnet: "Telnet",
  web: "Web",
  other: "Other",
};

export default function ServerDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: server, isLoading, isError, error, refetch } = useServer(id);
  const [showPlainPassword, setShowPlainPassword] = useState(false);

  async function recordAccess(actionType: string) {
    if (!server?.id) return;
    try {
      await api.post(`/servers/${server.id}/access-log`, { action_type: actionType });
    } catch {
      // Non-blocking: audit failure should not disrupt user flow
    }
  }

  const resolvedHost = server?.ip_address || server?.hostname || "";
  const isRdp = server?.access_method === "rdp";

  const sshPortPart = server?.access_port && server.access_port !== 22 ? `-p ${server.access_port} ` : "";
  const parsedUser = server?.username || (server?.access_host?.includes("@") ? server.access_host.split("@")[0] : "");
  const sshUserPart = parsedUser ? `${parsedUser}@` : "";
  const sshCommand = resolvedHost ? `ssh ${sshPortPart}${sshUserPart}${resolvedHost}` : "";

  const rdpPortPart = server?.access_port && server.access_port !== 3389 ? `:${server.access_port}` : "";
  const rdpTarget = resolvedHost ? `${resolvedHost}${rdpPortPart}` : "";
  const rdpMstscCommand = rdpTarget ? `mstsc /v:${rdpTarget}` : "";

  // ServerDetail only embeds environment.project as { id, name }, so the
  // Client segment is backfilled by a separate useProject fetch (cache-shared
  // with ProjectDetailPage). useProject already guards on `Boolean(id)`, so a
  // possibly-undefined project id is safe. Until it resolves — or if the
  // project is soft-deleted and the fetch 404s (`data` stays undefined, never
  // throws) — the trail simply omits the Client segment, same as the loading
  // fallback below.
  const { data: project } = useProject(server?.environment.project.id);
  useBreadcrumbs(
    server
      ? [
          HOME_SEGMENT,
          ...(project?.client
            ? [
                { label: "Clients", href: "/clients" },
                {
                  label: project.client.name,
                  href: `/clients/${project.client.id}`,
                },
              ]
            : []),
          { label: "Projects", href: "/projects" },
          {
            label: server.environment.project.name,
            href: `/projects/${server.environment.project.id}`,
          },
          { label: "Environments", href: "/environments" },
          { label: server.environment.name, href: `/environments/${server.environment.id}` },
          { label: "Servers", href: "/servers" },
          { label: server.display_name },
        ]
      : [HOME_SEGMENT, { label: "Servers", href: "/servers" }]
  );

  return (
    <DetailPageShell<ServerDetail>
      backTo="/servers"
      backLabel="Back to servers"
      entity={server}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      loadingMessage="Loading server..."
      notFoundMessage="This server could not be found."
      main={(server) => (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle asChild>
                  <h1>{server.display_name}</h1>
                </CardTitle>
                {server.deleted_at && <Badge variant="neutral">Deleted</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{server.hostname}</p>
            </div>
            <RequireRole roles={["admin", "member"]}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/servers/${server.id}/edit`)}
              >
                Edit
              </Button>
            </RequireRole>
          </CardHeader>
          <CardContent className="space-y-4">
            {server.ip_address && (
                  <div>
                    <span className="text-label text-muted-foreground">
                      IP address
                    </span>
                    <p className="flex items-center gap-1 text-sm">
                      <span className="font-mono">{server.ip_address}</span>
                      <CopyButton value={server.ip_address} label="IP address" />
                    </p>
                  </div>
                )}

                {server.tech_stack.length > 0 && (
                  <div>
                    <span className="text-label text-muted-foreground">
                      Tech stack
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {server.tech_stack.map((tech, index) => (
                        <Badge key={index} variant="secondary">
                          {String(tech)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className={cn(panelSurface(), "p-3")}>
                  <p className="mb-2 text-label text-muted-foreground">
                    Access documentation
                  </p>
                  {/* Single column until sm, two above it. This block used to
                      be flatly grid-cols-2 while the page was one 992px-wide
                      column, which stranded each value ~450px from its
                      neighbour. In the shell's ~590px main column two columns
                      read as a pair; below sm they would only crush long
                      hostnames, so they stack. */}
                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Service type</dt>
                      <dd>{server.service_type ? (SERVICE_TYPE_LABELS[server.service_type] ?? server.service_type) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Access method</dt>
                      <dd>{server.access_method ? ACCESS_METHOD_LABELS[server.access_method] : "—"}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Username</dt>
                      <dd className="flex items-center gap-1 break-words">
                        {server.username || "—"}
                        {server.username && (
                          <CopyButton
                            value={server.username}
                            label="username"
                            onCopy={() => recordAccess("copy_username")}
                          />
                        )}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Password</dt>
                      <dd className="flex items-center gap-1.5 break-words">
                        {server.password ? (
                          <>
                            <span
                              className="font-mono text-xs bg-muted/70 px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground select-all"
                              title={showPlainPassword ? "Plaintext password" : "Encrypted secret token"}
                            >
                              {showPlainPassword
                                ? server.password
                                : (server.encrypted_password || "••••••••")}
                            </span>
                            <CopyButton
                              value={server.password}
                              label="password"
                              onCopy={() => {
                                recordAccess("copy_password");
                                toast({
                                  title: "Password copied",
                                  description: "Credential copy recorded in audit log.",
                                });
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setShowPlainPassword((prev) => {
                                  const next = !prev;
                                  if (next) {
                                    recordAccess("reveal_password");
                                    toast({
                                      title: "Password revealed",
                                      description: "Credential reveal recorded in audit log.",
                                    });
                                  }
                                  return next;
                                });
                              }}
                              title={showPlainPassword ? "Hide password" : "Show password"}
                              aria-label={showPlainPassword ? "Hide password" : "Show password"}
                            >
                              {showPlainPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Port</dt>
                      <dd>{server.access_port ?? "—"}</dd>
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Access path</dt>
                      <dd className="break-words">{server.access_path ?? "—"}</dd>
                    </div>
                  </dl>

                  {/* One-Click Remote Connection widget */}
                  {(sshCommand || rdpTarget) && (
                    <div className={cn("mt-3 rounded border border-brand/20 bg-brand/5 p-3 space-y-2")}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          {isRdp ? <Monitor className="h-3.5 w-3.5 text-brand" /> : <Terminal className="h-3.5 w-3.5 text-brand" />}
                          <span>{isRdp ? "Remote Desktop Connection (RDP)" : "One-Click Remote Connection (SSH)"}</span>
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                          {isRdp ? "RDP Session" : "SSH Terminal"}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between gap-2 bg-background/90 rounded border border-border/80 px-2.5 py-1.5 font-mono text-xs text-foreground select-all">
                        <span className="truncate">{isRdp ? rdpMstscCommand : sshCommand}</span>
                        <CopyButton
                          value={isRdp ? rdpMstscCommand : sshCommand}
                          label={isRdp ? "RDP command" : "SSH command"}
                          onCopy={() => {
                            recordAccess(isRdp ? "copy_rdp_command" : "copy_ssh_command");
                            toast({
                              title: isRdp ? "RDP command copied" : "SSH command copied",
                              description: "Command copied to clipboard (logged in audit trail).",
                            });
                          }}
                        />
                      </div>

                      {isRdp && (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-0.5">
                          <span>Target Host: <span className="font-mono text-foreground select-all">{rdpTarget}</span></span>
                          {server.username && (
                            <span>User: <span className="font-mono text-foreground select-all">{server.username}</span></span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audit disclaimer notice with link to audit trail */}
                  <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-brand" />
                      <span>All credential reveals and copies are recorded in the audit log.</span>
                    </span>
                    <Link
                      to={`/activity?entity_type=server&entity_id=${server.id}`}
                      className="text-brand hover:underline inline-flex items-center gap-0.5 shrink-0"
                    >
                      View audit trail &rarr;
                    </Link>
                  </div>
                </div>

                {server.monitoring_url && (
                  <div>
                    <span className="text-label text-muted-foreground">
                      Monitoring
                    </span>
                    <p>
                      <a
                        href={server.monitoring_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-brand underline underline-offset-2"
                      >
                        Monitoring dashboard
                      </a>
                    </p>
                  </div>
                )}

                {server.notes && (
                  <div>
                    <span className="text-label text-muted-foreground">
                      Notes
                    </span>
                    <p className="text-sm text-muted-foreground">{server.notes}</p>
                  </div>
                )}
          </CardContent>
        </Card>
      )}
      aside={(server) => (
        <Card>
          <CardHeader>
            <CardTitle>Credential references</CardTitle>
          </CardHeader>
          <CardContent>
            {/* manageable: this is the management surface for credential
                references (create/edit/delete, Part 23d). ServerCard's
                embedding on InfrastructurePage/EnvironmentDetailPage stays
                read-only (manageable defaults to false there) — those are
                browse/overview surfaces, not management surfaces. */}
            <CredentialRefList serverId={server.id} manageable />
          </CardContent>
        </Card>
      )}
    />
  );
}
