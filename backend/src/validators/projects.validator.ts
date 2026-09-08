import { z } from "zod";

// client_id is optional: the Client feature/UI is hidden (see nav-items.ts /
// AppRoutes.tsx). The frontend no longer sends one, and the service falls
// back to the default client. Kept in the schema (not removed) so the column
// and the Clients API stay intact and this can be reversed by simply
// un-hiding the UI — no migration needed.
export const createProjectSchema = z.object({
  client_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  owner_status: z.string().optional().default("active"),
});

// client_id is intentionally omitted: re-parenting a project to a different
// client is not supported via PATCH. The controller rejects any request body
// that includes `client_id` before this schema even runs.
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  owner_status: z.string().optional(),
  updated_at: z.string().min(1),
});

export const listProjectsQuerySchema = z.object({
  page: z.number().int().min(1),
  per_page: z.number().int().min(1).max(100),
  sort: z.enum(["name", "created_at", "updated_at"]),
  order: z.enum(["asc", "desc"]),
  search: z.string().optional(),
  client_id: z.string().uuid().optional(),
  deleted: z.enum(["false", "true", "all"]),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
