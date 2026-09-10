import { format } from "date-fns";
import { Calendar, Clock, FileText, Folder, HardDrive, Pencil, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { LoadingState } from "@/components/state/LoadingState";
import { useHasRole } from "@/hooks/useHasRole";
import { parseScheduledDate, useSchedule } from "@/hooks/useSchedules";
import type { Schedule, ScheduleStatus } from "@/types";
import ScheduleStatusActions from "./ScheduleStatusActions";

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
  schedule: Schedule | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (schedule: Schedule) => void;
}

export default function ScheduleDetailDialog({
  schedule,
  open,
  onOpenChange,
  onEdit,
}: Props) {
  const canEdit = useHasRole(["admin", "member"]);
  const { data: detail, isLoading } = useSchedule(schedule?.id);

  if (!schedule) return null;

  const current = detail ?? schedule;
  const isTerminal = current.status === "done" || current.status === "cancelled";
  const isDeleted = Boolean(current.deleted_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex flex-col gap-2">
            <DialogTitle className="flex items-center gap-2.5 text-xl font-bold">
              <InitialsAvatar name={current.title} />
              <span>{current.title}</span>
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{current.type}</Badge>
              <Badge variant={STATUS_VARIANT[current.status]}>
                {current.status.replace("_", " ")}
              </Badge>
              {current.is_overdue && (
                <Badge variant="destructive">Overdue</Badge>
              )}
              {isDeleted && <Badge variant="neutral">Deleted</Badge>}
            </div>
          </div>
        </DialogHeader>

        {isLoading && !detail ? (
          <div className="py-8">
            <LoadingState message="Loading schedule details..." />
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-3">
              <div className="space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" /> Scheduled Date
                </span>
                <p className="font-medium text-foreground">
                  {format(parseScheduledDate(current.scheduled_date), "PP")}
                </p>
              </div>

              <div className="space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <User className="h-3.5 w-3.5" /> Assigned To
                </span>
                <p className="font-medium text-foreground">
                  {detail?.assigned_to_person?.name ?? "—"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Folder className="h-3.5 w-3.5" /> Project
                </span>
                <p className="font-medium text-foreground">
                  {detail?.project?.name ?? "—"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <HardDrive className="h-3.5 w-3.5" /> Server
                </span>
                <p className="font-medium text-foreground">
                  {detail?.server?.name ?? "—"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Started
                </span>
                <p className="text-muted-foreground">
                  {current.started_at
                    ? format(new Date(current.started_at), "PPp")
                    : "Not started yet"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Completed
                </span>
                <p className="text-muted-foreground">
                  {current.completed_at
                    ? format(new Date(current.completed_at), "PPp")
                    : "Not completed yet"}
                </p>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> Notes
              </span>
              {current.notes ? (
                <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {current.notes}
                </div>
              ) : (
                <p className="pl-0.5 text-xs italic text-muted-foreground">
                  No notes recorded for this schedule.
                </p>
              )}
            </div>

            {/* Quick Status Change Action */}
            {!isDeleted && !isTerminal && (
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-xs font-medium text-muted-foreground">Change Status:</span>
                <ScheduleStatusActions schedule={current} />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 border-t pt-3 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canEdit && !isTerminal && !isDeleted && onEdit && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onEdit(current);
              }}
              className="gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit schedule
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
