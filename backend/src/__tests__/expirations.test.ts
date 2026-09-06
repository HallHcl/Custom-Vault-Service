import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../app";
import { pool } from "../db/pool";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

const RUN_ID = Date.now();
const PREFIX = `ExpTest_${RUN_ID}_`;

const MEMBER_USERNAME = `test_member_expirations_${RUN_ID}`;
const MEMBER_PASSWORD = "memberPass123";

let adminToken: string;
let memberToken: string;
let memberUserId: string;
let memberPersonId: string;

let clientId: string;
let secondClientId: string;
let projectId: string;
let serverId: string;

const createdClientIds: string[] = [];
const createdProjectIds: string[] = [];
const createdEnvironmentIds: string[] = [];
const createdServerIds: string[] = [];
const createdExpirationIds: string[] = [];

function formatDateOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

function validExpirationBody(overrides: Record<string, unknown> = {}) {
  return {
    client_id: clientId,
    project_id: projectId,
    server_id: serverId,
    type: "ssl_certificate",
    name: `${PREFIX}Wildcard SSL`,
    provider_or_vendor: "Let's Encrypt",
    identifier: "*.example.com",
    expiry_date: formatDateOffset(15),
    alert_threshold_days: 30,
    status: "active",
    notes: "Auto-renew via certbot",
    ...overrides,
  };
}

async function createExpirationAs(token: string, body: Record<string, unknown>) {
  const res = await request(app)
    .post("/api/expirations")
    .set("Authorization", `Bearer ${token}`)
    .send(body);
  if (res.status === 201) createdExpirationIds.push(res.body.id);
  return res;
}

beforeAll(async () => {
  const roleRow = await pool.query<{ id: string }>(
    `SELECT id FROM roles WHERE name = 'member' AND deleted_at IS NULL`
  );
  if (roleRow.rows.length === 0) {
    throw new Error("Seeded 'member' role not found. Run `npm run seed` first.");
  }
  const memberRoleId = roleRow.rows[0].id;

  const personRow = await pool.query<{ id: string }>(
    `INSERT INTO people (name, type) VALUES ($1, 'internal_engineer') RETURNING id`,
    [`Test Member Exp ${RUN_ID}`]
  );
  memberPersonId = personRow.rows[0].id;

  const memberHash = await bcrypt.hash(MEMBER_PASSWORD, 10);
  const memberRow = await pool.query<{ id: string }>(
    `INSERT INTO users (people_id, username, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`,
    [memberPersonId, MEMBER_USERNAME, `${MEMBER_USERNAME}@example.com`, memberHash]
  );
  memberUserId = memberRow.rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [
    memberUserId,
    memberRoleId,
  ]);

  const adminLogin = await request(app)
    .post("/api/auth/login")
    .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  adminToken = adminLogin.body.token;

  const memberLogin = await request(app)
    .post("/api/auth/login")
    .send({ username: MEMBER_USERNAME, password: MEMBER_PASSWORD });
  memberToken = memberLogin.body.token;

  // Primary fixture client
  const clientRes = await request(app)
    .post("/api/clients")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: `${PREFIX}Client` });
  clientId = clientRes.body.id;
  createdClientIds.push(clientId);

  // Secondary fixture client for summary isolation testing
  const client2Res = await request(app)
    .post("/api/clients")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: `${PREFIX}Client2` });
  secondClientId = client2Res.body.id;
  createdClientIds.push(secondClientId);

  const projectRes = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ client_id: clientId, name: `${PREFIX}Project` });
  projectId = projectRes.body.id;
  createdProjectIds.push(projectId);

  const envRes = await request(app)
    .post("/api/environments")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ project_id: projectId, name: `${PREFIX}PROD` });
  const environmentId = envRes.body.id;
  createdEnvironmentIds.push(environmentId);

  const serverRes = await request(app)
    .post("/api/servers")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      environment_id: environmentId,
      display_name: `${PREFIX}AppServer`,
      hostname: `app-${RUN_ID}.internal`,
      service_type: "application",
      access_method: "web",
      access_host: "10.10.1.1",
    });
  serverId = serverRes.body.id;
  createdServerIds.push(serverId);
});

afterAll(async () => {
  if (createdExpirationIds.length > 0) {
    await pool.query(`DELETE FROM expirations WHERE id = ANY($1::uuid[])`, [createdExpirationIds]);
  }
  if (createdServerIds.length > 0) {
    await pool.query(`DELETE FROM servers WHERE id = ANY($1::uuid[])`, [createdServerIds]);
  }
  if (createdEnvironmentIds.length > 0) {
    await pool.query(`DELETE FROM environments WHERE id = ANY($1::uuid[])`, [createdEnvironmentIds]);
  }
  if (createdProjectIds.length > 0) {
    await pool.query(`DELETE FROM projects WHERE id = ANY($1::uuid[])`, [createdProjectIds]);
  }
  if (createdClientIds.length > 0) {
    await pool.query(`DELETE FROM clients WHERE id = ANY($1::uuid[])`, [createdClientIds]);
  }
  if (memberUserId) {
    await pool.query(`DELETE FROM user_roles WHERE user_id = $1`, [memberUserId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [memberUserId]);
  }
  // The test person is NOT deleted: activity_logs.changed_by FKs to people(id)
  // ON DELETE RESTRICT (activity_logs is append-only and keeps audit trail),
  // and this suite's create/update/delete/restore actions all logged against it.
});

describe("Expirations Module API", () => {
  describe("POST /api/expirations (Creation & RBAC)", () => {
    it("allows a member to create an expiration record (201)", async () => {
      const res = await createExpirationAs(memberToken, validExpirationBody({
        name: `${PREFIX}Member Created Cert`,
      }));
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(`${PREFIX}Member Created Cert`);
      expect(res.body.client_id).toBe(clientId);
      expect(res.body.type).toBe("ssl_certificate");
      expect(res.body.status).toBe("active");
      expect(res.body.deleted_at).toBeNull();
    });

    it("allows an admin to create an expiration record (201)", async () => {
      const res = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Admin Created Hardware MA`,
        type: "hardware_ma",
      }));
      expect(res.status).toBe(201);
      expect(res.body.type).toBe("hardware_ma");
    });

    it("rejects unauthenticated requests (401)", async () => {
      const res = await request(app)
        .post("/api/expirations")
        .send(validExpirationBody());
      expect(res.status).toBe(401);
    });

    it("rejects invalid body missing required fields (400)", async () => {
      const res = await request(app)
        .post("/api/expirations")
        .set("Authorization", `Bearer ${memberToken}`)
        .send({ client_id: clientId }); // missing name, type, expiry_date
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe("VALIDATION_ERROR");
    });

    it("rejects non-existent client_id with validation error (400)", async () => {
      const res = await request(app)
        .post("/api/expirations")
        .set("Authorization", `Bearer ${memberToken}`)
        .send(validExpirationBody({
          client_id: "00000000-0000-0000-0000-000000000000",
        }));
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("GET /api/expirations (List & Computed SQL Fields)", () => {
    let expiredId: string;
    let criticalId: string;
    let warningId: string;
    let upcomingId: string;

    beforeAll(async () => {
      // Past: 5 days ago
      const expiredRes = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Expired Item`,
        expiry_date: formatDateOffset(-5),
      }));
      expiredId = expiredRes.body.id;

      // Critical: 3 days ahead (<= 7d)
      const critRes = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Critical Item`,
        expiry_date: formatDateOffset(3),
      }));
      criticalId = critRes.body.id;

      // Warning: 15 days ahead (8-30d)
      const warnRes = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Warning Item`,
        expiry_date: formatDateOffset(15),
      }));
      warningId = warnRes.body.id;

      // Upcoming: 60 days ahead (31-90d)
      const upRes = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Upcoming Item`,
        expiry_date: formatDateOffset(60),
      }));
      upcomingId = upRes.body.id;
    });

    it("returns computed status fields: is_expired, is_critical, is_expiring_soon, days_until_expiry", async () => {
      const res = await request(app)
        .get("/api/expirations")
        .set("Authorization", `Bearer ${memberToken}`)
        .query({ search: PREFIX });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const expired = res.body.data.find((e: { id: string }) => e.id === expiredId);
      expect(expired).toBeDefined();
      expect(expired.is_expired).toBe(true);
      expect(expired.is_critical).toBe(true); // <= 7d includes past
      expect(expired.days_until_expiry).toBeLessThan(0);

      const critical = res.body.data.find((e: { id: string }) => e.id === criticalId);
      expect(critical).toBeDefined();
      expect(critical.is_expired).toBe(false);
      expect(critical.is_critical).toBe(true);
      expect(critical.is_expiring_soon).toBe(false);
      expect(critical.days_until_expiry).toBe(3);

      const warning = res.body.data.find((e: { id: string }) => e.id === warningId);
      expect(warning).toBeDefined();
      expect(warning.is_expired).toBe(false);
      expect(warning.is_critical).toBe(false);
      expect(warning.is_expiring_soon).toBe(true);
      expect(warning.days_until_expiry).toBe(15);

      const upcoming = res.body.data.find((e: { id: string }) => e.id === upcomingId);
      expect(upcoming).toBeDefined();
      expect(upcoming.is_expired).toBe(false);
      expect(upcoming.is_critical).toBe(false);
      expect(upcoming.is_expiring_soon).toBe(false);
      expect(upcoming.days_until_expiry).toBe(60);
    });

    it("filters list by days_ahead parameter", async () => {
      const res = await request(app)
        .get("/api/expirations")
        .set("Authorization", `Bearer ${memberToken}`)
        .query({ search: PREFIX, days_ahead: 10 });

      expect(res.status).toBe(200);
      const ids = res.body.data.map((e: { id: string }) => e.id);
      expect(ids).toContain(expiredId);
      expect(ids).toContain(criticalId);
      expect(ids).not.toContain(warningId);
      expect(ids).not.toContain(upcomingId);
    });

    it("supports client_id and type filtering", async () => {
      const res = await request(app)
        .get("/api/expirations")
        .set("Authorization", `Bearer ${memberToken}`)
        .query({ client_id: clientId, type: "ssl_certificate" });

      expect(res.status).toBe(200);
      for (const item of res.body.data) {
        expect(item.client_id).toBe(clientId);
        expect(item.type).toBe("ssl_certificate");
      }
    });
  });

  describe("GET /api/expirations/summary (Count Buckets)", () => {
    let secondClientExpId: string;

    beforeAll(async () => {
      // Expiration for second client
      const res = await createExpirationAs(adminToken, validExpirationBody({
        client_id: secondClientId,
        name: `${PREFIX}Client 2 Exp`,
        expiry_date: formatDateOffset(2),
      }));
      secondClientExpId = res.body.id;
    });

    it("returns summary counts for all active expirations", async () => {
      const res = await request(app)
        .get("/api/expirations/summary")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.expired_count).toBe("number");
      expect(typeof res.body.critical_count).toBe("number");
      expect(typeof res.body.warning_count).toBe("number");
      expect(typeof res.body.upcoming_count).toBe("number");
      expect(res.body.expired_count).toBeGreaterThanOrEqual(1);
      expect(res.body.critical_count).toBeGreaterThanOrEqual(1);
      expect(res.body.warning_count).toBeGreaterThanOrEqual(1);
      expect(res.body.upcoming_count).toBeGreaterThanOrEqual(1);
    });

    it("scopes summary counts when client_id filter is passed", async () => {
      const res = await request(app)
        .get("/api/expirations/summary")
        .set("Authorization", `Bearer ${memberToken}`)
        .query({ client_id: secondClientId });

      expect(res.status).toBe(200);
      expect(res.body.critical_count).toBe(1);
      expect(res.body.expired_count).toBe(0);
      expect(res.body.warning_count).toBe(0);
      expect(res.body.upcoming_count).toBe(0);
    });
  });

  describe("GET /api/expirations/:id", () => {
    it("returns expiration detail with inlined client, project, and server metadata", async () => {
      const createRes = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Detail Test`,
      }));

      const res = await request(app)
        .get(`/api/expirations/${createRes.body.id}`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createRes.body.id);
      expect(res.body.client.id).toBe(clientId);
      expect(res.body.client.name).toBe(`${PREFIX}Client`);
      expect(res.body.project.id).toBe(projectId);
      expect(res.body.server.id).toBe(serverId);
      expect(res.body.days_until_expiry).toBeDefined();
    });

    it("returns 404 for non-existent id", async () => {
      const res = await request(app)
        .get("/api/expirations/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${memberToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/expirations/:id (Optimistic Concurrency & Renewals)", () => {
    it("updates expiration fields and supports marking as renewed", async () => {
      const createRes = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Renewal Candidate`,
        expiry_date: formatDateOffset(10),
      }));
      const expId = createRes.body.id;
      const initialUpdatedAt = createRes.body.updated_at;

      const newExpiry = formatDateOffset(365);
      const updateRes = await request(app)
        .patch(`/api/expirations/${expId}`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          name: `${PREFIX}Renewed Cert`,
          status: "renewed",
          expiry_date: newExpiry,
          updated_at: initialUpdatedAt,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe(`${PREFIX}Renewed Cert`);
      expect(updateRes.body.status).toBe("renewed");
      const returnedDate = new Date(updateRes.body.expiry_date);
      const expectedDate = new Date(newExpiry);
      expect(returnedDate.getFullYear()).toBe(expectedDate.getFullYear());
      expect(returnedDate.getMonth()).toBe(expectedDate.getMonth());
      expect(returnedDate.getDate()).toBe(expectedDate.getDate());
    });

    it("returns 409 CONFLICT on stale updated_at", async () => {
      const createRes = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Concurrency Target`,
      }));
      const expId = createRes.body.id;
      const staleUpdatedAt = "2020-01-01T00:00:00.000Z";

      const updateRes = await request(app)
        .patch(`/api/expirations/${expId}`)
        .set("Authorization", `Bearer ${memberToken}`)
        .send({
          name: `${PREFIX}Conflict Update`,
          updated_at: staleUpdatedAt,
        });

      expect(updateRes.status).toBe(409);
      expect(updateRes.body.error?.code).toBe("CONFLICT");
    });
  });

  describe("DELETE & POST /restore (Soft Delete & RBAC)", () => {
    it("rejects deletion by non-admin member (403)", async () => {
      const createRes = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Delete RBAC Test`,
      }));

      const res = await request(app)
        .delete(`/api/expirations/${createRes.body.id}`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });

    it("allows admin to soft-delete (200, sets deleted_at) and hides from GET (404)", async () => {
      const createRes = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Soft Delete Test`,
      }));
      const expId = createRes.body.id;

      const deleteRes = await request(app)
        .delete(`/api/expirations/${expId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.deleted_at).not.toBeNull();

      // Subsequent GET should be 404
      const getRes = await request(app)
        .get(`/api/expirations/${expId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(getRes.status).toBe(404);
    });

    it("rejects restore by non-admin member (403)", async () => {
      const createRes = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Restore RBAC Test`,
      }));
      const expId = createRes.body.id;

      await request(app)
        .delete(`/api/expirations/${expId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      const res = await request(app)
        .post(`/api/expirations/${expId}/restore`)
        .set("Authorization", `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });

    it("allows admin to restore (200, deleted_at becomes null)", async () => {
      const createRes = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Restore Success Test`,
      }));
      const expId = createRes.body.id;

      await request(app)
        .delete(`/api/expirations/${expId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      const restoreRes = await request(app)
        .post(`/api/expirations/${expId}/restore`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.deleted_at).toBeNull();

      // Subsequent GET should succeed
      const getRes = await request(app)
        .get(`/api/expirations/${expId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);
    });

    it("returns 409 CONFLICT when attempting to restore a non-deleted expiration", async () => {
      const createRes = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Already Active Test`,
      }));

      const restoreRes = await request(app)
        .post(`/api/expirations/${createRes.body.id}/restore`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(restoreRes.status).toBe(409);
      expect(restoreRes.body.error?.code).toBe("CONFLICT");
    });
  });

  describe("Activity Logging", () => {
    it("creates activity log records for expiration create, update, delete, and restore", async () => {
      const createRes = await createExpirationAs(adminToken, validExpirationBody({
        name: `${PREFIX}Audit Log Target`,
      }));
      const expId = createRes.body.id;

      await request(app)
        .patch(`/api/expirations/${expId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: `${PREFIX}Audit Log Updated`,
          updated_at: createRes.body.updated_at,
        });

      await request(app)
        .delete(`/api/expirations/${expId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      await request(app)
        .post(`/api/expirations/${expId}/restore`)
        .set("Authorization", `Bearer ${adminToken}`);

      const logRes = await pool.query<{ action: string }>(
        `SELECT action FROM activity_logs WHERE entity_type = 'expiration' AND entity_id = $1 ORDER BY created_at ASC`,
        [expId]
      );

      const actions = logRes.rows.map((r) => r.action);
      expect(actions).toContain("create");
      expect(actions).toContain("update");
      expect(actions).toContain("delete");
      expect(actions).toContain("restore");
    });
  });
});
