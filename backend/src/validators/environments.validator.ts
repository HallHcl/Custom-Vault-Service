import { z } from "zod";

// Environment tier. The UI offers these as a dropdown on create; the DB
// column stays free TEXT so historical rows with other names still load and
// can be edited. Only the create path is constrained to the canonical set.
export const ENVIRONMENT_NAMES = ["DEV", "UAT", "PROD"] as const;

// Vendor-side support/lifecycle phase — see migration 012. Mirrors the DB
// CHECK constraint exactly.
export const ENVIRONMENT_STATUSES = [
  "implementation",
  "warranty",
  "in_operation",
  "on_hold",
  "decommissioned",
] as const;

export const createEnvironmentSchema = z.object({
  project_id: z.string().uuid(),
  name: z.enum(ENVIRONMENT_NAMES),
  description: z.string().optional(),
  status: z.enum(ENVIRONMENT_STATUSES).optional().default("implementation"),
});

// project_id is intentionally omitted: environments don't move between
// projects. The controller rejects any request body that includes
// `project_id` before this schema even runs (same pattern as Projects
// rejecting `client_id` re-parenting).
//
// `name` stays a free string here (not the create-time enum): an existing
// environment may carry a legacy name, and edit must not reject it.
export const updateEnvironmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  status: z.enum(ENVIRONMENT_STATUSES).optional(),
  vpn_resource_id: z.string().uuid().nullable().optional(),
  updated_at: z.string().min(1),
});

export const listEnvironmentsQuerySchema = z.object({
  page: z.number().int().min(1),
  per_page: z.number().int().min(1).max(100),
  sort: z.enum(["name", "created_at", "updated_at"]),
  order: z.enum(["asc", "desc"]),
  project_id: z.string().uuid().optional(),
  deleted: z.enum(["false", "true", "all"]),
});

export type CreateEnvironmentInput = z.infer<typeof createEnvironmentSchema>;
export type UpdateEnvironmentInput = z.infer<typeof updateEnvironmentSchema>;
export type ListEnvironmentsQuery = z.infer<typeof listEnvironmentsQuerySchema>;
