import { format } from "date-fns";
import { RequireRole } from "@/components/auth/RequireRole";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/RowActions";
import { useHasRole } from "@/hooks/useHasRole";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { cn } from "@/lib/utils";
import { parseScheduledDate } from "@/hooks/useSchedules";
import type { Person, Project, Schedule, ScheduleStatus } from "@/types";
import ScheduleStatusActions from "./ScheduleStatusActions";

// Edit/Delete are hidden once a schedule reaches a terminal status — mirrors
// scheduleStateMachine.ts's terminal states (done/cancelled have no further
// transitions). This is independent of isDeleted: a non-deleted schedule
// that's simply done or cancelled shouldn't still offer Edit/Delete.
const TERMINAL_STATUSES: Schedule["status"][] = ["done", "cancelled"];

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
  schedules: Schedule[];
  projects?: Project[];
  people?: Person[];
  onSelect?: (schedule: Schedule) => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
  onRestore: (schedule: Schedule) => void;
}

export default function ScheduleList({
  schedules,
  projects,
  people,
  onSelect,
  onEdit,
  onDelete,
  onRestore,
}: Props) {
  const canEdit = useHasRole(["admin", "member"]);
  const canDelete = useHasRole(["admin"]);

  if (schedules.length === 0) {
    return <p className="text-sm text-muted-foreground">No schedules found.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedules.map((schedule) => {
          const isDeleted = Boolean(schedule.deleted_at);
          const isTerminal = TERMINAL_STATUSES.includes(schedule.status);
          const project = projects?.find((p) => p.id === schedule.project_id);
          const assignee = people?.find((p) => p.id === schedule.assigned_to);

          return (
            <TableRow
              key={schedule.id}
              className={cn(
                "group cursor-pointer hover:bg-muted/50 transition-colors",
                isDeleted && "[&_td]:text-muted-foreground"
              )}
              role="button"
              tabIndex={0}
              aria-label={`View ${schedule.title}`}
              onClick={() => onSelect?.(schedule)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(schedule);
                }
              }}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <InitialsAvatar name={schedule.title} />
                  <span className="font-medium group-hover:text-brand transition-colors">
                    {schedule.title}
                  </span>
                  {isDeleted && <Badge variant="neutral">Deleted</Badge>}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{schedule.type}</Badge>
              </TableCell>
              <TableCell className="text-sm">
                {project ? (
                  <span className="font-medium text-foreground">{project.name}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {assignee ? (
                  <div className="flex items-center gap-1.5">
                    <InitialsAvatar name={assignee.name} className="h-5 w-5 text-[10px]" />
                    <span>{assignee.name}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                {format(parseScheduledDate(schedule.scheduled_date), "PP")}
              </TableCell>
              <TableCell>
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Badge variant={STATUS_VARIANT[schedule.status]}>
                    {schedule.status.replace("_", " ")}
                  </Badge>
                  {!isDeleted && <ScheduleStatusActions schedule={schedule} />}
                </div>
              </TableCell>
              <TableCell className="space-x-2 text-right">
                <div
                  className={cn(
                    "inline-flex transition-opacity",
                    !isDeleted && "opacity-60",
                    "group-hover:opacity-100",
                    "group-focus-within:opacity-100"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isDeleted ? (
                    <RequireRole roles={["admin"]}>
                      <Button variant="ghost" size="sm" onClick={() => onRestore(schedule)}>
                        Restore
                      </Button>
                    </RequireRole>
                  ) : (
                    <RowActions
                      onEdit={canEdit && !isTerminal ? () => onEdit(schedule) : undefined}
                      onDelete={canDelete && !isTerminal ? () => onDelete(schedule) : undefined}
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
