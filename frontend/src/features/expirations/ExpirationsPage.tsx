import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { RequireRole } from "@/components/auth/RequireRole";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterBar } from "@/components/FilterBar";
import { PaginationControls } from "@/components/PaginationControls";
import { RowActions } from "@/components/RowActions";
import { Toolbar } from "@/components/Toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { LoadingState } from "@/components/state/LoadingState";
import { PageHeader } from "@/components/layout/PageHeader";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import { apiErrorMessage } from "@/api/errors";
import { toast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/useClients";
import { useHasRole } from "@/hooks/useHasRole";
import { usePagination, type DeletedFilter, type SortOrder } from "@/hooks/usePagination";
import {
  EXPIRATION_STATUSES,
  EXPIRATION_TYPES,
  useDeleteExpiration,
  useExpirations,
  useRestoreExpiration,
  type Expiration,
  type ExpirationSort,
  type ExpirationStatus,
  type ExpirationType,
} from "@/hooks/useExpirations";
import { EXPIRATION_STATUS_LABELS, EXPIRATION_TYPE_LABELS } from "./ExpirationFormPage";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { value: ExpirationSort; label: string }[] = [
  { value: "expiry_date", label: "Expiry date" },
  { value: "name", label: "Name" },
  { value: "created_at", label: "Created" },
  { value: "updated_at", label: "Updated" },
];

const STATUS_BADGE_VARIANT: Record<
  ExpirationStatus,
  "secondary" | "default" | "destructive"
> = {
  active: "secondary",
  renewed: "default",
  expired: "destructive",
};

export default function ExpirationsPage() {
  useBreadcrumbs([HOME_SEGMENT, { label: "Expirations" }]);
  const navigate = useNavigate();
  const canEdit = useHasRole(["admin", "member"]);
  const canDelete = useHasRole(["admin"]);

  const pagination = usePagination({ initialSort: "expiry_date", initialOrder: "asc" });

  const status = pagination.getParam("status") ?? "all";
  const type = pagination.getParam("type") ?? "all";
  const daysAheadRaw = pagination.getParam("days_ahead");
  const daysAhead = daysAheadRaw && daysAheadRaw !== "all" ? parseInt(daysAheadRaw, 10) : undefined;
  const clientId = pagination.getParam("client_id") ?? "all";

  function setStatus(value: string) {
    pagination.setParams({ status: value === "all" ? undefined : value }, { resetPage: true });
  }

  function setType(value: string) {
    pagination.setParams({ type: value === "all" ? undefined : value }, { resetPage: true });
  }

  function setDaysAhead(value: string) {
    pagination.setParams(
      { days_ahead: value === "all" ? undefined : value },
      { resetPage: true }
    );
  }

  function setClientId(value: string) {
    pagination.setParams(
      { client_id: value === "all" ? undefined : value },
      { resetPage: true }
    );
  }

  const [searchInput, setSearchInput] = useState(pagination.search ?? "");

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    pagination.setSearch(searchInput);
  }

  const {
    data: expirations = [],
    pagination: pageInfo,
    isLoading,
    isError,
    error,
    refetch,
  } = useExpirations({
    clientId: clientId === "all" ? undefined : clientId,
    type: type === "all" ? undefined : (type as ExpirationType),
    status: status === "all" ? undefined : (status as ExpirationStatus),
    daysAhead,
    page: pagination.page,
    per_page: pagination.perPage,
    sort: pagination.sort as ExpirationSort | undefined,
    order: pagination.order,
    search: pagination.search || undefined,
    deleted: pagination.deleted,
  });

  const { data: clients = [] } = useClients();
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const totalPages = pageInfo?.total_pages ?? 1;

  const [deleteTarget, setDeleteTarget] = useState<Expiration | undefined>(undefined);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  function openDeleteConfirm(exp: Expiration) {
    setDeleteTarget(exp);
    setDeleteConfirmOpen(true);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteExpiration.mutate(deleteTarget.id, {
      onSuccess: () => toast({ title: "Expiration deleted" }),
      onError: (err) => {
        toast({
          title: "Couldn't delete expiration",
          description: apiErrorMessage(err),
          variant: "destructive",
        });
      },
    });
  }

  function handleRestore(exp: Expiration) {
    restoreExpiration.mutate(exp.id, {
      onSuccess: () => toast({ title: "Expiration restored" }),
      onError: (err) => {
        toast({
          title: "Couldn't restore expiration",
          description: apiErrorMessage(err),
          variant: "destructive",
        });
      },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Expirations" />

      <Toolbar>
        <FilterBar>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search expirations..."
              className="w-48"
              aria-label="Search expirations"
            />
          </form>

          {/* Timeframe / Days Ahead filter */}
          <Select value={daysAheadRaw ?? "all"} onValueChange={setDaysAhead}>
            <SelectTrigger className="w-44" aria-label="Timeframe filter">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any timeframe</SelectItem>
              <SelectItem value="7">Within 7 days (Critical)</SelectItem>
              <SelectItem value="30">Within 30 days</SelectItem>
              <SelectItem value="60">Within 60 days</SelectItem>
              <SelectItem value="90">Within 90 days</SelectItem>
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" aria-label="Status filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {EXPIRATION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {EXPIRATION_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Type filter */}
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-48" aria-label="Type filter">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {EXPIRATION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {EXPIRATION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Client filter */}
          {clients.length > 0 && (
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-40" aria-label="Client filter">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Sort selection */}
          <Select value={pagination.sort} onValueChange={pagination.setSort}>
            <SelectTrigger className="w-40" aria-label="Sort by">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort order */}
          <Select
            value={pagination.order}
            onValueChange={(v) => pagination.setOrder(v as SortOrder)}
          >
            <SelectTrigger className="w-32" aria-label="Sort order">
              <SelectValue placeholder="Order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Ascending</SelectItem>
              <SelectItem value="desc">Descending</SelectItem>
            </SelectContent>
          </Select>

          {/* Record Status (deleted) */}
          <Select
            value={pagination.deleted}
            onValueChange={(v) => pagination.setDeleted(v as DeletedFilter)}
          >
            <SelectTrigger className="w-36" aria-label="Record status filter">
              <SelectValue placeholder="Record status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">Active</SelectItem>
              <SelectItem value="true">Deleted</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>

          {daysAhead && (
            <Button variant="ghost" size="sm" onClick={() => setDaysAhead("all")}>
              Clear days filter
            </Button>
          )}
        </FilterBar>

        <RequireRole roles={["admin", "member"]}>
          <Button className="ml-auto" onClick={() => navigate("/expirations/new")}>
            New expiration
          </Button>
        </RequireRole>
      </Toolbar>

      {isLoading ? (
        <LoadingState message="Loading expirations..." />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : expirations.length === 0 ? (
        <EmptyState
          title="No expirations found"
          message={
            daysAhead
              ? `No expirations found within ${daysAhead} days matching the current filters.`
              : "No expirations match the current filters."
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Time Remaining</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expirations.map((exp) => {
                const isDeleted = Boolean(exp.deleted_at);
                const clientName = clientMap.get(exp.client_id) ?? "—";
                return (
                  <TableRow
                    key={exp.id}
                    className={cn("group", isDeleted && "[&_td]:text-muted-foreground")}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <InitialsAvatar name={exp.name} />
                        <div>
                          <div className="font-medium text-foreground">{exp.name}</div>
                          {exp.identifier && (
                            <div className="font-mono text-xs text-muted-foreground">
                              {exp.identifier}
                            </div>
                          )}
                          {exp.provider_or_vendor && !exp.identifier && (
                            <div className="text-xs text-muted-foreground">
                              {exp.provider_or_vendor}
                            </div>
                          )}
                        </div>
                        {isDeleted && <Badge variant="neutral">Deleted</Badge>}
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm">
                        {EXPIRATION_TYPE_LABELS[exp.type]}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANT[exp.status]}>
                        {EXPIRATION_STATUS_LABELS[exp.status]}
                      </Badge>
                    </TableCell>

                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {format(new Date(exp.expiry_date), "PP")}
                    </TableCell>

                    <TableCell>
                      {exp.status === "renewed" ? (
                        <span className="font-mono text-xs text-muted-foreground">Renewed</span>
                      ) : exp.is_expired ? (
                        <Badge variant="destructive">
                          Expired ({Math.abs(exp.days_until_expiry)}d ago)
                        </Badge>
                      ) : exp.is_critical ? (
                        <Badge variant="destructive">
                          {exp.days_until_expiry}d left
                        </Badge>
                      ) : exp.is_expiring_soon ? (
                        <Badge variant="warning">
                          {exp.days_until_expiry}d left
                        </Badge>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                          {exp.days_until_expiry}d
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {clientName}
                    </TableCell>

                    <TableCell className="space-x-2 text-right">
                      <div
                        className={cn(
                          "inline-flex items-center gap-2 transition-opacity",
                          !isDeleted && "opacity-60",
                          "group-hover:opacity-100",
                          "group-focus-within:opacity-100"
                        )}
                      >
                        {isDeleted ? (
                          <RequireRole roles={["admin"]}>
                            <Button variant="ghost" size="sm" onClick={() => handleRestore(exp)}>
                              Restore
                            </Button>
                          </RequireRole>
                        ) : (
                          <RowActions
                              onEdit={canEdit ? () => navigate(`/expirations/${exp.id}/edit`) : undefined}
                              onDelete={canDelete ? () => openDeleteConfirm(exp) : undefined}
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <PaginationControls
            page={pagination.page}
            totalPages={totalPages}
            perPage={pagination.perPage}
            onPrevPage={pagination.prevPage}
            onNextPage={pagination.nextPage}
            onPerPageChange={pagination.setPerPage}
          />
        </>
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete this expiration?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be hidden from the active list. Expiration is a leaf record — nothing else is affected. You can restore it at any time.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

    </div>
  );
}
