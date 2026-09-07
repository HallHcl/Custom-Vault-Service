import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionalLabel } from "@/components/ui/optional-label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EnvironmentPicker } from "@/components/EnvironmentPicker";
import { ConflictState } from "@/components/state/ConflictState";
import { ErrorState } from "@/components/state/ErrorState";
import { LoadingState } from "@/components/state/LoadingState";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import { ApiError, apiErrorMessage } from "@/api/errors";
import { toast } from "@/hooks/use-toast";
import { useConflictResolution } from "@/hooks/useConflictResolution";
import { useCreateServer, useServer, useUpdateServer } from "@/hooks/useServers";
import { cn } from "@/lib/utils";
import { panelSurface } from "@/lib/panelSurface";

/** Verified against backend/src/validators/servers.validator.ts. */
const SERVICE_TYPES = [
  "application",
  "database",
  "proxy",
  "monitoring",
  "repository",
  "metrics",
  "jump_host",
  "other",
] as const;

const ACCESS_METHODS = ["ssh", "rdp", "telnet", "web", "other"] as const;

const SERVICE_TYPE_LABELS: Record<(typeof SERVICE_TYPES)[number], string> = {
  application: "Application",
  database: "Database",
  proxy: "Proxy",
  monitoring: "Monitoring",
  repository: "Repository",
  metrics: "Metrics",
  jump_host: "Jump host",
  other: "Other",
};

const ACCESS_METHOD_LABELS: Record<(typeof ACCESS_METHODS)[number], string> = {
  ssh: "SSH",
  rdp: "RDP",
  telnet: "Telnet",
  web: "Web",
  other: "Other",
};

interface ServerInput {
  display_name: string;
  hostname: string;
  ip_address?: string;
  service_type: (typeof SERVICE_TYPES)[number];
  access_method: (typeof ACCESS_METHODS)[number];
  access_host: string;
  access_port?: number;
  access_path?: string;
  tech_stack?: string[];
  monitoring_url?: string;
  notes?: string;
}

interface FieldErrors {
  display_name?: string;
  environment_id?: string;
  hostname?: string;
  ip_address?: string;
  service_type?: string;
  access_method?: string;
  access_host?: string;
  access_port?: string;
  access_path?: string;
  tech_stack?: string;
  monitoring_url?: string;
  notes?: string;
}

interface ValidationDetails {
  fieldErrors?: Record<string, string[]>;
}

const EDITABLE_FIELDS = [
  "display_name",
  "environment_id",
  "hostname",
  "ip_address",
  "service_type",
  "access_method",
  "access_host",
  "access_port",
  "access_path",
  "tech_stack",
  "monitoring_url",
  "notes",
] as const;

const FIELD_DOM_ORDER: ReadonlyArray<{ key: keyof FieldErrors; elementId: string }> = [
  { key: "display_name", elementId: "display_name" },
  { key: "environment_id", elementId: "environment" },
  { key: "hostname", elementId: "hostname" },
  { key: "ip_address", elementId: "ip_address" },
  { key: "tech_stack", elementId: "tech_stack" },
  { key: "service_type", elementId: "service_type" },
  { key: "access_method", elementId: "access_method" },
  { key: "access_host", elementId: "access_host" },
  { key: "access_port", elementId: "access_port" },
  { key: "access_path", elementId: "access_path" },
  { key: "monitoring_url", elementId: "monitoring_url" },
  { key: "notes", elementId: "notes" },
];

function errorId(elementId: string) {
  return `${elementId}-error`;
}

const INVALID_CONTROL = "shadow-underline-danger focus-visible:shadow-underline-danger";

export interface ServerFormPageProps {
  mode?: "create" | "edit";
}

export default function ServerFormPage({ mode: modeProp }: ServerFormPageProps) {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();

  const mode = modeProp ?? (params.id ? "edit" : "create");
  const isEdit = mode === "edit";
  const serverId = params.id;

  const {
    data: server,
    isLoading: isServerLoading,
    isError: isServerError,
    error: serverError,
    refetch: refetchServer,
  } = useServer(isEdit ? serverId : undefined);

  const createServer = useCreateServer();
  const updateServer = useUpdateServer();
  const { conflict: conflictInfo, isConflict, captureConflict, clearConflict } = useConflictResolution();

  useBreadcrumbs(
    isEdit
      ? server
        ? [
            HOME_SEGMENT,
            { label: "Servers", href: "/servers" },
            { label: server.display_name, href: `/servers/${server.id}` },
            { label: "Edit" },
          ]
        : [
            HOME_SEGMENT,
            { label: "Servers", href: "/servers" },
            { label: "Edit" },
          ]
      : [
          HOME_SEGMENT,
          { label: "Servers", href: "/servers" },
          { label: "New server" },
        ]
  );

  const [displayName, setDisplayName] = useState(server?.display_name ?? "");
  const [environmentId, setEnvironmentId] = useState<string | undefined>(server?.environment?.id);
  const [hostname, setHostname] = useState(server?.hostname ?? "");
  const [ipAddress, setIpAddress] = useState(server?.ip_address ?? "");
  const [serviceType, setServiceType] = useState<(typeof SERVICE_TYPES)[number] | undefined>(
    server?.service_type ?? undefined
  );
  const [accessMethod, setAccessMethod] = useState<(typeof ACCESS_METHODS)[number] | undefined>(
    server?.access_method ?? undefined
  );
  const [accessHost, setAccessHost] = useState(server?.access_host ?? "");
  const [accessPort, setAccessPort] = useState(server?.access_port != null ? String(server.access_port) : "");
  const [accessPath, setAccessPath] = useState(server?.access_path ?? "");
  const [techStack, setTechStack] = useState((server?.tech_stack ?? []).join(", "));
  const [monitoringUrl, setMonitoringUrl] = useState(server?.monitoring_url ?? "");
  const [notes, setNotes] = useState(server?.notes ?? "");
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(server?.updated_at);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const formRef = useRef<HTMLFormElement>(null);

  // Pre-fill form state when editing and server is loaded or re-fetched
  useEffect(() => {
    if (!isEdit || !server) return;
    setDisplayName(server.display_name);
    setEnvironmentId(server.environment.id);
    setHostname(server.hostname);
    setIpAddress(server.ip_address ?? "");
    if (server.service_type) setServiceType(server.service_type);
    if (server.access_method) setAccessMethod(server.access_method);
    setAccessHost(server.access_host);
    setAccessPort(server.access_port != null ? String(server.access_port) : "");
    setAccessPath(server.access_path ?? "");
    setTechStack((server.tech_stack ?? []).join(", "));
    setMonitoringUrl(server.monitoring_url ?? "");
    setNotes(server.notes ?? "");
    setUpdatedAt(server.updated_at);
  }, [isEdit, server]);

  function focusFirstInvalid(errors: FieldErrors) {
    const first = FIELD_DOM_ORDER.find(({ key }) => errors[key]);
    if (!first) return;
    document.getElementById(first.elementId)?.focus();
  }

  function buildInput(): ServerInput {
    return {
      display_name: displayName.trim(),
      hostname: hostname.trim(),
      ip_address: ipAddress.trim() || undefined,
      service_type: serviceType as (typeof SERVICE_TYPES)[number],
      access_method: accessMethod as (typeof ACCESS_METHODS)[number],
      access_host: accessHost.trim(),
      access_port: accessPort.trim() ? Number(accessPort) : undefined,
      access_path: accessPath.trim() || undefined,
      tech_stack: techStack
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      monitoring_url: monitoringUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    };
  }

  function applyServerError(err: unknown): void {
    const title = isEdit ? "Couldn't update server" : "Couldn't create server";

    if (!(err instanceof ApiError)) {
      setFormError("Something went wrong. Please try again.");
      toast({ title, description: apiErrorMessage(err), variant: "destructive" });
      return;
    }

    if (isEdit && err.status === 409) {
      captureConflict(err);
      return;
    }

    if (err.status === 400 && err.code === "VALIDATION_ERROR") {
      const details = err.details as ValidationDetails | undefined;
      const nextErrors: FieldErrors = {};
      for (const [field, messages] of Object.entries(details?.fieldErrors ?? {})) {
        if (messages?.length && (EDITABLE_FIELDS as readonly string[]).includes(field)) {
          nextErrors[field as keyof FieldErrors] = messages[0];
        }
      }
      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        focusFirstInvalid(nextErrors);
        toast({ title, description: "Check the highlighted fields below.", variant: "destructive" });
        return;
      }
    }

    setFormError(err.message);
    toast({ title, description: err.message, variant: "destructive" });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(undefined);

    const input = buildInput();
    const nextErrors: FieldErrors = {};

    if (!input.display_name) {
      nextErrors.display_name = "Display name is required.";
    }
    if (!isEdit && !environmentId) {
      nextErrors.environment_id = "Environment is required.";
    }
    if (!input.hostname) {
      nextErrors.hostname = "Hostname is required.";
    }
    if (!serviceType) {
      nextErrors.service_type = "Service type is required.";
    }
    if (!accessMethod) {
      nextErrors.access_method = "Access method is required.";
    }
    if (!input.access_host) {
      nextErrors.access_host = "Access host is required.";
    }
    if (accessPort.trim()) {
      const port = Number(accessPort);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        nextErrors.access_port = "Port must be a whole number between 1 and 65535.";
      }
    }
    if (accessPath.trim() && !accessPath.trim().startsWith("/")) {
      nextErrors.access_path = "Access path must start with /.";
    }
    if (monitoringUrl.trim()) {
      try {
        new URL(monitoringUrl.trim());
      } catch {
        nextErrors.monitoring_url = "Enter a valid URL.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      focusFirstInvalid(nextErrors);
      return;
    }

    if (!isEdit && !environmentId) return;

    if (isEdit) {
      if (!serverId || !updatedAt) return;
      try {
        await updateServer.mutateAsync({
          id: serverId,
          data: { ...input, updated_at: updatedAt },
        });
        toast({ title: "Server updated" });
        navigate(`/servers/${serverId}`);
      } catch (err) {
        applyServerError(err);
      }
    } else {
      try {
        await createServer.mutateAsync({
          ...input,
          environment_id: environmentId!,
        });
        toast({ title: "Server created" });
        navigate("/servers");
      } catch (err) {
        applyServerError(err);
      }
    }
  }

  async function handleReloadLatest() {
    const result = await refetchServer();
    if (result.data) {
      setDisplayName(result.data.display_name);
      setHostname(result.data.hostname);
      setIpAddress(result.data.ip_address ?? "");
      setServiceType(result.data.service_type ?? undefined);
      setAccessMethod(result.data.access_method ?? undefined);
      setAccessHost(result.data.access_host);
      setAccessPort(result.data.access_port != null ? String(result.data.access_port) : "");
      setAccessPath(result.data.access_path ?? "");
      setTechStack((result.data.tech_stack ?? []).join(", "));
      setMonitoringUrl(result.data.monitoring_url ?? "");
      setNotes(result.data.notes ?? "");
      setUpdatedAt(result.data.updated_at);
    }
    clearConflict();
  }

  async function handleRetryWithLatest() {
    if (!serverId) return;
    const result = await refetchServer();
    if (!result.data) return;

    const freshUpdatedAt = result.data.updated_at;
    setUpdatedAt(freshUpdatedAt);
    clearConflict();

    try {
      await updateServer.mutateAsync({
        id: serverId,
        data: { ...buildInput(), updated_at: freshUpdatedAt },
      });
      toast({ title: "Server updated" });
      navigate(`/servers/${serverId}`);
    } catch (err) {
      applyServerError(err);
    }
  }

  function handleCancel() {
    if (isEdit && serverId) {
      navigate(`/servers/${serverId}`);
    } else {
      navigate("/servers");
    }
  }

  const isSubmitting = createServer.isPending || updateServer.isPending;

  if (isEdit && isServerLoading) {
    return <LoadingState message="Loading server..." />;
  }

  if (isEdit && (isServerError || !server)) {
    return (
      <ErrorState
        error={serverError}
        message="This server could not be found."
        onRetry={() => refetchServer()}
      />
    );
  }

  const backHref = isEdit && serverId ? `/servers/${serverId}` : "/servers";
  const backLabel = isEdit && server ? `Back to ${server.display_name}` : isEdit ? "Back to server" : "Back to servers";

  return (
    <div className="space-y-6">
      <Link
        to={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1>{isEdit ? "Edit server" : "New server"}</h1>
          </CardTitle>
          <CardDescription>
            {isEdit
              ? "Update server configuration, tech stack, or access details."
              : "Add a new server to an environment."}
          </CardDescription>
        </CardHeader>

        {isConflict && conflictInfo && (
          <div className="p-6 pt-0">
            <ConflictState
              message={conflictInfo.message}
              onReloadLatest={handleReloadLatest}
              onKeepEditing={handleRetryWithLatest}
            />
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4">
            {formError && (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            )}

            <div className="space-y-1">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                aria-invalid={!!fieldErrors.display_name}
                aria-describedby={fieldErrors.display_name ? errorId("display_name") : undefined}
                className={cn(fieldErrors.display_name && INVALID_CONTROL)}
              />
              {fieldErrors.display_name && (
                <p id={errorId("display_name")} className="text-xs text-danger">
                  {fieldErrors.display_name}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="environment">Environment</Label>
              {isEdit && server ? (
                <>
                  <Input
                    id="environment"
                    value={server.environment.name}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    A server's environment can't be changed after creation.
                  </p>
                </>
              ) : (
                <>
                  <EnvironmentPicker
                    id="environment"
                    value={environmentId}
                    onChange={setEnvironmentId}
                    placeholder="Select an environment"
                    aria-invalid={!!fieldErrors.environment_id}
                    aria-describedby={fieldErrors.environment_id ? errorId("environment") : undefined}
                    className={cn(fieldErrors.environment_id && INVALID_CONTROL)}
                  />
                  {fieldErrors.environment_id && (
                    <p id={errorId("environment")} className="text-xs text-danger">
                      {fieldErrors.environment_id}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="hostname">Hostname</Label>
                <Input
                  id="hostname"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                  required
                  aria-invalid={!!fieldErrors.hostname}
                  aria-describedby={fieldErrors.hostname ? errorId("hostname") : undefined}
                  className={cn(fieldErrors.hostname && INVALID_CONTROL)}
                />
                {fieldErrors.hostname && (
                  <p id={errorId("hostname")} className="text-xs text-danger">
                    {fieldErrors.hostname}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <OptionalLabel htmlFor="ip_address">IP address</OptionalLabel>
                <Input
                  id="ip_address"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  aria-invalid={!!fieldErrors.ip_address}
                  aria-describedby={fieldErrors.ip_address ? errorId("ip_address") : undefined}
                  className={cn(fieldErrors.ip_address && INVALID_CONTROL)}
                />
                {fieldErrors.ip_address && (
                  <p id={errorId("ip_address")} className="text-xs text-danger">
                    {fieldErrors.ip_address}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tech_stack">Tech stack</Label>
              <Input
                id="tech_stack"
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                placeholder="e.g. node, postgres, nginx"
                aria-invalid={!!fieldErrors.tech_stack}
                aria-describedby={fieldErrors.tech_stack ? errorId("tech_stack") : undefined}
                className={cn(fieldErrors.tech_stack && INVALID_CONTROL)}
              />
              <p className="text-xs text-muted-foreground">Comma-separated.</p>
              {fieldErrors.tech_stack && (
                <p id={errorId("tech_stack")} className="text-xs text-danger">
                  {fieldErrors.tech_stack}
                </p>
              )}
            </div>

            <fieldset className={cn(panelSurface(), "space-y-4 p-3")}>
              <legend className="px-1 text-label text-muted-foreground">
                Access documentation
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="service_type">Service type</Label>
                  <Select
                    value={serviceType}
                    onValueChange={(v) => {
                      if (v) setServiceType(v as (typeof SERVICE_TYPES)[number]);
                    }}
                  >
                    <SelectTrigger
                      id="service_type"
                      aria-required="true"
                      aria-invalid={!!fieldErrors.service_type}
                      aria-describedby={fieldErrors.service_type ? errorId("service_type") : undefined}
                      className={cn(fieldErrors.service_type && INVALID_CONTROL)}
                    >
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {SERVICE_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.service_type && (
                    <p id={errorId("service_type")} className="text-xs text-danger">
                      {fieldErrors.service_type}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="access_method">Access method</Label>
                  <Select
                    value={accessMethod}
                    onValueChange={(v) => {
                      if (v) setAccessMethod(v as (typeof ACCESS_METHODS)[number]);
                    }}
                  >
                    <SelectTrigger
                      id="access_method"
                      aria-required="true"
                      aria-invalid={!!fieldErrors.access_method}
                      aria-describedby={fieldErrors.access_method ? errorId("access_method") : undefined}
                      className={cn(fieldErrors.access_method && INVALID_CONTROL)}
                    >
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {ACCESS_METHOD_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.access_method && (
                    <p id={errorId("access_method")} className="text-xs text-danger">
                      {fieldErrors.access_method}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
                <div className="space-y-1">
                  <Label htmlFor="access_host">Access host</Label>
                  <Input
                    id="access_host"
                    value={accessHost}
                    onChange={(e) => setAccessHost(e.target.value)}
                    placeholder="Hostname, IP, or anything network-resolvable"
                    required
                    aria-invalid={!!fieldErrors.access_host}
                    aria-describedby={fieldErrors.access_host ? errorId("access_host") : undefined}
                    className={cn(fieldErrors.access_host && INVALID_CONTROL)}
                  />
                  {fieldErrors.access_host && (
                    <p id={errorId("access_host")} className="text-xs text-danger">
                      {fieldErrors.access_host}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <OptionalLabel htmlFor="access_port">Port</OptionalLabel>
                  <Input
                    id="access_port"
                    type="number"
                    min={1}
                    max={65535}
                    value={accessPort}
                    onChange={(e) => setAccessPort(e.target.value)}
                    aria-invalid={!!fieldErrors.access_port}
                    aria-describedby={fieldErrors.access_port ? errorId("access_port") : undefined}
                    className={cn(fieldErrors.access_port && INVALID_CONTROL)}
                  />
                  {fieldErrors.access_port && (
                    <p id={errorId("access_port")} className="text-xs text-danger">
                      {fieldErrors.access_port}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <OptionalLabel htmlFor="access_path">Access path</OptionalLabel>
                <Input
                  id="access_path"
                  value={accessPath}
                  onChange={(e) => setAccessPath(e.target.value)}
                  placeholder={accessMethod === "web" ? "/dashboard" : "/ (optional)"}
                  aria-invalid={!!fieldErrors.access_path}
                  aria-describedby={fieldErrors.access_path ? errorId("access_path") : undefined}
                  className={cn(fieldErrors.access_path && INVALID_CONTROL)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional; must start with / if provided. Not restricted to web access — shown
                  regardless of access method so nothing is lost if you switch methods later.
                </p>
                {fieldErrors.access_path && (
                  <p id={errorId("access_path")} className="text-xs text-danger">
                    {fieldErrors.access_path}
                  </p>
                )}
              </div>
            </fieldset>

            <div className="space-y-1">
              <OptionalLabel htmlFor="monitoring_url">Monitoring URL</OptionalLabel>
              <Input
                id="monitoring_url"
                value={monitoringUrl}
                onChange={(e) => setMonitoringUrl(e.target.value)}
                placeholder="e.g. a Grafana dashboard link"
                aria-invalid={!!fieldErrors.monitoring_url}
                aria-describedby={fieldErrors.monitoring_url ? errorId("monitoring_url") : undefined}
                className={cn(fieldErrors.monitoring_url && INVALID_CONTROL)}
              />
              <p className="text-xs text-muted-foreground">
                A separate monitoring dashboard link — distinct from this server's access details
                above.
              </p>
              {fieldErrors.monitoring_url && (
                <p id={errorId("monitoring_url")} className="text-xs text-danger">
                  {fieldErrors.monitoring_url}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <OptionalLabel htmlFor="notes">Notes</OptionalLabel>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                aria-invalid={!!fieldErrors.notes}
                aria-describedby={fieldErrors.notes ? errorId("notes") : undefined}
                className={cn(fieldErrors.notes && INVALID_CONTROL)}
              />
              {fieldErrors.notes && (
                <p id={errorId("notes")} className="text-xs text-danger">
                  {fieldErrors.notes}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
