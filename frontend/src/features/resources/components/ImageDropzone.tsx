import React, { useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/api/errors";
import { cn } from "@/lib/utils";
import {
  useUploadResourceAttachment,
  type ResourceAttachmentWithUploader,
} from "@/hooks/useResourceAttachments";

export const ALLOWED_IMAGE_TYPES = [
  // Images
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
  // Text & Markdown
  "text/markdown",
  "text/plain",
  "text/x-markdown",
  // PDF
  "application/pdf",
  // Spreadsheets (Excel, CSV)
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "text/x-csv",
  "application/x-csv",
  "text/comma-separated-values",
  "text/x-comma-separated-values",
  // Word documents
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  // Presentations (PowerPoint)
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  // Archives & Data
  "application/zip",
  "application/x-zip-compressed",
  "application/json",
  "application/xml",
  "text/xml",
];

export const ALLOWED_EXTENSIONS = [
  // Images
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".gif",
  // Documents
  ".md",
  ".markdown",
  ".txt",
  ".pdf",
  // Spreadsheets
  ".xlsx",
  ".xls",
  ".csv",
  // Word & Presentations
  ".docx",
  ".doc",
  ".pptx",
  ".ppt",
  // Archives & Data
  ".zip",
  ".json",
  ".xml",
];

export const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export interface ImageDropzoneProps {
  resourceId?: string;
  createdInVersionId?: string;
  onUploadSuccess?: (attachment: ResourceAttachmentWithUploader) => void;
  onFilesSelected?: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}

export function ImageDropzone({
  resourceId,
  createdInVersionId,
  onUploadSuccess,
  onFilesSelected,
  disabled = false,
  className,
}: ImageDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);

  const uploadMutation = useUploadResourceAttachment(resourceId);

  async function handleFiles(fileList: FileList | File[]) {
    if (disabled || isUploading) return;
    const files = Array.from(fileList);
    if (files.length === 0) return;

    // Client-side validation: 1GB size limit
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError(
          `"${file.name}" exceeds the 1 GB limit (${formatBytes(file.size)}).`
        );
        return;
      }
    }

    setError(null);

    // If parent handles staging (e.g. in create resource mode)
    if (onFilesSelected) {
      onFilesSelected(files);
      return;
    }

    // Direct upload mode (when resourceId is provided)
    if (resourceId) {
      setIsUploading(true);
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgressMessage(
          files.length > 1
            ? `Uploading ${i + 1} of ${files.length} (${file.name})...`
            : `Uploading ${file.name}...`
        );

        try {
          const uploaded = await uploadMutation.mutateAsync({
            file,
            created_in_version_id: createdInVersionId,
          });
          successCount++;
          onUploadSuccess?.(uploaded);
        } catch (err) {
          failCount++;
          toast({
            title: `Failed to upload "${file.name}"`,
            description: apiErrorMessage(err),
            variant: "destructive",
          });
        }
      }

      setIsUploading(false);
      setProgressMessage(null);

      if (successCount > 0) {
        toast({
          title: "Upload complete",
          description: `Successfully uploaded ${successCount} file${successCount > 1 ? "s" : ""}.${
            failCount > 0 ? ` (${failCount} failed)` : ""
          }`,
        });
      }
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isUploading) return;
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleClick() {
    if (disabled || isUploading) return;
    fileInputRef.current?.click();
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="region"
        aria-label="File upload dropzone"
        tabIndex={disabled || isUploading ? -1 : 0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-brand bg-brand/5"
            : "border-border hover:border-brand/50 hover:bg-surface-hover",
          (disabled || isUploading) && "opacity-60 cursor-not-allowed hover:border-border hover:bg-transparent"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          multiple
          className="hidden"
          data-testid="image-dropzone-input"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = "";
            }
          }}
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <p className="text-sm font-medium text-foreground">
              {progressMessage ?? "Uploading..."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="rounded-full bg-muted/60 p-3 text-muted-foreground">
              <ImagePlus className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Drag and drop files or attachments, or{" "}
                <span className="text-brand underline underline-offset-2">browse</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                All file types supported up to 1 GB each
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 text-xs gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
            >
              <Upload className="h-3.5 w-3.5" />
              Choose File
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-auto p-0 text-xs text-destructive hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation();
              setError(null);
            }}
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
