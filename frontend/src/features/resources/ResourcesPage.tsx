import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RequireRole } from "@/components/auth/RequireRole";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PaginationControls } from "@/components/PaginationControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { LoadingState } from "@/components/state/LoadingState";
import { PageHeader } from "@/components/layout/PageHeader";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import { apiErrorMessage } from "@/api/errors";
import { toast } from "@/hooks/use-toast";
import { usePagination } from "@/hooks/usePagination";
import {
  useDeleteResource,
  useResource,
  useResources,
  useRestoreResource,
  type ResourceListItem,
  type ResourceSort,
} from "@/hooks/useResources";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResourceFilterBar from "./components/ResourceFilterBar";
import ResourceList from "./components/ResourceList";
import ResourceMetadataDialog from "./components/ResourceMetadataDialog";
import VersionHistoryPanel from "./components/VersionHistoryPanel";
import { AttachmentGallery } from "./components/AttachmentGallery";
import { ImageDropzone } from "./components/ImageDropzone";

const SORT_OPTIONS: { value: ResourceSort; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "created_at", label: "Created" },
  { value: "updated_at", label: "Updated" },
];


export default function ResourcesPage() {
  useBreadcrumbs([HOME_SEGMENT, { label: "Resources" }]);
  const navigate = useNavigate();
  const pagination = usePagination({ initialSort: "title", initialOrder: "asc" });
  // URL-synced the same way as pagination's own fields (see usePagination.ts)
  // rather than local useState, so a refresh/shared URL reproduces the same
  // filtered view. Matches pre-migration behavior exactly: neither filter
  // resets the page on change (only pagination.setSearch does that).
  const projectId = pagination.getParam("project_id") ?? undefined;
  const type = pagination.getParam("type") ?? undefined;

  function setProjectId(value: string | undefined) {
    pagination.setParams({ project_id: value });
  }

  function setType(value: string | undefined) {
    pagination.setParams({ type: value });
  }

  const [selected, setSelected] = useState<ResourceListItem | undefined>(undefined);
  const [editMetadataOpen, setEditMetadataOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const {
    data: resources = [],
    isLoading,
    isError,
    error,
    pagination: paginationMeta,
    refetch,
  } = useResources({
    page: pagination.page,
    per_page: pagination.perPage,
    sort: pagination.sort as ResourceSort,
    order: pagination.order,
    search: pagination.search || undefined,
    projectId,
    type,
    deleted: pagination.deleted,
  });

  const { data: resourceDetail, isLoading: isResourceDetailLoading } = useResource(
    selected?.id
  );

  const totalPages = paginationMeta?.total_pages ?? 1;

  const deleteResource = useDeleteResource();
  const restoreResource = useRestoreResource();

  function openAddVersion() {
    if (!selected) return;
    navigate(`/resources/${selected.id}/new-version`);
  }

  function openRevertVersion(versionId: string) {
    if (!selected) return;
    navigate(`/resources/${selected.id}/new-version?prefill=${versionId}`);
  }

  function handleDelete() {
    if (!selected) return;
    const target = selected;
    deleteResource.mutate(target.id, {
      onSuccess: (updated) => {
        toast({ title: "Resource deleted" });
        setSelected((prev) => (prev && prev.id === target.id ? { ...prev, ...updated } : prev));
      },
      onError: (err) => {
        toast({
          title: "Couldn't delete resource",
          description: apiErrorMessage(err),
          variant: "destructive",
        });
      },
    });
  }

  // Restore's 409 ("Resource is not deleted") is a business-rule conflict,
  // not a stale-write conflict — it's surfaced as a plain error toast here,
  // never routed through useConflictResolution/ConflictState (that
  // primitive is for stale `updated_at` on PATCH, which this isn't, and
  // this button only ever appears on rows the list itself reports as
  // deleted, so it should be rare/impossible to trigger in practice).
  function handleRestore() {
    if (!selected) return;
    const target = selected;
    restoreResource.mutate(target.id, {
      onSuccess: (updated) => {
        toast({ title: "Resource restored" });
        setSelected((prev) => (prev && prev.id === target.id ? { ...prev, ...updated } : prev));
      },
      onError: (err) => {
        toast({
          title: "Couldn't restore resource",
          description: apiErrorMessage(err),
          variant: "destructive",
        });
      },
    });
  }

  const isDeletedSelected = Boolean(selected?.deleted_at);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resources"
        actions={
          <RequireRole roles={["admin", "member"]}>
            <Button onClick={() => navigate("/resources/new")}>New resource</Button>
          </RequireRole>
        }
      />

      <ResourceFilterBar
        search={pagination.search}
        onSearchChange={pagination.setSearch}
        type={type}
        onTypeChange={setType}
        projectId={projectId}
        onProjectIdChange={setProjectId}
        sort={pagination.sort}
        onSortChange={pagination.setSort}
        sortOptions={SORT_OPTIONS}
        order={pagination.order}
        onOrderChange={pagination.setOrder}
        deleted={pagination.deleted}
        onDeletedChange={pagination.setDeleted}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          {isLoading ? (
            <LoadingState message="Loading resources..." />
          ) : isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : resources.length === 0 ? (
            <EmptyState
              title="No resources found"
              message={
                pagination.search ? "Try a different search term." : "No resources have been added yet."
              }
            />
          ) : (
            <>
              <ResourceList resources={resources} selectedId={selected?.id} onSelect={setSelected} />

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
        </div>

        <div>
          {selected ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {selected.title}
                    {isDeletedSelected && <Badge variant="neutral">Deleted</Badge>}
                  </CardTitle>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="outline">{selected.type}</Badge>
                    {selected.category && (
                      <span className="text-xs text-muted-foreground">{selected.category}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isDeletedSelected ? (
                    <RequireRole
                      roles={["admin"]}
                      fallback={
                        <p className="max-w-[220px] text-right text-xs text-muted-foreground">
                          Restoring a deleted resource requires admin access.
                        </p>
                      }
                    >
                      <Button variant="secondary" size="sm" onClick={handleRestore}>
                        Restore
                      </Button>
                    </RequireRole>
                  ) : (
                    <>
                      <RequireRole roles={["admin", "member"]}>
                        <Button variant="secondary" size="sm" onClick={openAddVersion}>
                          Add version
                        </Button>
                      </RequireRole>
                      {/* Member users can create resources and add versions, but
                          metadata edits (title/category/tags) are admin-only — a
                          real asymmetry (verified against
                          backend/src/routes/resources.routes.ts), not a bug. A
                          plain disabled button with only a native tooltip would
                          leave that unexplained, so a member sees this note
                          instead of the Edit button. */}
                      <RequireRole
                        roles={["admin"]}
                        fallback={
                          <p className="max-w-[220px] text-right text-xs text-muted-foreground">
                            Editing this resource&apos;s title/category/tags requires admin access.
                            You can still add new versions.
                          </p>
                        }
                      >
                        <Button variant="ghost" size="sm" onClick={() => setEditMetadataOpen(true)}>
                          Edit
                        </Button>
                      </RequireRole>
                      <RequireRole roles={["admin"]}>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
                          Delete
                        </Button>
                      </RequireRole>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="content" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="content">Content &amp; Diagrams</TabsTrigger>
                    <TabsTrigger value="history">Version History</TabsTrigger>
                  </TabsList>

                  <TabsContent value="content" className="space-y-6">
                    {isResourceDetailLoading ? (
                      <LoadingState message="Loading resource content..." />
                    ) : (
                      <>
                        {resourceDetail?.current_version?.content && (
                          <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-foreground">Content</h3>
                            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-4 font-mono text-xs text-foreground">
                              {resourceDetail.current_version.content}
                            </pre>
                          </div>
                        )}

                        {resourceDetail?.current_version?.external_url && (
                          <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-foreground">External URL</h3>
                            <a
                              href={resourceDetail.current_version.external_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-brand underline underline-offset-2 break-all"
                            >
                              {resourceDetail.current_version.external_url}
                            </a>
                          </div>
                        )}

                        {!resourceDetail?.current_version?.content &&
                          !resourceDetail?.current_version?.external_url && (
                            <p className="text-sm text-muted-foreground">No content recorded for this version.</p>
                          )}
                      </>
                    )}

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Diagrams &amp; Attachments</h3>
                      </div>
                      <AttachmentGallery resourceId={selected.id} />
                    </div>

                    {!isDeletedSelected && (
                      <RequireRole roles={["admin", "member"]}>
                        <div className="space-y-2 pt-2">
                          <h4 className="text-xs font-medium text-muted-foreground">Upload Diagram or Attachment</h4>
                          <ImageDropzone resourceId={selected.id} />
                        </div>
                      </RequireRole>
                    )}
                  </TabsContent>

                  <TabsContent value="history">
                    <VersionHistoryPanel resourceId={selected.id} onRevert={openRevertVersion} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">Select a resource to view its details.</p>
          )}
        </div>
      </div>

      <ResourceMetadataDialog open={editMetadataOpen} onOpenChange={setEditMetadataOpen} resource={selected} />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete this resource?"
        description={
          selected
            ? `"${selected.title}" will be hidden from the active resource list. Its version history is not affected — soft-delete only sets this resource's own deleted flag, resource_versions rows are never touched — so every version will still be there, untouched, if you restore it later.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
