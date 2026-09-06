import { pool } from "../db/pool";
import { withTransaction } from "../db/withTransaction";
import { ApiError } from "../middleware/errorHandler";
import { logActivity } from "../middleware/activityLogger";
import {
  Expiration,
  ExpirationDetail,
  ExpirationListItem,
  ExpirationSummary,
} from "../types";
import {
  CreateExpirationInput,
  UpdateExpirationInput,
} from "../validators/expirations.validator";

const SORTABLE_COLUMNS = new Set(["expiry_date", "name", "created_at", "updated_at"]);
const UNIQUE_VIOLATION = "23505";

function computedFieldsExpr(alias = "expirations"): string {
  return `
    (${alias}.expiry_date - CURRENT_DATE)::int AS days_until_expiry,
    (${alias}.expiry_date < CURRENT_DATE) AS is_expired,
    (${alias}.expiry_date <= CURRENT_DATE + INTERVAL '7 days') AS is_critical,
    (${alias}.expiry_date > CURRENT_DATE + INTERVAL '7 days' AND ${alias}.expiry_date <= CURRENT_DATE + INTERVAL '30 days') AS is_expiring_soon
  `;
}

export interface ListExpirationsParams {
  page: number;
  perPage: number;
  sort: string;
  order: "asc" | "desc";
  search?: string;
  clientId?: string;
  projectId?: string;
  serverId?: string;
  type?: string;
  status?: string;
  daysAhead?: number;
  deletedMode: "false" | "true" | "all";
}

export interface ListExpirationsResult {
  data: ExpirationListItem[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export async function listExpirations(
  params: ListExpirationsParams
): Promise<ListExpirationsResult> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.deletedMode === "true") {
    conditions.push("deleted_at IS NOT NULL");
  } else if (params.deletedMode === "false") {
    conditions.push("deleted_at IS NULL");
  }

  if (params.search) {
    values.push(`%${params.search}%`);
    conditions.push(
      `(name ILIKE $${values.length} OR provider_or_vendor ILIKE $${values.length} OR identifier ILIKE $${values.length})`
    );
  }

  if (params.clientId) {
    values.push(params.clientId);
    conditions.push(`client_id = $${values.length}`);
  }

  if (params.projectId) {
    values.push(params.projectId);
    conditions.push(`project_id = $${values.length}`);
  }

  if (params.serverId) {
    values.push(params.serverId);
    conditions.push(`server_id = $${values.length}`);
  }

  if (params.type) {
    values.push(params.type);
    conditions.push(`type = $${values.length}`);
  }

  if (params.status) {
    values.push(params.status);
    conditions.push(`status = $${values.length}`);
  }

  if (typeof params.daysAhead === "number" && !isNaN(params.daysAhead)) {
    values.push(params.daysAhead);
    conditions.push(`expiry_date <= CURRENT_DATE + ($${values.length} * INTERVAL '1 day')`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const sortColumn = SORTABLE_COLUMNS.has(params.sort) ? params.sort : "expiry_date";
  const orderDirection = params.order === "desc" ? "DESC" : "ASC";

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM expirations ${where}`,
    values
  );
  const total = Number(countResult.rows[0].count);

  const limitParamIndex = values.length + 1;
  const offsetParamIndex = values.length + 2;
  values.push(params.perPage, (params.page - 1) * params.perPage);

  const dataResult = await pool.query<ExpirationListItem>(
    `SELECT *, ${computedFieldsExpr("expirations")}
     FROM expirations ${where}
     ORDER BY ${sortColumn} ${orderDirection}
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`,
    values
  );

  return {
    data: dataResult.rows,
    pagination: {
      page: params.page,
      per_page: params.perPage,
      total,
      total_pages: total === 0 ? 0 : Math.ceil(total / params.perPage),
    },
  };
}

export async function getExpiringSummary(
  clientId?: string
): Promise<ExpirationSummary> {
  const conditions: string[] = ["deleted_at IS NULL"];
  const values: unknown[] = [];

  if (clientId) {
    values.push(clientId);
    conditions.push(`client_id = $${values.length}`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const result = await pool.query<{
    expired_count: string;
    critical_count: string;
    warning_count: string;
    upcoming_count: string;
  }>(
    `SELECT
       COUNT(*) FILTER (
         WHERE expiry_date < CURRENT_DATE
           AND status != 'renewed'
       )::text AS expired_count,
       COUNT(*) FILTER (
         WHERE expiry_date >= CURRENT_DATE
           AND expiry_date <= CURRENT_DATE + INTERVAL '7 days'
           AND status != 'renewed'
       )::text AS critical_count,
       COUNT(*) FILTER (
         WHERE expiry_date > CURRENT_DATE + INTERVAL '7 days'
           AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'
           AND status != 'renewed'
       )::text AS warning_count,
       COUNT(*) FILTER (
         WHERE expiry_date > CURRENT_DATE + INTERVAL '30 days'
           AND expiry_date <= CURRENT_DATE + INTERVAL '90 days'
           AND status != 'renewed'
       )::text AS upcoming_count
     FROM expirations
     ${where}`,
    values
  );

  const row = result.rows[0];
  return {
    expired_count: Number(row?.expired_count || 0),
    critical_count: Number(row?.critical_count || 0),
    warning_count: Number(row?.warning_count || 0),
    upcoming_count: Number(row?.upcoming_count || 0),
  };
}

export async function getExpirationById(
  id: string,
  opts: { includeDeleted?: boolean } = {}
): Promise<ExpirationDetail> {
  const deletedCondition = opts.includeDeleted ? "" : "AND e.deleted_at IS NULL";
  const result = await pool.query<
    ExpirationListItem & {
      client_ref_id: string;
      client_name: string;
      project_ref_id: string | null;
      project_name: string | null;
      server_ref_id: string | null;
      server_display_name: string | null;
    }
  >(
    `SELECT e.*,
            ${computedFieldsExpr("e")},
            c.id AS client_ref_id, c.name AS client_name,
            p.id AS project_ref_id, p.name AS project_name,
            s.id AS server_ref_id, s.display_name AS server_display_name
     FROM expirations e
     JOIN clients c ON c.id = e.client_id
     LEFT JOIN projects p ON p.id = e.project_id
     LEFT JOIN servers s ON s.id = e.server_id
     WHERE e.id = $1 ${deletedCondition}`,
    [id]
  );

  const row = result.rows[0];
  if (!row) throw new ApiError(404, "Expiration not found");

  const {
    client_ref_id,
    client_name,
    project_ref_id,
    project_name,
    server_ref_id,
    server_display_name,
    ...item
  } = row;

  return {
    ...item,
    client: { id: client_ref_id, name: client_name },
    project: project_ref_id && project_name ? { id: project_ref_id, name: project_name } : null,
    server: server_ref_id && server_display_name ? { id: server_ref_id, display_name: server_display_name } : null,
  };
}

export async function createExpiration(
  input: CreateExpirationInput,
  actingPeopleId: string
): Promise<Expiration> {
  return withTransaction(async (tx) => {
    // Validate client
    const clientCheck = await tx.query(
      `SELECT id FROM clients WHERE id = $1 AND deleted_at IS NULL`,
      [input.client_id]
    );
    if (clientCheck.rows.length === 0) {
      throw new ApiError(
        400,
        "client_id does not reference an existing client",
        "VALIDATION_ERROR",
        { field: "client_id" }
      );
    }

    // Validate project if provided
    if (input.project_id) {
      const projectCheck = await tx.query(
        `SELECT id FROM projects WHERE id = $1 AND deleted_at IS NULL`,
        [input.project_id]
      );
      if (projectCheck.rows.length === 0) {
        throw new ApiError(
          400,
          "project_id does not reference an existing project",
          "VALIDATION_ERROR",
          { field: "project_id" }
        );
      }
    }

    // Validate server if provided
    if (input.server_id) {
      const serverCheck = await tx.query(
        `SELECT id FROM servers WHERE id = $1 AND deleted_at IS NULL`,
        [input.server_id]
      );
      if (serverCheck.rows.length === 0) {
        throw new ApiError(
          400,
          "server_id does not reference an existing server",
          "VALIDATION_ERROR",
          { field: "server_id" }
        );
      }
    }

    try {
      const result = await tx.query<Expiration>(
        `INSERT INTO expirations (
           client_id, project_id, server_id, type, name,
           provider_or_vendor, identifier, expiry_date,
           alert_threshold_days, status, notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          input.client_id,
          input.project_id ?? null,
          input.server_id ?? null,
          input.type,
          input.name,
          input.provider_or_vendor ?? null,
          input.identifier ?? null,
          input.expiry_date,
          input.alert_threshold_days ?? 30,
          input.status ?? "active",
          input.notes ?? null,
        ]
      );
      const created = result.rows[0];
      await logActivity("expiration", created.id, "create", actingPeopleId, null, created, tx);
      return created;
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ApiError(409, "A conflicting expiration already exists", "CONFLICT");
      }
      throw err;
    }
  });
}

export async function updateExpiration(
  id: string,
  input: UpdateExpirationInput,
  actingPeopleId: string
): Promise<Expiration> {
  return withTransaction(async (tx) => {
    const existingResult = await tx.query<Expiration>(
      `SELECT * FROM expirations WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    const existing = existingResult.rows[0];
    if (!existing) throw new ApiError(404, "Expiration not found");

    if (input.client_id) {
      const clientCheck = await tx.query(
        `SELECT id FROM clients WHERE id = $1 AND deleted_at IS NULL`,
        [input.client_id]
      );
      if (clientCheck.rows.length === 0) {
        throw new ApiError(
          400,
          "client_id does not reference an existing client",
          "VALIDATION_ERROR",
          { field: "client_id" }
        );
      }
    }

    if (input.project_id) {
      const projectCheck = await tx.query(
        `SELECT id FROM projects WHERE id = $1 AND deleted_at IS NULL`,
        [input.project_id]
      );
      if (projectCheck.rows.length === 0) {
        throw new ApiError(
          400,
          "project_id does not reference an existing project",
          "VALIDATION_ERROR",
          { field: "project_id" }
        );
      }
    }

    if (input.server_id) {
      const serverCheck = await tx.query(
        `SELECT id FROM servers WHERE id = $1 AND deleted_at IS NULL`,
        [input.server_id]
      );
      if (serverCheck.rows.length === 0) {
        throw new ApiError(
          400,
          "server_id does not reference an existing server",
          "VALIDATION_ERROR",
          { field: "server_id" }
        );
      }
    }

    try {
      const result = await tx.query<Expiration>(
        `UPDATE expirations
         SET client_id = COALESCE($3::uuid, client_id),
             project_id = CASE WHEN $4::text = '__CLEAR__' THEN NULL WHEN $4::text IS NOT NULL THEN $4::uuid ELSE project_id END,
             server_id = CASE WHEN $5::text = '__CLEAR__' THEN NULL WHEN $5::text IS NOT NULL THEN $5::uuid ELSE server_id END,
             type = COALESCE($6::expiration_type_enum, type),
             name = COALESCE($7::text, name),
             provider_or_vendor = CASE WHEN $8::text = '__CLEAR__' THEN NULL WHEN $8::text IS NOT NULL THEN $8::text ELSE provider_or_vendor END,
             identifier = CASE WHEN $9::text = '__CLEAR__' THEN NULL WHEN $9::text IS NOT NULL THEN $9::text ELSE identifier END,
             expiry_date = COALESCE($10::date, expiry_date),
             alert_threshold_days = COALESCE($11::int, alert_threshold_days),
             status = COALESCE($12::expiration_status_enum, status),
             notes = CASE WHEN $13::text = '__CLEAR__' THEN NULL WHEN $13::text IS NOT NULL THEN $13::text ELSE notes END,
             updated_at = now()
         WHERE id = $1
           AND date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', $2::timestamptz)
           AND deleted_at IS NULL
         RETURNING *`,
        [
          id,
          input.updated_at,
          input.client_id ?? null,
          input.project_id === null ? "__CLEAR__" : (input.project_id ?? null),
          input.server_id === null ? "__CLEAR__" : (input.server_id ?? null),
          input.type ?? null,
          input.name ?? null,
          input.provider_or_vendor === null ? "__CLEAR__" : (input.provider_or_vendor ?? null),
          input.identifier === null ? "__CLEAR__" : (input.identifier ?? null),
          input.expiry_date ?? null,
          input.alert_threshold_days ?? null,
          input.status ?? null,
          input.notes === null ? "__CLEAR__" : (input.notes ?? null),
        ]
      );

      const updated = result.rows[0];
      if (!updated) {
        throw new ApiError(
          409,
          "Expiration was modified by someone else; refresh and try again",
          "CONFLICT"
        );
      }

      await logActivity("expiration", updated.id, "update", actingPeopleId, existing, updated, tx);
      return updated;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ApiError(409, "A conflicting expiration already exists", "CONFLICT");
      }
      throw err;
    }
  });
}

export async function softDeleteExpiration(
  id: string,
  actingPeopleId: string
): Promise<Expiration> {
  return withTransaction(async (tx) => {
    const existingResult = await tx.query<Expiration>(
      `SELECT * FROM expirations WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    const existing = existingResult.rows[0];
    if (!existing) throw new ApiError(404, "Expiration not found");

    const result = await tx.query<Expiration>(
      `UPDATE expirations SET deleted_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );
    const deleted = result.rows[0];
    await logActivity("expiration", deleted.id, "delete", actingPeopleId, existing, deleted, tx);
    return deleted;
  });
}

export async function restoreExpiration(
  id: string,
  actingPeopleId: string
): Promise<Expiration> {
  return withTransaction(async (tx) => {
    const existingResult = await tx.query<Expiration>(
      `SELECT * FROM expirations WHERE id = $1`,
      [id]
    );
    const existing = existingResult.rows[0];
    if (!existing) throw new ApiError(404, "Expiration not found");
    if (!existing.deleted_at) {
      throw new ApiError(409, "Expiration is not deleted", "CONFLICT");
    }

    try {
      const result = await tx.query<Expiration>(
        `UPDATE expirations SET deleted_at = NULL, updated_at = now()
         WHERE id = $1 AND deleted_at IS NOT NULL
         RETURNING *`,
        [id]
      );
      const restored = result.rows[0];
      await logActivity("expiration", restored.id, "restore", actingPeopleId, existing, restored, tx);
      return restored;
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ApiError(409, "A conflicting expiration already exists", "CONFLICT");
      }
      throw err;
    }
  });
}
