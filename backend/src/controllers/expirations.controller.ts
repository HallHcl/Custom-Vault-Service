import { Request, Response } from "express";
import { ApiError } from "../middleware/errorHandler";
import { paramId, requireChangedBy } from "../utils/requestContext";
import {
  createExpirationSchema,
  updateExpirationSchema,
} from "../validators/expirations.validator";
import {
  createExpiration,
  getExpirationById,
  getExpiringSummary,
  listExpirations,
  ListExpirationsParams,
  restoreExpiration,
  softDeleteExpiration,
  updateExpiration,
} from "../services/expirations.service";

const SORTABLE_COLUMNS = new Set(["expiry_date", "name", "created_at", "updated_at"]);
const DELETED_MODES = new Set(["false", "true", "all"]);

function parseListQuery(req: Request): ListExpirationsParams {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, parseInt(String(req.query.per_page ?? "20"), 10) || 20)
  );
  const sortParam = String(req.query.sort ?? "expiry_date");
  const sort = SORTABLE_COLUMNS.has(sortParam) ? sortParam : "expiry_date";
  const order = String(req.query.order ?? "asc").toLowerCase() === "desc" ? "desc" : "asc";

  const search =
    typeof req.query.search === "string" && req.query.search.length > 0
      ? req.query.search
      : undefined;

  const clientId =
    typeof req.query.client_id === "string" && req.query.client_id.length > 0
      ? req.query.client_id
      : undefined;

  const projectId =
    typeof req.query.project_id === "string" && req.query.project_id.length > 0
      ? req.query.project_id
      : undefined;

  const serverId =
    typeof req.query.server_id === "string" && req.query.server_id.length > 0
      ? req.query.server_id
      : undefined;

  const type =
    typeof req.query.type === "string" && req.query.type.length > 0
      ? req.query.type
      : undefined;

  const status =
    typeof req.query.status === "string" && req.query.status.length > 0
      ? req.query.status
      : undefined;

  const daysAheadParam = req.query.days_ahead;
  const daysAhead =
    daysAheadParam !== undefined && daysAheadParam !== ""
      ? parseInt(String(daysAheadParam), 10)
      : undefined;

  const deletedParam = String(req.query.deleted ?? "false");
  const deletedMode = (DELETED_MODES.has(deletedParam) ? deletedParam : "false") as
    | "false"
    | "true"
    | "all";

  return {
    page,
    perPage,
    sort,
    order,
    search,
    clientId,
    projectId,
    serverId,
    type,
    status,
    daysAhead: Number.isInteger(daysAhead) ? daysAhead : undefined,
    deletedMode,
  };
}

export async function list(req: Request, res: Response) {
  const result = await listExpirations(parseListQuery(req));
  res.json(result);
}

export async function getSummary(req: Request, res: Response) {
  const clientId =
    typeof req.query.client_id === "string" && req.query.client_id.length > 0
      ? req.query.client_id
      : undefined;

  const summary = await getExpiringSummary(clientId);
  res.json(summary);
}

export async function getOne(req: Request, res: Response) {
  const expiration = await getExpirationById(paramId(req, "id"));
  res.json(expiration);
}

export async function create(req: Request, res: Response) {
  const parseResult = createExpirationSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new ApiError(400, "Validation failed", "VALIDATION_ERROR", parseResult.error.flatten());
  }
  const changedBy = requireChangedBy(req);

  const created = await createExpiration(parseResult.data, changedBy);
  res.status(201).json(created);
}

export async function update(req: Request, res: Response) {
  const parseResult = updateExpirationSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new ApiError(400, "Validation failed", "VALIDATION_ERROR", parseResult.error.flatten());
  }
  const changedBy = requireChangedBy(req);

  const updated = await updateExpiration(paramId(req, "id"), parseResult.data, changedBy);
  res.json(updated);
}

export async function remove(req: Request, res: Response) {
  const changedBy = requireChangedBy(req);
  const deleted = await softDeleteExpiration(paramId(req, "id"), changedBy);
  res.json(deleted);
}

export async function restore(req: Request, res: Response) {
  const changedBy = requireChangedBy(req);
  const restored = await restoreExpiration(paramId(req, "id"), changedBy);
  res.json(restored);
}
