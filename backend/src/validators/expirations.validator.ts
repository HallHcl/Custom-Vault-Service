import { z } from "zod";

export const EXPIRATION_TYPES = [
  "ssl_certificate",
  "hardware_ma",
  "software_license",
  "warranty",
  "domain_or_cloud",
] as const;

export const EXPIRATION_STATUSES = ["active", "renewed", "expired"] as const;

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const createExpirationSchema = z.object({
  client_id: z.string().uuid(),
  project_id: z.string().uuid().nullable().optional(),
  server_id: z.string().uuid().nullable().optional(),
  type: z.enum(EXPIRATION_TYPES),
  name: z.string().min(1),
  provider_or_vendor: z.string().nullable().optional(),
  identifier: z.string().nullable().optional(),
  expiry_date: dateStringSchema,
  alert_threshold_days: z.number().int().min(1).optional().default(30),
  status: z.enum(EXPIRATION_STATUSES).optional().default("active"),
  notes: z.string().nullable().optional(),
});

export const updateExpirationSchema = z.object({
  client_id: z.string().uuid().optional(),
  project_id: z.string().uuid().nullable().optional(),
  server_id: z.string().uuid().nullable().optional(),
  type: z.enum(EXPIRATION_TYPES).optional(),
  name: z.string().min(1).optional(),
  provider_or_vendor: z.string().nullable().optional(),
  identifier: z.string().nullable().optional(),
  expiry_date: dateStringSchema.optional(),
  alert_threshold_days: z.number().int().min(1).optional(),
  status: z.enum(EXPIRATION_STATUSES).optional(),
  notes: z.string().nullable().optional(),
  updated_at: z.string().min(1),
});

export const listExpirationsQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(100).optional(),
  sort: z.enum(["expiry_date", "name", "created_at", "updated_at"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  search: z.string().optional(),
  client_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  server_id: z.string().uuid().optional(),
  type: z.enum(EXPIRATION_TYPES).optional(),
  status: z.enum(EXPIRATION_STATUSES).optional(),
  days_ahead: z.number().int().min(0).optional(),
  deleted: z.enum(["false", "true", "all"]).optional(),
});

export type CreateExpirationInput = z.infer<typeof createExpirationSchema>;
export type UpdateExpirationInput = z.infer<typeof updateExpirationSchema>;
export type ListExpirationsQuery = z.infer<typeof listExpirationsQuerySchema>;
