import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, History } from "lucide-react";
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
import { useProjects } from "@/hooks/useProjects";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ResourceFilterBar from "./components/ResourceFilterBar";
import ResourceFileTable from "./components/ResourceFileTable";
import VersionHistoryPanel from "./components/VersionHistoryPanel";
import { AttachmentGallery } from "./components/AttachmentGallery";
import { useResourceAttachments } from "@/hooks/useResourceAttachments";

const SORT_OPTIONS: { value: ResourceSort; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "created_at", label: "Created" },
  { value: "updated_at", label: "Updated" },
];

export default function ResourcesPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const selectedIdFromUrl = params.id ?? searchParams.get("selected") ?? undefined;

  const pagination = usePagination({ initialSort: "title", initialOrder: "asc" });
  const projectId = pagination.getParam("project_id") ?? undefined;
  const type = pagination.getParam("type") ?? undefined;

  function setProjectId(value: string | undefined) {
    pagination.setParams({ project_id: value });
  }

  function setType(value: string | undefined) {
    pagination.setParams({ type: value });
  }

  const [selected, setSelected] = useState<ResourceListItem | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"content" | "history">("content");
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
    selected?.id ?? selectedIdFromUrl
  );

  const { data: projects = [] } = useProjects();
  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );
  const selectedProject = selected?.project_id ? projectById.get(selected.project_id) : undefined;

  const prevSelectedIdFromUrl = useRef(selectedIdFromUrl);

  function handleBackToResources() {
    setSelected(undefined);
    if (params.id) {
      navigate("/resources");
    } else if (searchParams.has("selected")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("selected");
      const qs = nextParams.toString();
      navigate(qs ? `/resources?${qs}` : "/resources", { replace: true });
    }
  }

  // Clear selected when user navigates away from a URL that had a resource ID
  useEffect(() => {
    if (prevSelectedIdFromUrl.current && !selectedIdFromUrl) {
      setSelected(undefined);
    }
    prevSelectedIdFromUrl.current = selectedIdFromUrl;
  }, [selectedIdFromUrl]);

  // Auto-sync selected with URL if available
  useEffect(() => {
    if (selectedIdFromUrl) {
      const match = resources.find((r) => r.id === selectedIdFromUrl);
      if (match) {
        setSelected(match);
      } else if (resourceDetail && resourceDetail.id === selectedIdFromUrl) {
        setSelected(resourceDetail);
      }
    }
  }, [selectedIdFromUrl, resources, resourceDetail]);

  useBreadcrumbs(
    selected
      ? [
          HOME_SEGMENT,
          { label: "Resources", href: "/resources" },
          { label: selected.title },
        ]
      : [HOME_SEGMENT, { label: "Resources" }]
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
  const { data: rawAttachments } = useResourceAttachments(selected?.id);
  const attachments = Array.isArray(rawAttachments) ? rawAttachments : [];

  return (
    <div className="space-y-6">
      {!selected ? (
        <>
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
            <div className="space-y-4">
              <ResourceFileTable
                resources={resources}
                onSelect={(resource) => {
                  setSelected(resource);
                  setActiveTab("content");
                }}
              />

              <PaginationControls
                page={pagination.page}
                totalPages={totalPages}
                perPage={pagination.perPage}
                onPrevPage={pagination.prevPage}
                onNextPage={pagination.nextPage}
                onPerPageChange={pagination.setPerPage}
              />
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToResources}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground -ml-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to resources
            </Button>
          </div>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  {selected.title}
                  {isDeletedSelected && <Badge variant="neutral">Deleted</Badge>}
                </CardTitle>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{selected.type}</Badge>
                  {selected.category && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted/40 border border-border/50 text-[11px]">
                      {selected.category}
                    </span>
                  )}
                  {selectedProject && (
                    <span>
                      Project: <strong className="text-foreground">{selectedProject.name}</strong>
                    </span>
                  )}
                  {selected.current_version?.version_number && (
                    <span className="font-mono">v{selected.current_version.version_number}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
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
                    <Button
                      variant={activeTab === "history" ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setActiveTab((prev) => (prev === "history" ? "content" : "history"))}
                      className="flex items-center gap-1.5"
                      aria-label="History"
                    >
                      <History className="h-4 w-4" />
                      History
                    </Button>

                    <RequireRole roles={["admin", "member"]}>
                      <Button variant="secondary" size="sm" onClick={openAddVersion}>
                        Add version
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

            <CardContent className="pt-6">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "content" | "history")}
                className="w-full"
              >
                <TabsList className="mb-6">
                  <TabsTrigger value="content" className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Content &amp; Diagrams
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-1.5">
                    <History className="h-4 w-4" />
                    Version History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-6">
                  {isResourceDetailLoading ? (
                    <LoadingState message="Loading resource content..." />
                  ) : (
                    <>
                      {resourceDetail?.current_version?.content && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">Content</h3>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => {
                                const blob = new Blob(
                                  [resourceDetail.current_version!.content!],
                                  { type: "text/markdown;charset=utf-8" }
                                );
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                const safeTitle = (selected.title || "resource")
                                  .toLowerCase()
                                  .replace(/[^a-z0-9_-]/g, "_");
                                a.download = `${safeTitle}.md`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                                toast({
                                  title: "Downloaded .md",
                                  description: `Saved as "${safeTitle}.md"`,
                                });
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download .md
                            </Button>
                          </div>
                          <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-4 font-mono text-xs text-foreground">
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
                          <p className="text-sm text-muted-foreground">
                            No content recorded for this version.
                          </p>
                        )}
                    </>
                  )}

                  {attachments.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        Diagrams &amp; Attachments
                      </h3>
                      <AttachmentGallery resourceId={selected.id} readOnly />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history">
                  <VersionHistoryPanel resourceId={selected.id} onRevert={openRevertVersion} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

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
