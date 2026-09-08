import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/state/ErrorState";
import { LoadingState } from "@/components/state/LoadingState";
import { EmptyState } from "@/components/state/EmptyState";
import { ProjectPicker } from "@/components/ProjectPicker";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import { apiErrorMessage } from "@/api/errors";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiClient, unwrapApiResult } from "@/api/client";
import { useCreateResource, useResource } from "@/hooks/useResources";
import { useCreateResourceVersion, useResourceVersion } from "@/hooks/useResourceVersions";
import { ImageDropzone, formatBytes } from "./components/ImageDropzone";
import { AttachmentGallery } from "./components/AttachmentGallery";
import type { ResourceType } from "@/types";
import {
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPES,
  validateResourceContentFields,
  type ResourceContentFieldErrors,
} from "@/lib/resourceTypes";

interface FormFieldErrors extends ResourceContentFieldErrors {
  title?: string;
}

const FIELD_DOM_ORDER: ReadonlyArray<{ key: keyof FormFieldErrors; elementId: string }> = [
  { key: "title", elementId: "title" },
  { key: "content", elementId: "content" },
  { key: "external_url", elementId: "externalUrl" },
];

function errorId(elementId: string) {
  return `${elementId}-error`;
}

const INVALID_CONTROL = "shadow-underline-danger focus-visible:shadow-underline-danger";

export interface ResourceFormPageProps {
  mode?: "create" | "new-version";
}

export default function ResourceFormPage({ mode: modeProp }: ResourceFormPageProps) {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const mode = modeProp ?? (params.id ? "new-version" : "create");
  const isNewVersion = mode === "new-version";
  const resourceId = params.id;

  // In new-version mode, fetch the resource to get its title, type, and current_version_id
  const {
    data: resource,
    isLoading: isResourceLoading,
    isError: isResourceError,
    error: resourceError,
    refetch: refetchResource,
  } = useResource(isNewVersion ? resourceId : undefined);

  const prefillVersionId = searchParams.get("prefill") ?? undefined;
  const currentVersionId = resource?.current_version_id;
  const effectivePrefillId = prefillVersionId ?? currentVersionId ?? undefined;
  const isReverting = Boolean(
    effectivePrefillId && currentVersionId && effectivePrefillId !== currentVersionId
  );

  // Set breadcrumbs based on mode and resource data
  useBreadcrumbs(
    isNewVersion
      ? resource
        ? [
            HOME_SEGMENT,
            { label: "Resources", href: "/resources" },
            { label: resource.title, href: `/resources?selected=${resourceId}` },
            { label: isReverting ? "Revert to this version" : "New version" },
          ]
        : [
            HOME_SEGMENT,
            { label: "Resources", href: "/resources" },
            { label: "New version" },
          ]
      : [
          HOME_SEGMENT,
          { label: "Resources", href: "/resources" },
          { label: "New resource" },
        ]
  );

  const createResource = useCreateResource();
  const createVersion = useCreateResourceVersion(resourceId ?? "");

  // Fetches the version whose content pre-fills the form
  const { data: prefillVersion, isLoading: isPrefillLoading } = useResourceVersion(
    isNewVersion ? resourceId : undefined,
    isNewVersion ? effectivePrefillId : undefined
  );

  // Duplicate-content baseline check
  const { data: fetchedBaselineVersion } = useResourceVersion(
    isNewVersion && isReverting ? resourceId : undefined,
    isNewVersion && isReverting ? currentVersionId ?? undefined : undefined
  );
  const baselineVersion = isReverting ? fetchedBaselineVersion : prefillVersion;

  const [title, setTitle] = useState("");
  const [type, setType] = useState<ResourceType>("runbook");
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const contentFileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleContentFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setContent(text);
      setFieldErrors((prev) => ({ ...prev, content: undefined }));

      // If title is currently empty (create mode), infer title from file name
      if (!title.trim() && !isNewVersion) {
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setTitle(baseName);
        setFieldErrors((prev) => ({ ...prev, title: undefined }));
      }

      toast({
        title: "File loaded",
        description: `Loaded content from "${file.name}"`,
      });
    } catch {
      toast({
        title: "Failed to read file",
        description: "Could not read text content from the selected file.",
        variant: "destructive",
      });
    } finally {
      e.target.value = "";
    }
  }

  // Pre-fill form when prefillVersion is loaded in new-version mode
  useEffect(() => {
    if (!isNewVersion || !prefillVersion) return;
    setContent(prefillVersion.content ?? "");
    setExternalUrl(prefillVersion.external_url ?? "");
    setCommitMessage("");
    setFieldErrors({});
    setShowDuplicateConfirm(false);
  }, [isNewVersion, prefillVersion]);

  function focusFirstInvalid(errors: FormFieldErrors) {
    const first = FIELD_DOM_ORDER.find(({ key }) => errors[key]);
    if (!first) return;
    document.getElementById(first.elementId)?.focus();
  }

  function isDuplicateOfBaseline(): boolean {
    if (!isNewVersion || !baselineVersion) return false;
    const baselineSource = baselineVersion.content || baselineVersion.external_url || "";
    const submittedSource = content || externalUrl || "";
    return submittedSource === baselineSource;
  }

  function handleCancel() {
    navigate(isNewVersion && resourceId ? `/resources?selected=${resourceId}` : "/resources");
  }

  async function submitNewVersion() {
    try {
      const result = await createVersion.mutateAsync({
        content: content || undefined,
        external_url: externalUrl || undefined,
        commit_message: commitMessage || undefined,
      });
      toast({ title: isReverting ? "Reverted to a previous version" : "New version added" });
      if (result.warning) {
        toast({ title: "Heads up", description: result.warning });
      }
      navigate(resourceId ? `/resources?selected=${resourceId}` : "/resources");
    } catch (err) {
      toast({
        title: "Couldn't add new version",
        description: apiErrorMessage(err),
        variant: "destructive",
      });
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!isNewVersion) {
      const errors: FormFieldErrors = validateResourceContentFields(type, content, externalUrl);
      if (!title.trim()) {
        errors.title = "Title is required.";
      }
      if (errors.title || errors.content || errors.external_url) {
        setFieldErrors(errors);
        focusFirstInvalid(errors);
        return;
      }
      setFieldErrors({});

      try {
        const created = await createResource.mutateAsync({
          title,
          type,
          project_id: projectId,
          category: category || undefined,
          content: content || undefined,
          external_url: externalUrl || undefined,
          commit_message: commitMessage || undefined,
        });

        if (stagedFiles.length > 0 && created?.id) {
          let failCount = 0;
          for (const file of stagedFiles) {
            try {
              const formData = new FormData();
              formData.append("file", file);
              const uploadRes = await apiClient.POST("/api/resources/{id}/attachments", {
                params: { path: { id: created.id } },
                body: formData as unknown as { file: string },
              });
              await unwrapApiResult(uploadRes);
            } catch {
              failCount++;
            }
          }

          if (failCount > 0) {
            toast({
              title: "Resource created with upload issues",
              description: `Resource saved, but ${failCount} of ${stagedFiles.length} images failed to upload — you can retry from the resource page.`,
              variant: "destructive",
            });
          } else {
            toast({ title: "Resource created" });
          }
        } else {
          toast({ title: "Resource created" });
        }

        navigate(created?.id ? `/resources?selected=${created.id}` : "/resources");
      } catch (err) {
        toast({
          title: "Couldn't create resource",
          description: apiErrorMessage(err),
          variant: "destructive",
        });
      }
    } else if (resourceId) {
      const targetType = resource?.type ?? "runbook";
      const errors = validateResourceContentFields(targetType, content, externalUrl);
      if (errors.content || errors.external_url) {
        setFieldErrors(errors);
        focusFirstInvalid(errors);
        return;
      }
      setFieldErrors({});

      if (isDuplicateOfBaseline()) {
        setShowDuplicateConfirm(true);
        return;
      }

      await submitNewVersion();
    }
  }

  async function handleConfirmDuplicate() {
    setShowDuplicateConfirm(false);
    await submitNewVersion();
  }

  const isSubmitting = createResource.isPending || createVersion.isPending;

  // Back link URL and label
  const backTo = isNewVersion && resourceId ? `/resources?selected=${resourceId}` : "/resources";
  const backLabel = isNewVersion && resource?.title ? `Back to ${resource.title}` : "Back to resources";

  if (isNewVersion && isResourceLoading) {
    return (
      <div className="space-y-6">
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <LoadingState message="Loading resource..." />
      </div>
    );
  }

  if (isNewVersion && isResourceError) {
    return (
      <div className="space-y-6">
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <ErrorState error={resourceError} onRetry={() => refetchResource()} />
      </div>
    );
  }

  if (isNewVersion && !resource) {
    return (
      <div className="space-y-6">
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <EmptyState title="Resource not found" message="The requested resource could not be found." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1>
              {!isNewVersion ? "New resource" : isReverting ? "Revert to this version" : "Add new version"}
            </h1>
          </CardTitle>
          <CardDescription>
            {!isNewVersion
              ? "Create a runbook, SOP, or other reference document."
              : isReverting
                ? "Pre-filled from an older version — edit if needed, then save to create a new version with this content."
                : "Pre-filled with the current version's content — edit and save to record a new version."}
          </CardDescription>
        </CardHeader>

        {showDuplicateConfirm ? (
          <CardContent>
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-md border border-warning/40 bg-warning/10 p-4"
            >
              <p className="text-sm text-foreground">
                This content is identical to the current version. Create a new version anyway?
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowDuplicateConfirm(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleConfirmDuplicate} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Create anyway"}
                </Button>
              </div>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <CardContent className="space-y-4">
              {!isNewVersion && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      aria-invalid={!!fieldErrors.title}
                      aria-describedby={fieldErrors.title ? errorId("title") : undefined}
                      className={cn(fieldErrors.title && INVALID_CONTROL)}
                    />
                    {fieldErrors.title && (
                      <p id={errorId("title")} className="text-xs text-danger">
                        {fieldErrors.title}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="type">Type</Label>
                      <Select value={type} onValueChange={(v) => setType(v as ResourceType)}>
                        <SelectTrigger id="type" aria-label="Type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RESOURCE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {RESOURCE_TYPE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="project">Project</Label>
                      <ProjectPicker id="project" value={projectId} onChange={setProjectId} placeholder="None" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="category">Category</Label>
                    <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} />
                  </div>
                </>
              )}

              {isNewVersion && isPrefillLoading && (
                <p className="text-xs text-muted-foreground">Loading current content...</p>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content">Content</Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={contentFileInputRef}
                      type="file"
                      accept=".md,.txt,.markdown,.json,.yaml,.yml,.sh,.sql,.env,.conf,text/*"
                      className="hidden"
                      id="content-file-input"
                      data-testid="content-file-input"
                      onChange={handleContentFileChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => contentFileInputRef.current?.click()}
                    >
                      <FileUp className="h-3.5 w-3.5" />
                      Choose File
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="content"
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  aria-invalid={!!fieldErrors.content}
                  aria-describedby={fieldErrors.content ? errorId("content") : undefined}
                  className={cn(fieldErrors.content && INVALID_CONTROL, "font-mono text-xs")}
                  placeholder="Enter markdown or text content, or click 'Choose File' to load from a file..."
                />
                {fieldErrors.content && (
                  <p id={errorId("content")} className="text-xs text-danger">
                    {fieldErrors.content}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="externalUrl">External URL</Label>
                <Input
                  id="externalUrl"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://..."
                  aria-invalid={!!fieldErrors.external_url}
                  aria-describedby={fieldErrors.external_url ? errorId("externalUrl") : undefined}
                  className={cn(fieldErrors.external_url && INVALID_CONTROL)}
                />
                {fieldErrors.external_url && (
                  <p id={errorId("externalUrl")} className="text-xs text-danger">
                    {fieldErrors.external_url}
                  </p>
                )}
              </div>

              {/* Attachments & Diagrams */}
              <div className="space-y-3 pt-2">
                <div className="space-y-0.5">
                  <Label>Attachments & Diagrams</Label>
                  <p className="text-xs text-muted-foreground">
                    Upload architecture diagrams or screenshots to reference in this resource.
                  </p>
                </div>

                {!isNewVersion ? (
                  <div className="space-y-3">
                    <ImageDropzone
                      onFilesSelected={(newFiles) => {
                        setStagedFiles((prev) => [...prev, ...newFiles]);
                      }}
                    />

                    {stagedFiles.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">
                          Staged files ({stagedFiles.length}) — will upload when resource is saved:
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {stagedFiles.map((file, idx) => (
                            <div
                              key={`${file.name}-${idx}`}
                              className="flex items-center justify-between gap-2 rounded-md border border-border bg-card p-2 text-xs"
                            >
                              <div className="min-w-0 flex-1 truncate font-medium">
                                <span className="truncate">{file.name}</span>
                                <span className="ml-1 text-[11px] text-muted-foreground">
                                  ({formatBytes(file.size)})
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  setStagedFiles((prev) => prev.filter((_, i) => i !== idx));
                                }}
                                aria-label={`Remove ${file.name}`}
                              >
                                &times;
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {resourceId && <AttachmentGallery resourceId={resourceId} />}
                    {resourceId && (
                      <ImageDropzone
                        resourceId={resourceId}
                        createdInVersionId={resource?.current_version?.id}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="commitMessage">Commit message</Label>
                <Input
                  id="commitMessage"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                />
              </div>
            </CardContent>

            <CardFooter className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || (isNewVersion && isPrefillLoading)}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
