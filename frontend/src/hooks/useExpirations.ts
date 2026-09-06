import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, unwrapApiResult } from "@/api/client";
import type { components } from "@/api/generated/schema";
import type { DeletedFilter, SortOrder } from "./usePagination";

const KEY = "expirations";
const SUMMARY_KEY = "expirations-summary";

export type Expiration = components["schemas"]["Expiration"];
export type ExpirationDetail = components["schemas"]["ExpirationDetail"];
export type ExpirationSummary = components["schemas"]["ExpirationSummary"];
export type ExpirationType = components["schemas"]["ExpirationType"];
export type ExpirationStatus = components["schemas"]["ExpirationStatus"];

export const EXPIRATION_TYPES: ExpirationType[] = [
  "ssl_certificate",
  "hardware_ma",
  "software_license",
  "warranty",
  "domain_or_cloud",
];

export const EXPIRATION_STATUSES: ExpirationStatus[] = [
  "active",
  "renewed",
  "expired",
];

export type ExpirationSort = "expiry_date" | "name" | "created_at" | "updated_at";

export interface ExpirationFilters {
  clientId?: string;
  projectId?: string;
  serverId?: string;
  type?: ExpirationType | string;
  status?: ExpirationStatus | string;
  daysAhead?: number;
  page?: number;
  per_page?: number;
  sort?: ExpirationSort;
  order?: SortOrder;
  search?: string;
  deleted?: DeletedFilter;
}

export function useExpirations(filters: ExpirationFilters = {}) {
  const query = useQuery({
    queryKey: [KEY, filters],
    queryFn: async () => {
      const result = await apiClient.GET("/api/expirations", {
        params: {
          query: {
            page: filters.page,
            per_page: filters.per_page,
            sort: filters.sort,
            order: filters.order,
            search: filters.search,
            client_id: filters.clientId,
            project_id: filters.projectId,
            server_id: filters.serverId,
            type: filters.type,
            status: filters.status,
            days_ahead: filters.daysAhead,
            deleted: filters.deleted ?? "false",
          },
        },
      });
      return unwrapApiResult(result);
    },
  });

  return { ...query, data: query.data?.data, pagination: query.data?.pagination };
}

export function useExpirationsSummary(clientId?: string) {
  return useQuery({
    queryKey: [SUMMARY_KEY, { clientId }],
    queryFn: async () => {
      const result = await apiClient.GET("/api/expirations/summary", {
        params: {
          query: {
            client_id: clientId,
          },
        },
      });
      return unwrapApiResult(result);
    },
  });
}

export function useExpiration(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, id],
    queryFn: async () => {
      const result = await apiClient.GET("/api/expirations/{id}", {
        params: { path: { id: id as string } },
      });
      return unwrapApiResult(result);
    },
    enabled: Boolean(id),
  });
}

export interface CreateExpirationInput {
  client_id: string;
  project_id?: string | null;
  server_id?: string | null;
  type: ExpirationType;
  name: string;
  provider_or_vendor?: string | null;
  identifier?: string | null;
  expiry_date: string;
  alert_threshold_days?: number;
  status?: ExpirationStatus;
  notes?: string | null;
}

export function useCreateExpiration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExpirationInput) => {
      const result = await apiClient.POST("/api/expirations", {
        body: input,
      });
      return unwrapApiResult(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: [SUMMARY_KEY] });
    },
  });
}

export interface UpdateExpirationInput {
  client_id?: string;
  project_id?: string | null;
  server_id?: string | null;
  type?: ExpirationType;
  name?: string;
  provider_or_vendor?: string | null;
  identifier?: string | null;
  expiry_date?: string;
  alert_threshold_days?: number;
  status?: ExpirationStatus;
  notes?: string | null;
  /** Required for the API's optimistic lock — every PATCH needs this. */
  updated_at: string;
}

export function useUpdateExpiration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateExpirationInput }) => {
      const result = await apiClient.PATCH("/api/expirations/{id}", {
        params: { path: { id } },
        body: data,
      });
      return unwrapApiResult(result);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: [KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: [SUMMARY_KEY] });
    },
  });
}

export function useDeleteExpiration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.DELETE("/api/expirations/{id}", {
        params: { path: { id } },
      });
      return unwrapApiResult(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: [SUMMARY_KEY] });
    },
  });
}

export function useRestoreExpiration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.POST("/api/expirations/{id}/restore", {
        params: { path: { id } },
      });
      return unwrapApiResult(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: [SUMMARY_KEY] });
    },
  });
}
