import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Monitor, ShieldCheck, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyButton } from "@/components/CopyButton";
import type { Server } from "@/types";
import CredentialRefList from "./CredentialRefList";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

async function recordAccess(serverId: string, actionType: string) {
  try {
    await api.post(`/servers/${serverId}/access-log`, { action_type: actionType });
  } catch {
    // Non-blocking
  }
}

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

function accessTargetOf(server: Server): string | null {
  const host =
    server.access_host ||
    (server.username && (server.ip_address || server.hostname)
      ? `${server.username}@${server.ip_address || server.hostname}`
      : server.ip_address || server.hostname || "");

  if (!host) return null;

  return `${host}${server.access_port ? `:${server.access_port}` : ""}${
    server.access_path ?? ""
  }`;
}

function ServerCredentialsRow({ server }: { server: Server }) {
  const [showPlain, setShowPlain] = useState(false);

  const resolvedHost = server.ip_address || server.hostname || "";
  const isRdp = server.access_method === "rdp";
  const sshPortPart = server.access_port && server.access_port !== 22 ? `-p ${server.access_port} ` : "";
  const parsedUser = server.username || (server.access_host?.includes("@") ? server.access_host.split("@")[0] : "");
  const sshUserPart = parsedUser ? `${parsedUser}@` : "";
  const sshCommand = resolvedHost ? `ssh ${sshPortPart}${sshUserPart}${resolvedHost}` : "";
  const rdpPortPart = server.access_port && server.access_port !== 3389 ? `:${server.access_port}` : "";
  const rdpTarget = resolvedHost ? `${resolvedHost}${rdpPortPart}` : "";
  const rdpMstscCommand = rdpTarget ? `mstsc /v:${rdpTarget}` : "";

  if (!server.password && !sshCommand && !rdpTarget) return null;

  return (
    <div className="space-y-2">
      {/* Quick Remote Connection (SSH/RDP) */}
      {(sshCommand || rdpTarget) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2 font-mono">
            <span className="flex items-center gap-1 text-muted-foreground font-sans font-medium">
              {isRdp ? <Monitor className="h-3.5 w-3.5 text-brand" /> : <Terminal className="h-3.5 w-3.5 text-brand" />}
              <span>{isRdp ? "RDP:" : "SSH:"}</span>
            </span>
            <span className="text-foreground select-all">{isRdp ? rdpMstscCommand : sshCommand}</span>
          </div>
          <CopyButton
            value={isRdp ? rdpMstscCommand : sshCommand}
            label={isRdp ? "RDP command" : "SSH command"}
            onCopy={() => {
              recordAccess(server.id, isRdp ? "copy_rdp_command" : "copy_ssh_command");
              toast({
                title: isRdp ? "RDP command copied" : "SSH command copied",
                description: "Command copied to clipboard (logged in audit trail).",
              });
            }}
          />
        </div>
      )}

      {/* Password & Credentials row */}
      {server.password && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Password:</span>
            <span
              className="font-mono bg-muted/70 px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground select-all"
              title={showPlain ? "Plaintext password" : "Encrypted secret token"}
            >
              {showPlain
                ? server.password
                : (server.encrypted_password || "••••••••")}
            </span>
            <CopyButton
              value={server.password}
              label="password"
              onCopy={() => {
                recordAccess(server.id, "copy_password");
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
                setShowPlain((prev) => {
                  const next = !prev;
                  if (next) {
                    recordAccess(server.id, "reveal_password");
                    toast({
                      title: "Password revealed",
                      description: "Credential reveal recorded in audit log.",
                    });
                  }
                  return next;
                });
              }}
              title={showPlain ? "Hide password" : "Show password"}
              aria-label={showPlain ? "Hide password" : "Show password"}
            >
              {showPlain ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-brand" />
            <span>All password reveals and copies are recorded in audit logs.</span>
            <Link
              to={`/activity?entity_type=server&entity_id=${server.id}`}
              className="text-brand hover:underline inline-flex items-center ml-1"
            >
              Audit trail &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  servers: Server[];
}

/** Read-only server list used on InfrastructurePage and EnvironmentDetailPage. */
export default function ServerTable({ servers }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Server</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>Access</TableHead>
            <TableHead>Spec</TableHead>
            <TableHead className="text-right">Credentials</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {servers.map((server) => {
            const target = accessTargetOf(server);
            const techStack = Array.isArray(server.tech_stack) ? server.tech_stack : [];
            const open = expandedId === server.id;
            return (
              <Fragment key={server.id}>
                <TableRow className={open ? "border-b-0" : undefined}>
                  <TableCell className="font-medium">
                    <Link to={`/servers/${server.id}`} className="hover:underline">
                      {server.display_name}
                    </Link>
                    {server.hostname !== server.display_name && (
                      <div className="text-xs font-normal text-muted-foreground">
                        {server.hostname}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {server.service_type ? (
                      <Badge variant="neutral">
                        {SERVICE_TYPE_LABELS[server.service_type] ?? server.service_type}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {server.ip_address ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-mono text-sm tabular-nums">{server.ip_address}</span>
                        <CopyButton
                          value={server.ip_address}
                          label="IP address"
                          onCopy={() => recordAccess(server.id, "copy_ip_address")}
                        />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {target ? (
                      <span className="inline-flex items-center gap-1">
                        {server.access_method && (
                          <span className="text-label text-muted-foreground">
                            {ACCESS_METHOD_LABELS[server.access_method] ?? server.access_method}
                          </span>
                        )}
                        <span className="font-mono text-sm">{target}</span>
                        <CopyButton
                          value={target}
                          label="access host"
                          onCopy={() => recordAccess(server.id, "copy_access_host")}
                        />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate text-sm text-muted-foreground">
                    {server.notes ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(open ? null : server.id)}
                    >
                      {open ? "Hide" : "Show"}
                    </Button>
                  </TableCell>
                </TableRow>
                {open && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={6} className="space-y-3">
                      <ServerCredentialsRow server={server} />
                      {techStack.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {techStack.map((tech, index) => (
                            <Badge key={index} variant="secondary">
                              {String(tech)}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {server.monitoring_url && (
                        <a
                          href={server.monitoring_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-sm text-brand underline underline-offset-2"
                        >
                          Monitoring dashboard
                        </a>
                      )}
                      <CredentialRefList serverId={server.id} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
