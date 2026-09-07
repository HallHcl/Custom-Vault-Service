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
import { ProjectPicker } from "@/components/ProjectPicker";
import { ServerPicker } from "@/components/ServerPicker";
import { ConflictState } from "@/components/state/ConflictState";
import { ErrorState } from "@/components/state/ErrorState";
import { LoadingState } from "@/components/state/LoadingState";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import { ApiError, apiErrorMessage } from "@/api/errors";
import { toast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/useClients";
import { useConflictResolution } from "@/hooks/useConflictResolution";
import {
  EXPIRATION_STATUSES,
  EXPIRATION_TYPES,
  useCreateExpiration,
  useExpiration,
  useUpdateExpiration,
  type ExpirationStatus,
  type ExpirationType,
} from "@/hooks/useExpirations";
import { cn } from "@/lib/utils";

export const EXPIRATION_TYPE_LABELS: Record<ExpirationType, string> = {
  ssl_certificate: "SSL Certificate",
  hardware_ma: "Hardware MA",
  software_license: "Software License",
  warranty: "Warranty",
  domain_or_cloud: "Domain / Cloud Renewal",
};

export const EXPIRATION_STATUS_LABELS: Record<ExpirationStatus, string> = {
  active: "Active",
  renewed: "Renewed",
  expired: "Expired",
};

interface FieldErrors {
  name?: string;
  client_id?: string;
  type?: string;
  expiry_date?: string;
  alert_threshold_days?: string;
  status?: string;
  identifier?: string;
  provider_or_vendor?: string;
  project_id?: string;
  server_id?: string;
  notes?: string;
}

interface ValidationDetails {
  fieldErrors?: Record<string, string[]>;
}

const FIELD_DOM_ORDER: ReadonlyArray<{ key: keyof FieldErrors; elementId: string }> = [
  { key: "name", elementId: "name" },
  { key: "client_id", elementId: "client" },
  { key: "type", elementId: "type" },
  { key: "expiry_date", elementId: "expiry_date" },
  { key: "alert_threshold_days", elementId: "alert_threshold_days" },
  { key: "status", elementId: "status" },
  { key: "identifier", elementId: "identifier" },
  { key: "provider_or_vendor", elementId: "provider_or_vendor" },
  { key: "project_id", elementId: "project" },
  { key: "server_id", elementId: "server" },
  { key: "notes", elementId: "notes" },
];

function errorId(elementId: string) {
  return `${elementId}-error`;
}

const INVALID_CONTROL = "shadow-underline-danger focus-visible:shadow-underline-danger";

export interface ExpirationFormPageProps {
  mode?: "create" | "edit";
}

export default function ExpirationFormPage({ mode: modeProp }: ExpirationFormPageProps) {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();

  const mode = modeProp ?? (params.id ? "edit" : "create");
  const isEdit = mode === "edit";
  const expirationId = params.id;

  const {
    data: expiration,
    isLoading: isExpirationLoading,
    isError: isExpirationError,
    error: expirationError,
    refetch: refetchExpiration,
  } = useExpiration(isEdit ? expirationId : undefined);

  const { data: clients = [] } = useClients();
  const createExpiration = useCreateExpiration();
  const updateExpiration = useUpdateExpiration();
  const { conflict: conflictInfo, isConflict, captureConflict, clearConflict } = useConflictResolution();

  useBreadcrumbs(
    isEdit
      ? expiration
        ? [
            HOME_SEGMENT,
            { label: "Expirations", href: "/expirations" },
            { label: expiration.name },
            { label: "Edit" },
          ]
        : [
            HOME_SEGMENT,
            { label: "Expirations", href: "/expirations" },
            { label: "Edit" },
          ]
      : [
          HOME_SEGMENT,
          { label: "Expirations", href: "/expirations" },
          { label: "New expiration" },
        ]
  );

  const [name, setName] = useState(expiration?.name ?? "");
  const [clientId, setClientId] = useState<string | undefined>(expiration?.client_id);
  const [projectId, setProjectId] = useState<string | undefined>(expiration?.project_id ?? undefined);
  const [serverId, setServerId] = useState<string | undefined>(expiration?.server_id ?? undefined);
  const [type, setType] = useState<ExpirationType>(expiration?.type ?? "ssl_certificate");
  const [status, setStatus] = useState<ExpirationStatus>(expiration?.status ?? "active");
  const [expiryDate, setExpiryDate] = useState(expiration?.expiry_date ? expiration.expiry_date.slice(0, 10) : "");
  const [alertThresholdDays, setAlertThresholdDays] = useState(
    expiration?.alert_threshold_days != null ? String(expiration.alert_threshold_days) : "30"
  );
  const [identifier, setIdentifier] = useState(expiration?.identifier ?? "");
  const [providerOrVendor, setProviderOrVendor] = useState(expiration?.provider_or_vendor ?? "");
  const [notes, setNotes] = useState(expiration?.notes ?? "");
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(expiration?.updated_at);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isEdit || !expiration) return;
    setName(expiration.name);
    setClientId(expiration.client_id);
    setProjectId(expiration.project_id ?? undefined);
    setServerId(expiration.server_id ?? undefined);
    setType(expiration.type);
    setStatus(expiration.status);
    setExpiryDate(expiration.expiry_date.slice(0, 10));
    setAlertThresholdDays(String(expiration.alert_threshold_days));
    setIdentifier(expiration.identifier ?? "");
    setProviderOrVendor(expiration.provider_or_vendor ?? "");
    setNotes(expiration.notes ?? "");
    setUpdatedAt(expiration.updated_at);
  }, [isEdit, expiration]);

  function focusFirstInvalid(errors: FieldErrors) {
    const first = FIELD_DOM_ORDER.find(({ key }) => errors[key]);
    if (!first) return;
    document.getElementById(first.elementId)?.focus();
  }

  function applyServerError(err: unknown): void {
    const title = isEdit ? "Couldn't update expiration" : "Couldn't create expiration";

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
        if (messages?.length) {
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

    const nextErrors: FieldErrors = {};

    if (!name.trim()) {
      nextErrors.name = "Name is required.";
    }
    if (!clientId) {
      nextErrors.client_id = "Client is required.";
    }
    if (!type) {
      nextErrors.type = "Type is required.";
    }
    if (!expiryDate.trim()) {
      nextErrors.expiry_date = "Expiry date is required.";
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate.trim())) {
      nextErrors.expiry_date = "Date must be in YYYY-MM-DD format.";
    }

    if (alertThresholdDays.trim()) {
      const parsedDays = Number(alertThresholdDays);
      if (!Number.isInteger(parsedDays) || parsedDays < 1) {
        nextErrors.alert_threshold_days = "Threshold must be a whole number greater than 0.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      focusFirstInvalid(nextErrors);
      return;
    }

    if (!clientId) return;

    const threshold = alertThresholdDays.trim() ? Number(alertThresholdDays) : 30;

    if (isEdit) {
      if (!expirationId || !updatedAt) return;
      try {
        await updateExpiration.mutateAsync({
          id: expirationId,
          data: {
            name: name.trim(),
            client_id: clientId,
            project_id: projectId || null,
            server_id: serverId || null,
            type,
            status,
            expiry_date: expiryDate.trim(),
            alert_threshold_days: threshold,
            identifier: identifier.trim() || null,
            provider_or_vendor: providerOrVendor.trim() || null,
            notes: notes.trim() || null,
            updated_at: updatedAt,
          },
        });
        toast({ title: "Expiration updated" });
        navigate("/expirations");
      } catch (err) {
        applyServerError(err);
      }
    } else {
      try {
        await createExpiration.mutateAsync({
          name: name.trim(),
          client_id: clientId,
          project_id: projectId || null,
          server_id: serverId || null,
          type,
          status,
          expiry_date: expiryDate.trim(),
          alert_threshold_days: threshold,
          identifier: identifier.trim() || null,
          provider_or_vendor: providerOrVendor.trim() || null,
          notes: notes.trim() || null,
        });
        toast({ title: "Expiration created" });
        navigate("/expirations");
      } catch (err) {
        applyServerError(err);
      }
    }
  }

  async function handleReloadLatest() {
    const result = await refetchExpiration();
    if (result.data) {
      setName(result.data.name);
      setClientId(result.data.client_id);
      setProjectId(result.data.project_id ?? undefined);
      setServerId(result.data.server_id ?? undefined);
      setType(result.data.type);
      setStatus(result.data.status);
      setExpiryDate(result.data.expiry_date.slice(0, 10));
      setAlertThresholdDays(String(result.data.alert_threshold_days));
      setIdentifier(result.data.identifier ?? "");
      setProviderOrVendor(result.data.provider_or_vendor ?? "");
      setNotes(result.data.notes ?? "");
      setUpdatedAt(result.data.updated_at);
    }
    clearConflict();
  }

  async function handleRetryWithLatest() {
    if (!expirationId) return;
    const result = await refetchExpiration();
    if (!result.data) return;

    const freshUpdatedAt = result.data.updated_at;
    setUpdatedAt(freshUpdatedAt);
    clearConflict();

    const threshold = alertThresholdDays.trim() ? Number(alertThresholdDays) : 30;

    try {
      await updateExpiration.mutateAsync({
        id: expirationId,
        data: {
          name: name.trim(),
          client_id: clientId,
          project_id: projectId || null,
          server_id: serverId || null,
          type,
          status,
          expiry_date: expiryDate.trim(),
          alert_threshold_days: threshold,
          identifier: identifier.trim() || null,
          provider_or_vendor: providerOrVendor.trim() || null,
          notes: notes.trim() || null,
          updated_at: freshUpdatedAt,
        },
      });
      toast({ title: "Expiration updated" });
      navigate("/expirations");
    } catch (err) {
      applyServerError(err);
    }
  }

  function handleCancel() {
    navigate("/expirations");
  }

  const isSubmitting = createExpiration.isPending || updateExpiration.isPending;

  if (isEdit && isExpirationLoading) {
    return <LoadingState message="Loading expiration..." />;
  }

  if (isEdit && (isExpirationError || !expiration)) {
    return (
      <ErrorState
        error={expirationError}
        message="This expiration record could not be found."
        onRetry={() => refetchExpiration()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/expirations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to expirations
      </Link>

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1>{isEdit ? "Edit expiration" : "New expiration"}</h1>
          </CardTitle>
          <CardDescription>
            {isEdit
              ? "Update expiration date, threshold, or contract lifecycle details."
              : "Track a new SSL certificate, hardware MA, software license, warranty, or cloud renewal."}
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
          <CardContent className="space-y-6">
            {formError && <p className="text-sm text-danger">{formError}</p>}

            {/* Name & Type */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Primary Wildcard SSL"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? errorId("name") : undefined}
                  className={cn(fieldErrors.name && INVALID_CONTROL)}
                  required
                />
                {fieldErrors.name && (
                  <p id={errorId("name")} className="text-xs text-danger">
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={type}
                  onValueChange={(v) => {
                    if (v) setType(v as ExpirationType);
                  }}
                >
                  <SelectTrigger
                    id="type"
                    aria-label="Type"
                    aria-invalid={Boolean(fieldErrors.type)}
                    aria-describedby={fieldErrors.type ? errorId("type") : undefined}
                    className={cn(fieldErrors.type && INVALID_CONTROL)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRATION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {EXPIRATION_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.type && (
                  <p id={errorId("type")} className="text-xs text-danger">
                    {fieldErrors.type}
                  </p>
                )}
              </div>
            </div>

            {/* Expiry Date, Alert Threshold & Status */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="expiry_date">Expiry date</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.expiry_date)}
                  aria-describedby={fieldErrors.expiry_date ? errorId("expiry_date") : undefined}
                  className={cn(fieldErrors.expiry_date && INVALID_CONTROL)}
                  required
                />
                {fieldErrors.expiry_date && (
                  <p id={errorId("expiry_date")} className="text-xs text-danger">
                    {fieldErrors.expiry_date}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="alert_threshold_days">
                  Alert threshold (days) <OptionalLabel />
                </Label>
                <Input
                  id="alert_threshold_days"
                  type="number"
                  min={1}
                  value={alertThresholdDays}
                  onChange={(e) => setAlertThresholdDays(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.alert_threshold_days)}
                  aria-describedby={fieldErrors.alert_threshold_days ? errorId("alert_threshold_days") : undefined}
                  className={cn(fieldErrors.alert_threshold_days && INVALID_CONTROL)}
                  placeholder="30"
                />
                {fieldErrors.alert_threshold_days && (
                  <p id={errorId("alert_threshold_days")} className="text-xs text-danger">
                    {fieldErrors.alert_threshold_days}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => {
                    if (v) setStatus(v as ExpirationStatus);
                  }}
                >
                  <SelectTrigger id="status" aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRATION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {EXPIRATION_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Provider & Identifier */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="identifier">
                  Identifier / Domain <OptionalLabel />
                </Label>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. *.example.com or CONTRACT-2026-99"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="provider_or_vendor">
                  Provider / Vendor <OptionalLabel />
                </Label>
                <Input
                  id="provider_or_vendor"
                  value={providerOrVendor}
                  onChange={(e) => setProviderOrVendor(e.target.value)}
                  placeholder="e.g. DigiCert, AWS, Dell, Microsoft"
                />
              </div>
            </div>

            {/* Associated Client, Project & Server */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="client">Client</Label>
                <Select
                  value={clientId}
                  onValueChange={(val) => {
                    if (val) {
                      setClientId(val);
                      setProjectId(undefined);
                      setServerId(undefined);
                    }
                  }}
                >
                  <SelectTrigger
                    id="client"
                    aria-label="Client"
                    aria-invalid={Boolean(fieldErrors.client_id)}
                    aria-describedby={fieldErrors.client_id ? errorId("client") : undefined}
                    className={cn(fieldErrors.client_id && INVALID_CONTROL)}
                  >
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.client_id && (
                  <p id={errorId("client")} className="text-xs text-danger">
                    {fieldErrors.client_id}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="project">
                  Project <OptionalLabel />
                </Label>
                <ProjectPicker
                  id="project"
                  value={projectId}
                  clientId={clientId}
                  onChange={(val) => {
                    setProjectId(val);
                    setServerId(undefined);
                  }}
                  placeholder="Select a project"
                  includeAllOption={false}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="server">
                  Server <OptionalLabel />
                </Label>
                <ServerPicker
                  id="server"
                  value={serverId}
                  projectId={projectId}
                  onChange={setServerId}
                  placeholder="Select a server"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label htmlFor="notes">
                Notes <OptionalLabel />
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contract renewal steps, purchase order number, escalation contacts..."
                rows={3}
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-between border-t border-border pt-6">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Create expiration"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
