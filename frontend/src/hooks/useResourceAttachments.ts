import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, unwrapApiResult } from "@/api/client";
import type { ResourceAttachmentWithUploader } from "@/types";

const KEY = "resourceAttachments";

export type { ResourceAttachment, ResourceAttachmentWithUploader } from "@/types";

export function getAttachmentContentUrl(resourceId: string, attachmentId: string): string {
  const origin = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api").replace(/\/api\/?$/, "");
  return `${origin}/api/resources/${resourceId}/attachments/${attachmentId}/content`;
}

export function useResourceAttachments(resourceId: string | undefined) {
  const query = useQuery({
    queryKey: [KEY, resourceId],
    queryFn: async () => {
      const result = await apiClient.GET("/api/resources/{id}/attachments", {
        params: { path: { id: resourceId as string } },
      });
      const unwrapped = await unwrapApiResult(result);
      if (Array.isArray(unwrapped)) return unwrapped;
      if (unwrapped && Array.isArray((unwrapped as { data?: unknown }).data)) {
        return (unwrapped as { data: ResourceAttachmentWithUploader[] }).data;
      }
      return [] as ResourceAttachmentWithUploader[];
    },
    enabled: Boolean(resourceId),
  });

  const attachments = Array.isArray(query.data)
    ? query.data
    : query.data && Array.isArray((query.data as { data?: unknown }).data)
    ? (query.data as { data: ResourceAttachmentWithUploader[] }).data
    : [];

  return { ...query, data: attachments };
}

export interface UploadResourceAttachmentInput {
  file: File;
  caption?: string;
  created_in_version_id?: string;
}

export function useUploadResourceAttachment(resourceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UploadResourceAttachmentInput): Promise<ResourceAttachmentWithUploader> => {
      if (!resourceId) {
        throw new Error("resourceId is required to upload an attachment");
      }

      const formData = new FormData();
      formData.append("file", input.file);
      if (input.caption) {
        formData.append("caption", input.caption);
      }
      if (input.created_in_version_id) {
        formData.append("created_in_version_id", input.created_in_version_id);
      }

      const result = await apiClient.POST("/api/resources/{id}/attachments", {
        params: { path: { id: resourceId } },
        body: formData as unknown as { file: string; caption?: string; created_in_version_id?: string },
      });

      return await unwrapApiResult(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY, resourceId] });
    },
  });
}

export function useDeleteResourceAttachment(resourceId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachmentId: string) => {
      if (!resourceId) {
        throw new Error("resourceId is required to delete an attachment");
      }

      const result = await apiClient.DELETE("/api/resources/{id}/attachments/{attachmentId}", {
        params: { path: { id: resourceId, attachmentId } },
      });

      return await unwrapApiResult(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY, resourceId] });
    },
  });
}
