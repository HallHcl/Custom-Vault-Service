import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { format } from "date-fns";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { useConflictResolution } from "@/hooks/useConflictResolution";
import { usePeople } from "@/hooks/usePeople";
import { parseScheduledDate, useCreateSchedule, useSchedule, useUpdateSchedule } from "@/hooks/useSchedules";
import { cn } from "@/lib/utils";
import { panelSurface } from "@/lib/panelSurface";
import type { ScheduleStatus, ScheduleType } from "@/types";

const SCHEDULE_TYPES: ScheduleType[] = ["PM", "MA", "other"];

/**
 * Upper bound on `notes`, mirroring the backend's SCHEDULE_NOTES_MAX_LENGTH
 * (schedules.validator.ts) with the identical message, so the user sees the
 * same text whether the client or the server rejects it. Exported so the
 * tests assert against the real limit rather than a copy of the number.
 */
export const SCHEDULE_NOTES_MAX_LENGTH = 2000;

/**
 * One key per validated field, plus `parent` for the Project/Server
 * cross-field rule, which belongs to the *pair* rather than to either
 * control. Same flat shape as ServerFormPage's FieldErrors.
 */
interface FieldErrors {
  title?: string;
  type?: string;
  scheduled_date?: string;
  assigned_to?: string;
  project_id?: string;
  server_id?: string;
  parent?: string;
  notes?: string;
}

/**
 * Fields in render order, for "focus the first invalid one". Create mode
 * only: edit mode has exactly one validated field (notes) and focuses it
 * directly, so it needs no order at all. `parent` maps to the Server picker
 * — the message renders beneath that control, so that is where focus goes.
 */
const FIELD_DOM_ORDER_CREATE: ReadonlyArray<{ key: keyof FieldErrors; elementId: string }> = [
  { key: "title", elementId: "title" },
  { key: "type", elementId: "type" },
  { key: "scheduled_date", elementId: "date" },
  { key: "assigned_to", elementId: "assignedTo" },
  { key: "project_id", elementId: "project" },
  { key: "server_id", elementId: "server" },
  { key: "parent", elementId: "server" },
  { key: "notes", elementId: "notes" },
];

/** `aria-describedby` target for a field's error text. */
function errorId(elementId: string) {
  return `${elementId}-error`;
}

/** Danger underline on an invalid control. */
const INVALID_CONTROL = "shadow-underline-danger focus-visible:shadow-underline-danger";

/**
 * The only rule that applies in BOTH modes — notes is the sole editable
 * field in edit mode, and an optional one in create mode.
 */
function validateNotes(value: string): string | undefined {
  if (value.trim().length > SCHEDULE_NOTES_MAX_LENGTH) {
    return `Notes must be ${SCHEDULE_NOTES_MAX_LENGTH} characters or less.`;
  }
  return undefined;
}

const STATUS_VARIANT: Record<
  ScheduleStatus,
  "success" | "info" | "warning" | "neutral"
> = {
  done: "success",
  in_progress: "info",
  pending: "warning",
  cancelled: "neutral",
};

interface Props {
  mode: "create" | "edit";
}

export default function ScheduleFormPage({ mode }: Props) {
  const isEdit = mode === "edit";
  const { id: scheduleId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: people = [] } = usePeople();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();

  // In edit mode, supplies the assignee/project/server display names for the
  // read-only fields, and enables the 409 refetch path.
  const {
    data: scheduleDetail,
    isLoading: isScheduleLoading,
    isError: isScheduleError,
    error: scheduleError,
    refetch: refetchSchedule,
  } = useSchedule(isEdit ? scheduleId : undefined);

  const { conflict: conflictInfo, isConflict, captureConflict, clearConflict } =
    useConflictResolution();

  // ---------------------------------------------------------------------------
  // Create-only fields — immutable after creation (backend PATCH has no fields
  // for them). Edit mode reads directly from scheduleDetail.
  // ---------------------------------------------------------------------------
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ScheduleType>("PM");
  const [scheduledDate, setScheduledDate] = useState("");
  const [assignedTo, setAssignedTo] = useState<string | undefined>(undefined);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [serverId, setServerId] = useState<string | undefined>(undefined);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // ---------------------------------------------------------------------------
  // Edit-mode tracked state — can change server-side via status transitions
  // while this page is open; refreshed on 409 reload/retry.
  // ---------------------------------------------------------------------------
  const [status, setStatus] = useState<ScheduleStatus>("pending");
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);

  const formRef = useRef<HTMLFormElement>(null);

  // Seed edit-mode state from fetched schedule
  useEffect(() => {
    if (!isEdit || !scheduleDetail) return;
    setStatus(scheduleDetail.status);
    setStartedAt(scheduleDetail.started_at);
    setCompletedAt(scheduleDetail.completed_at);
    setNotes(scheduleDetail.notes ?? "");
    setUpdatedAt(scheduleDetail.updated_at);
    setFieldErrors({});
    clearConflict();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, scheduleDetail]);

  // Set up breadcrumbs
  useBreadcrumbs(
    isEdit && scheduleDetail
      ? [
          HOME_SEGMENT,
          { label: "Schedule", href: "/schedule" },
          { label: scheduleDetail.title, href: "/schedule" },
          { label: "Edit" },
        ]
      : isEdit
        ? [HOME_SEGMENT, { label: "Schedule", href: "/schedule" }, { label: "Edit" }]
        : [HOME_SEGMENT, { label: "Schedule", href: "/schedule" }, { label: "New schedule" }]
  );

  function focusFirstInvalid(errors: FieldErrors) {
    const first = FIELD_DOM_ORDER_CREATE.find(({ key }) => errors[key]);
    if (!first) return;
    document.getElementById(first.elementId)?.focus();
  }

  function handleProjectChange(next: string | undefined) {
    setProjectId(next);
    setServerId(undefined);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (isEdit) {
      // Edit mode: only notes is editable and validated.
      const notesError = validateNotes(notes);
      if (notesError) {
        setFieldErrors({ notes: notesError });
        document.getElementById("notes")?.focus();
        return;
      }
      setFieldErrors({});
    } else {
      const nextErrors: FieldErrors = {};
      if (!title.trim()) nextErrors.title = "Title is required.";
      if (!type) nextErrors.type = "Type is required.";
      if (!scheduledDate) nextErrors.scheduled_date = "Date is required.";
      if (!assignedTo) nextErrors.assigned_to = "Assignee is required.";
      if (!projectId && !serverId) {
        nextErrors.parent = "Select a Project, a Server, or both.";
      }
      const notesError = validateNotes(notes);
      if (notesError) nextErrors.notes = notesError;

      if (Object.keys(nextErrors).length > 0) {
        setFieldErrors(nextErrors);
        focusFirstInvalid(nextErrors);
        return;
      }
      setFieldErrors({});
    }

    try {
      if (isEdit && scheduleId) {
        await updateSchedule.mutateAsync({
          id: scheduleId,
          data: { notes: notes || undefined, updated_at: updatedAt ?? scheduleDetail!.updated_at },
        });
        toast({ title: "Schedule updated" });
        navigate("/schedule");
      } else {
        if (!assignedTo) return;
        await createSchedule.mutateAsync({
          title,
          type,
          scheduled_date: scheduledDate,
          assigned_to: assignedTo,
          project_id: projectId,
          server_id: serverId,
          notes: notes || undefined,
        });
        toast({ title: "Schedule created" });
        navigate("/schedule");
      }
    } catch (err) {
      if (err instanceof ApiError && captureConflict(err)) return;
      toast({
        title: isEdit ? "Couldn't update schedule" : "Couldn't create schedule",
        description: apiErrorMessage(err),
        variant: "destructive",
      });
    }
  }

  async function handleReloadLatest() {
    const result = await refetchSchedule();
    if (result.data) {
      setStatus(result.data.status);
      setStartedAt(result.data.started_at);
      setCompletedAt(result.data.completed_at);
      setNotes(result.data.notes ?? "");
      setUpdatedAt(result.data.updated_at);
    }
    clearConflict();
  }

  async function handleKeepEditingAndRetry() {
    const result = await refetchSchedule();
    if (!result.data || !scheduleId) return;

    const freshUpdatedAt = result.data.updated_at;
    setStatus(result.data.status);
    setStartedAt(result.data.started_at);
    setCompletedAt(result.data.completed_at);
    setUpdatedAt(freshUpdatedAt);
    clearConflict();

    try {
      await updateSchedule.mutateAsync({
        id: scheduleId,
        data: { notes: notes || undefined, updated_at: freshUpdatedAt },
      });
      toast({ title: "Schedule updated" });
      navigate("/schedule");
    } catch (err) {
      if (err instanceof ApiError && captureConflict(err)) return;
      toast({
        title: "Couldn't update schedule",
        description: apiErrorMessage(err),
        variant: "destructive",
      });
    }
  }

  function handleCancel() {
    navigate("/schedule");
  }

  const isSubmitting = createSchedule.isPending || updateSchedule.isPending;

  // Loading / error guards for edit mode
  if (isEdit && isScheduleLoading) {
    return <LoadingState message="Loading schedule..." />;
  }
  if (isEdit && (isScheduleError || !scheduleDetail)) {
    return (
      <ErrorState
        error={scheduleError}
        message="This schedule could not be found."
        onRetry={() => refetchSchedule()}
      />
    );
  }

  // Display names for read-only edit fields
  const assigneeName = isEdit
    ? (scheduleDetail?.assigned_to_person?.name ?? people.find((p) => p.id === scheduleDetail?.assigned_to)?.name ?? "—")
    : undefined;
  const projectName = isEdit
    ? (scheduleDetail?.project_id ? (scheduleDetail?.project?.name ?? "—") : "—")
    : undefined;
  const serverName = isEdit && scheduleDetail?.server_id ? (scheduleDetail?.server?.name ?? "—") : undefined;
  const cancelledAfterStarting = status === "cancelled" && Boolean(startedAt);

  const pageTitle = isEdit ? "Edit schedule" : "New schedule";
  const pageDescription = isEdit
    ? "Update this schedule's notes. Every other field is fixed after creation."
    : "Schedule a new visit against a project, a server, or both.";

  return (
    <div className="space-y-6">
      <Link
        to="/schedule"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {isEdit && scheduleDetail ? `Back to ${scheduleDetail.title}` : "Back to schedule"}
      </Link>

      <Card className={panelSurface()}>
        {isConflict ? (
          <>
            <CardHeader>
              <CardTitle asChild>
                <h1>{pageTitle}</h1>
              </CardTitle>
              <CardDescription>{pageDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <ConflictState
                message={
                  conflictInfo?.message ??
                  "This record was changed by someone else since you loaded it."
                }
                onReloadLatest={handleReloadLatest}
                onKeepEditing={handleKeepEditingAndRetry}
              />
            </CardContent>
          </>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            <CardHeader>
              <CardTitle asChild>
                <h1>{pageTitle}</h1>
              </CardTitle>
              <CardDescription>{pageDescription}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <Label htmlFor="title">Title</Label>
                {isEdit ? (
                  <Input id="title" value={scheduleDetail?.title ?? ""} disabled readOnly />
                ) : (
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    aria-invalid={!!fieldErrors.title}
                    aria-describedby={fieldErrors.title ? errorId("title") : undefined}
                    className={cn(fieldErrors.title && INVALID_CONTROL)}
                  />
                )}
                {!isEdit && fieldErrors.title && (
                  <p id={errorId("title")} className="text-xs text-danger">
                    {fieldErrors.title}
                  </p>
                )}
              </div>

              {/* Type + Date row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="type">Type</Label>
                  {isEdit ? (
                    <Input id="type" value={scheduleDetail?.type ?? ""} disabled readOnly />
                  ) : (
                    <Select value={type} onValueChange={(v) => setType(v as ScheduleType)}>
                      <SelectTrigger
                        id="type"
                        aria-required="true"
                        aria-invalid={!!fieldErrors.type}
                        aria-describedby={fieldErrors.type ? errorId("type") : undefined}
                        className={cn(fieldErrors.type && INVALID_CONTROL)}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCHEDULE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!isEdit && fieldErrors.type && (
                    <p id={errorId("type")} className="text-xs text-danger">
                      {fieldErrors.type}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="date">Date</Label>
                  {isEdit ? (
                    <Input
                      id="date"
                      value={
                        scheduleDetail
                          ? format(parseScheduledDate(scheduleDetail.scheduled_date), "PP")
                          : ""
                      }
                      disabled
                      readOnly
                    />
                  ) : (
                    <Input
                      id="date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      required
                      aria-invalid={!!fieldErrors.scheduled_date}
                      aria-describedby={fieldErrors.scheduled_date ? errorId("date") : undefined}
                      className={cn(fieldErrors.scheduled_date && INVALID_CONTROL)}
                    />
                  )}
                  {!isEdit && fieldErrors.scheduled_date && (
                    <p id={errorId("date")} className="text-xs text-danger">
                      {fieldErrors.scheduled_date}
                    </p>
                  )}
                </div>
              </div>

              {/* Assigned to + Project row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="assignedTo">Assigned to</Label>
                  {isEdit ? (
                    <Input id="assignedTo" value={assigneeName} disabled readOnly />
                  ) : (
                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                      <SelectTrigger
                        id="assignedTo"
                        aria-required="true"
                        aria-invalid={!!fieldErrors.assigned_to}
                        aria-describedby={
                          fieldErrors.assigned_to ? errorId("assignedTo") : undefined
                        }
                        className={cn(fieldErrors.assigned_to && INVALID_CONTROL)}
                      >
                        <SelectValue placeholder="Select person" />
                      </SelectTrigger>
                      <SelectContent>
                        {people.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!isEdit && fieldErrors.assigned_to && (
                    <p id={errorId("assignedTo")} className="text-xs text-danger">
                      {fieldErrors.assigned_to}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="project">Project</Label>
                  {isEdit ? (
                    <Input id="project" value={projectName} disabled readOnly />
                  ) : (
                    <ProjectPicker
                      id="project"
                      value={projectId}
                      onChange={handleProjectChange}
                      placeholder="None"
                      aria-invalid={!!fieldErrors.parent}
                      aria-describedby={fieldErrors.parent ? errorId("server") : undefined}
                      className={cn(fieldErrors.parent && INVALID_CONTROL)}
                    />
                  )}
                </div>
              </div>

              {/* Server — edit only shows when server_id is set; create always shows */}
              {isEdit && serverName && (
                <div className="space-y-1">
                  <Label htmlFor="server">Server</Label>
                  <Input id="server" value={serverName} disabled readOnly />
                </div>
              )}

              {!isEdit && (
                <div className="space-y-1">
                  <Label htmlFor="server">Server</Label>
                  <ServerPicker
                    id="server"
                    value={serverId}
                    onChange={setServerId}
                    projectId={projectId}
                    placeholder="None"
                    aria-invalid={!!fieldErrors.parent}
                    aria-describedby={fieldErrors.parent ? errorId("server") : undefined}
                    className={cn(fieldErrors.parent && INVALID_CONTROL)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {projectId
                      ? "Scoped to servers under the selected project."
                      : "Optional — pick a project, a server, or both."}
                  </p>
                  {/*
                    The cross-field message lives here, under the Server picker,
                    and both pickers point at it: it belongs to the Project/Server
                    pair, not to either control alone. role="alert" is kept because
                    this one appears in response to a submit and can sit below the fold.
                  */}
                  {fieldErrors.parent && (
                    <p id={errorId("server")} role="alert" className="text-xs text-danger">
                      {fieldErrors.parent}
                    </p>
                  )}
                </div>
              )}

              {/* Status + timestamps (edit only) */}
              {isEdit && (
                <div className="space-y-1">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[status]}>{status.replace("_", " ")}</Badge>
                    {cancelledAfterStarting && (
                      <span className="text-xs text-muted-foreground">Cancelled after starting</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Status isn't changed from here.
                  </p>
                </div>
              )}

              {isEdit && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="startedAt">Started</Label>
                    <Input
                      id="startedAt"
                      value={startedAt ? format(new Date(startedAt), "PPp") : "Not started yet"}
                      disabled
                      readOnly
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="completedAt">Completed</Label>
                    <Input
                      id="completedAt"
                      value={
                        completedAt ? format(new Date(completedAt), "PPp") : "Not completed yet"
                      }
                      disabled
                      readOnly
                    />
                  </div>
                </div>
              )}

              {/* Notes (both modes) */}
              <div className="space-y-1">
                <OptionalLabel htmlFor="notes">Notes</OptionalLabel>
                <Textarea
                  id="notes"
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

            <CardFooter className="justify-end gap-2">
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
