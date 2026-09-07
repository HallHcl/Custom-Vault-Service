import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, Copy, Image as ImageIcon, Maximize2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingState } from "@/components/state/LoadingState";
import { toast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/api/errors";
import { getToken } from "@/lib/authToken";
import { useAuth } from "@/features/auth/useAuth";
import {
  getAttachmentContentUrl,
  useDeleteResourceAttachment,
  useResourceAttachments,
  type ResourceAttachmentWithUploader,
} from "@/hooks/useResourceAttachments";
import { formatBytes } from "./ImageDropzone";

interface AuthenticatedThumbnailProps {
  src: string;
  alt: string;
  className?: string;
}

function AuthenticatedThumbnail({ src, alt, className }: AuthenticatedThumbnailProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    const token = getToken();

    fetch(src, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load thumbnail");
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        // In test environments or on network error, fallback to rendering directly
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [src]);

  return (
    <img
      src={objectUrl || src}
      alt={alt}
      className={className}
      loading="lazy"
    />
  );
}

async function convertBlobToPng(blob: Blob, mimeType?: string): Promise<Blob> {
  if (blob.type === "image/png" || mimeType === "image/png") return blob;
  if (typeof window === "undefined" || typeof document === "undefined") return blob;

  const testCanvas = document.createElement("canvas");
  if (!testCanvas.getContext || !testCanvas.getContext("2d")) {
    return blob;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(blob), 3000);
    try {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        clearTimeout(timer);
        try {
          URL.revokeObjectURL(url);
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width || 100;
          canvas.height = img.naturalHeight || img.height || 100;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(blob);
            return;
          }
          ctx.drawImage(img, 0, 0);
          if (canvas.toBlob) {
            canvas.toBlob((pngBlob) => {
              resolve(pngBlob || blob);
            }, "image/png");
          } else {
            resolve(blob);
          }
        } catch {
          resolve(blob);
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        try {
          URL.revokeObjectURL(url);
        } catch {}
        resolve(blob);
      };
      img.src = url;
    } catch {
      clearTimeout(timer);
      resolve(blob);
    }
  });
}

async function copyImageToClipboard(src: string, mimeType?: string) {
  const token = getToken();
  const res = await fetch(src, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to fetch image");
  const blob = await res.blob();
  const pngBlob = await convertBlobToPng(blob, mimeType);

  const ClipboardItemClass =
    typeof window !== "undefined" &&
    (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      ? (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      : typeof ClipboardItem !== "undefined"
      ? ClipboardItem
      : typeof globalThis !== "undefined" &&
        (globalThis as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      ? (globalThis as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      : undefined;

  if (
    navigator.clipboard &&
    typeof navigator.clipboard.write === "function" &&
    ClipboardItemClass
  ) {
    await navigator.clipboard.write([
      new ClipboardItemClass({ "image/png": pngBlob }),
    ]);
  } else {
    throw new Error("Clipboard image copy is not supported in this browser");
  }
}

export interface AttachmentGalleryProps {
  resourceId: string;
  onDeleteSuccess?: (attachmentId: string) => void;
  className?: string;
}

export function AttachmentGallery({
  resourceId,
  onDeleteSuccess,
  className,
}: AttachmentGalleryProps) {
  const { user, roles = [] } = useAuth();
  const isAdmin = Array.isArray(roles) && roles.includes("admin");

  const { data: rawAttachments, isLoading } = useResourceAttachments(resourceId);
  const attachments = Array.isArray(rawAttachments) ? rawAttachments : [];
  const deleteMutation = useDeleteResourceAttachment(resourceId);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] =
    useState<ResourceAttachmentWithUploader | null>(null);
  const [attachmentToDelete, setAttachmentToDelete] =
    useState<ResourceAttachmentWithUploader | null>(null);

  async function handleCopyImage(attachment: ResourceAttachmentWithUploader) {
    const contentUrl = getAttachmentContentUrl(resourceId, attachment.id);
    try {
      await copyImageToClipboard(contentUrl, attachment.mime_type);
      setCopiedId(attachment.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({
        title: "Image copied",
        description: `"${attachment.file_name}" copied to clipboard.`,
      });
    } catch (err) {
      toast({
        title: "Failed to copy image",
        description: apiErrorMessage(err) || "Could not copy image to clipboard",
        variant: "destructive",
      });
    }
  }

  function handleConfirmDelete() {
    if (!attachmentToDelete) return;
    const target = attachmentToDelete;

    deleteMutation.mutate(target.id, {
      onSuccess: () => {
        toast({ title: "Attachment deleted" });
        onDeleteSuccess?.(target.id);
        setAttachmentToDelete(null);
      },
      onError: (err) => {
        toast({
          title: "Couldn't delete attachment",
          description: apiErrorMessage(err),
          variant: "destructive",
        });
      },
    });
  }

  if (isLoading) {
    return <LoadingState message="Loading attachments..." />;
  }

  if (attachments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm font-medium text-foreground">No diagrams or attachments yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Upload diagrams and images above to attach them to this resource.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {attachments.map((attachment) => {
          const contentUrl = getAttachmentContentUrl(resourceId, attachment.id);
          const isUploader = Boolean(
            user?.peopleId && attachment.uploaded_by === user.peopleId
          );
          const canDelete = isAdmin || isUploader;

          return (
            <div
              key={attachment.id}
              className="group flex flex-col justify-between overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-all hover:shadow-md"
            >
              {/* Thumbnail Container (Click to view full size) */}
              <div
                role="button"
                tabIndex={0}
                aria-label={`View ${attachment.file_name} full size`}
                onClick={() => setPreviewAttachment(attachment)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPreviewAttachment(attachment);
                  }
                }}
                className="relative aspect-video w-full overflow-hidden bg-muted/40 border-b border-border flex items-center justify-center cursor-pointer group/thumb"
              >
                <AuthenticatedThumbnail
                  src={contentUrl}
                  alt={attachment.caption || attachment.file_name}
                  className="h-full w-full object-contain transition-transform duration-200 group-hover/thumb:scale-102"
                />
                <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/25 transition-colors flex items-center justify-center opacity-0 group-hover/thumb:opacity-100">
                  <div className="rounded-full bg-background/90 p-2 text-foreground shadow-md backdrop-blur-xs">
                    <Maximize2 className="h-4 w-4" />
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-xs text-[10px]"
                >
                  {attachment.mime_type.replace("image/", "")}
                </Badge>
              </div>

              {/* Metadata */}
              <div className="flex flex-1 flex-col justify-between p-3 space-y-2">
                <div>
                  <h4
                    className="text-sm font-medium text-foreground truncate"
                    title={attachment.file_name}
                  >
                    {attachment.file_name}
                  </h4>
                  {attachment.caption && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {attachment.caption}
                    </p>
                  )}
                </div>

                <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/40">
                  <div className="flex justify-between items-center">
                    <span>Uploaded by:</span>
                    <span className="font-medium text-foreground truncate max-w-[120px]">
                      {attachment.uploader?.name || "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Size:</span>
                    <span>{formatBytes(attachment.size_bytes)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Date:</span>
                    <span>{format(new Date(attachment.created_at), "PP")}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-1 pt-2 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-8"
                    onClick={() => handleCopyImage(attachment)}
                  >
                    {copiedId === attachment.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1 text-success" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Copy Image
                      </>
                    )}
                  </Button>

                  {canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label={`Delete ${attachment.file_name}`}
                      onClick={() => setAttachmentToDelete(attachment)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full-size Image Preview Modal */}
      <Dialog
        open={Boolean(previewAttachment)}
        onOpenChange={(open) => !open && setPreviewAttachment(null)}
      >
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
          <DialogHeader className="pr-10">
            <DialogTitle className="text-base font-semibold truncate">
              {previewAttachment?.caption || previewAttachment?.file_name}
            </DialogTitle>
            {previewAttachment?.caption && (
              <DialogDescription className="text-xs truncate">
                {previewAttachment.file_name}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="relative flex-1 min-h-[300px] max-h-[65vh] w-full flex items-center justify-center bg-muted/30 rounded-md overflow-hidden border border-border p-2">
            {previewAttachment && (
              <AuthenticatedThumbnail
                src={getAttachmentContentUrl(resourceId, previewAttachment.id)}
                alt={previewAttachment.caption || previewAttachment.file_name}
                className="max-h-full max-w-full object-contain select-none"
              />
            )}
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-2 pt-2 sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {previewAttachment && (
                <span>
                  {formatBytes(previewAttachment.size_bytes)} • {previewAttachment.mime_type.replace("image/", "").toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {previewAttachment && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyImage(previewAttachment)}
                >
                  {copiedId === previewAttachment.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1 text-success" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy Image
                    </>
                  )}
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPreviewAttachment(null)}
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(attachmentToDelete)}
        onOpenChange={(open) => !open && setAttachmentToDelete(null)}
        title="Delete attachment?"
        description={
          attachmentToDelete
            ? `Are you sure you want to delete "${attachmentToDelete.file_name}"? The attachment will be removed from this resource.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
