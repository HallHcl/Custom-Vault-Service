import { getToken } from "../lib/authToken";
import { apiClient, unwrapApiResult } from "./client";

export interface UploadProgressEvent {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadAttachmentOptions {
  resourceId: string;
  file: File;
  createdInVersionId?: string;
  caption?: string;
  onProgress?: (event: UploadProgressEvent) => void;
}

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api").replace(
  /\/api\/?$/,
  ""
);

export async function uploadResourceAttachmentWithProgress({
  resourceId,
  file,
  createdInVersionId,
  caption,
  onProgress,
}: UploadAttachmentOptions): Promise<unknown> {
  // If in a real browser environment (outside Vitest/jsdom), use XMLHttpRequest for real-time progress
  const isVitest = typeof process !== "undefined" && Boolean(process.env?.VITEST);
  if (
    typeof window !== "undefined" &&
    typeof window.XMLHttpRequest !== "undefined" &&
    !isVitest
  ) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${API_ORIGIN}/api/resources/${encodeURIComponent(resourceId)}/attachments`;
      xhr.open("POST", url);

      const token = getToken();
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percent,
            });
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(xhr.responseText);
          }
        } else {
          let errorMsg = `Upload failed with status ${xhr.status}`;
          try {
            const json = JSON.parse(xhr.responseText);
            if (json?.error?.message) {
              errorMsg = json.error.message;
            }
          } catch {
            // ignore
          }
          reject(new Error(errorMsg));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during attachment upload"));
      xhr.onabort = () => reject(new Error("Upload aborted"));

      const formData = new FormData();
      formData.append("file", file);
      if (createdInVersionId) {
        formData.append("created_in_version_id", createdInVersionId);
      }
      if (caption) {
        formData.append("caption", caption);
      }

      xhr.send(formData);
    });
  }

  // Fallback for tests or environments without real XHR
  const formData = new FormData();
  formData.append("file", file);
  if (createdInVersionId) {
    formData.append("created_in_version_id", createdInVersionId);
  }
  if (caption) {
    formData.append("caption", caption);
  }

  onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
  const result = await apiClient.POST("/api/resources/{id}/attachments", {
    params: { path: { id: resourceId } },
    body: formData as unknown as { file: string },
  });
  return unwrapApiResult(result);
}

