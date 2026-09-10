import fs from "fs";
import path from "path";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../app";
import { pool } from "../db/pool";
import { getAttachmentDiskPath, getBaseUploadsDir } from "../middleware/resourceAttachmentUpload";

const RUN_ID = Date.now();
const PREFIX = `AttTest_${RUN_ID}_`;

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

const MEMBER1_USERNAME = `member1_${RUN_ID}`;
const MEMBER2_USERNAME = `member2_${RUN_ID}`;
const TEST_PASSWORD = "password123";

let adminToken: string;
let member1Token: string;
let member2Token: string;

let member1UserId: string;
let member1PersonId: string;
let member2UserId: string;
let member2PersonId: string;

let clientId: string;
let projectId: string;
let resourceId: string;
let initialVersionId: string;

const createdAttachmentIds: string[] = [];
const createdAttachmentPaths: string[] = [];

beforeAll(async () => {
  // 1. Authenticate as seeded admin
  const adminLogin = await request(app)
    .post("/api/auth/login")
    .send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
  adminToken = adminLogin.body.token;

  // 2. Fetch member role
  const roleRow = await pool.query<{ id: string }>(
    `SELECT id FROM roles WHERE name = 'member' AND deleted_at IS NULL`
  );
  if (roleRow.rows.length === 0) {
    throw new Error("Seeded 'member' role not found. Run npm run seed first.");
  }
  const memberRoleId = roleRow.rows[0].id;

  // 3. Create Member 1
  const person1 = await pool.query<{ id: string }>(
    `INSERT INTO people (name, type) VALUES ($1, 'internal_engineer') RETURNING id`,
    [`${PREFIX}Member_1`]
  );
  member1PersonId = person1.rows[0].id;

  const hash1 = await bcrypt.hash(TEST_PASSWORD, 10);
  const user1 = await pool.query<{ id: string }>(
    `INSERT INTO users (people_id, username, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`,
    [member1PersonId, MEMBER1_USERNAME, `${MEMBER1_USERNAME}@example.com`, hash1]
  );
  member1UserId = user1.rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [
    member1UserId,
    memberRoleId,
  ]);

  const login1 = await request(app)
    .post("/api/auth/login")
    .send({ username: MEMBER1_USERNAME, password: TEST_PASSWORD });
  member1Token = login1.body.token;

  // 4. Create Member 2 (for authorization / 403 test)
  const person2 = await pool.query<{ id: string }>(
    `INSERT INTO people (name, type) VALUES ($1, 'internal_engineer') RETURNING id`,
    [`${PREFIX}Member_2`]
  );
  member2PersonId = person2.rows[0].id;

  const hash2 = await bcrypt.hash(TEST_PASSWORD, 10);
  const user2 = await pool.query<{ id: string }>(
    `INSERT INTO users (people_id, username, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`,
    [member2PersonId, MEMBER2_USERNAME, `${MEMBER2_USERNAME}@example.com`, hash2]
  );
  member2UserId = user2.rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [
    member2UserId,
    memberRoleId,
  ]);

  const login2 = await request(app)
    .post("/api/auth/login")
    .send({ username: MEMBER2_USERNAME, password: TEST_PASSWORD });
  member2Token = login2.body.token;

  // 5. Create test client & project
  const clientRes = await request(app)
    .post("/api/clients")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: `${PREFIX}Client` });
  clientId = clientRes.body.id;

  const projectRes = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ client_id: clientId, name: `${PREFIX}Project` });
  projectId = projectRes.body.id;

  // 6. Create test resource with initial version
  const resourceRes = await request(app)
    .post("/api/resources")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      project_id: projectId,
      type: "architecture",
      title: `${PREFIX}Architecture`,
      content: "# Architecture Overview\nSystem diagram attached.",
    });
  resourceId = resourceRes.body.id;
  initialVersionId = resourceRes.body.current_version.id;
});

afterAll(async () => {
  // Clean up created attachments on disk
  for (const relPath of createdAttachmentPaths) {
    try {
      const diskPath = getAttachmentDiskPath(relPath);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    } catch {
      // ignore
    }
  }

  // Remove test resource directory in uploads if empty
  try {
    const resourceDir = path.join(getBaseUploadsDir(), "resources", resourceId);
    if (fs.existsSync(resourceDir)) {
      fs.rmSync(resourceDir, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }

  // Clean up DB records
  if (createdAttachmentIds.length > 0) {
    await pool.query(
      `DELETE FROM resource_attachments WHERE id = ANY($1::uuid[])`,
      [createdAttachmentIds]
    );
  }

  if (resourceId) {
    await pool.query(`DELETE FROM resource_versions WHERE resource_id = $1`, [resourceId]);
    await pool.query(`DELETE FROM resources WHERE id = $1`, [resourceId]);
  }

  if (projectId) {
    await pool.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
  }

  if (clientId) {
    await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
  }

  await pool.query(`DELETE FROM user_roles WHERE user_id IN ($1, $2)`, [
    member1UserId,
    member2UserId,
  ]);
  await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [
    member1UserId,
    member2UserId,
  ]);

  await pool.end();
});

describe("Resource Attachments", () => {
  let pngAttachmentId: string;
  let jpegAttachmentId: string;
  let memberUploadedAttachmentId: string;

  describe("POST /api/resources/:id/attachments (Upload)", () => {
    it("rejects unauthenticated upload requests with 401", async () => {
      const res = await request(app)
        .post(`/api/resources/${resourceId}/attachments`)
        .attach("file", Buffer.from("fake-png"), "diagram.png");

      expect(res.status).toBe(401);
    });

    it("uploads a PNG image with caption successfully as member (201)", async () => {
      const pngBuffer = Buffer.from(
        "\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
      );

      const res = await request(app)
        .post(`/api/resources/${resourceId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`)
        .field("caption", "High level network architecture")
        .field("created_in_version_id", initialVersionId)
        .attach("file", pngBuffer, { filename: "network-diagram.png", contentType: "image/png" });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.resource_id).toBe(resourceId);
      expect(res.body.created_in_version_id).toBe(initialVersionId);
      expect(res.body.file_name).toBe("network-diagram.png");
      expect(res.body.mime_type).toBe("image/png");
      expect(res.body.size_bytes).toBe(pngBuffer.length);
      expect(res.body.caption).toBe("High level network architecture");
      expect(res.body.uploaded_by).toBe(member1PersonId);
      expect(res.body.uploader).toEqual({
        id: member1PersonId,
        name: `${PREFIX}Member_1`,
      });
      expect(res.body.deleted_at).toBeNull();

      pngAttachmentId = res.body.id;
      memberUploadedAttachmentId = res.body.id;
      createdAttachmentIds.push(res.body.id);
      createdAttachmentPaths.push(res.body.file_path);

      // Verify file exists on disk
      const diskPath = getAttachmentDiskPath(res.body.file_path);
      expect(fs.existsSync(diskPath)).toBe(true);
      expect(fs.readFileSync(diskPath)).toEqual(pngBuffer);
    });

    it("uploads a JPEG image as admin (201)", async () => {
      const jpegBuffer = Buffer.from("\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00");

      const res = await request(app)
        .post(`/api/resources/${resourceId}/attachments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", jpegBuffer, { filename: "rack-photo.jpeg", contentType: "image/jpeg" });

      expect(res.status).toBe(201);
      expect(res.body.mime_type).toBe("image/jpeg");
      expect(res.body.caption).toBeNull();
      expect(res.body.created_in_version_id).toBe(initialVersionId);

      jpegAttachmentId = res.body.id;
      createdAttachmentIds.push(res.body.id);
      createdAttachmentPaths.push(res.body.file_path);

      const diskPath = getAttachmentDiskPath(res.body.file_path);
      expect(fs.existsSync(diskPath)).toBe(true);
    });

    it("uploads a WebP image (201)", async () => {
      const webpBuffer = Buffer.from("RIFF\x1a\x00\x00\x00WEBPVP8 ");

      const res = await request(app)
        .post(`/api/resources/${resourceId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`)
        .attach("file", webpBuffer, { filename: "flow.webp", contentType: "image/webp" });

      expect(res.status).toBe(201);
      expect(res.body.mime_type).toBe("image/webp");

      createdAttachmentIds.push(res.body.id);
      createdAttachmentPaths.push(res.body.file_path);
    });

    it("uploads an SVG image (201)", async () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle r="5"/></svg>');

      const res = await request(app)
        .post(`/api/resources/${resourceId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`)
        .attach("file", svgBuffer, { filename: "icon.svg", contentType: "image/svg+xml" });

      expect(res.status).toBe(201);
      expect(res.body.mime_type).toBe("image/svg+xml");

      createdAttachmentIds.push(res.body.id);
      createdAttachmentPaths.push(res.body.file_path);
    });

    it("rejects invalid created_in_version_id with 400 validation error", async () => {
      const pngBuffer = Buffer.from("fake-png");
      const fakeVersionId = "00000000-0000-0000-0000-000000000000";

      const res = await request(app)
        .post(`/api/resources/${resourceId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`)
        .field("created_in_version_id", fakeVersionId)
        .attach("file", pngBuffer, { filename: "diagram.png", contentType: "image/png" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.fieldErrors).toHaveProperty("created_in_version_id");
    });

    it("uploads a Markdown document (.md) (201)", async () => {
      const mdBuffer = Buffer.from("# Runbook\n\nInstructions here");

      const res = await request(app)
        .post(`/api/resources/${resourceId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`)
        .attach("file", mdBuffer, { filename: "runbook.md", contentType: "text/markdown" });

      expect(res.status).toBe(201);
      expect(res.body.mime_type).toBe("text/markdown");
      expect(res.body.file_name).toBe("runbook.md");

      createdAttachmentIds.push(res.body.id);
      createdAttachmentPaths.push(res.body.file_path);
    });

    it("uploads a PDF document (.pdf) (201)", async () => {
      const pdfBuffer = Buffer.from("%PDF-1.4 sample pdf content");

      const res = await request(app)
        .post(`/api/resources/${resourceId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`)
        .attach("file", pdfBuffer, { filename: "spec.pdf", contentType: "application/pdf" });

      expect(res.status).toBe(201);
      expect(res.body.mime_type).toBe("application/pdf");
      expect(res.body.file_name).toBe("spec.pdf");

      createdAttachmentIds.push(res.body.id);
      createdAttachmentPaths.push(res.body.file_path);
    });

    it("handles Thai characters and long filenames safely without exceeding Windows path limits (201)", async () => {
      const longThaiName = "เอกสารคู่มือการติดตั้งระบบงานและขั้นตอนการดูแลเซิร์ฟเวอร์แบบละเอียดมากที่สุดในโลกประจำปี2026.pdf";
      const sampleBuffer = Buffer.from("%PDF-1.4 thai test content");

      const res = await request(app)
        .post(`/api/resources/${resourceId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`)
        .attach("file", sampleBuffer, { filename: longThaiName, contentType: "application/pdf" });

      expect(res.status).toBe(201);
      expect(res.body.mime_type).toBe("application/pdf");
      expect(res.body.file_name).toBe(longThaiName);

      createdAttachmentIds.push(res.body.id);
      createdAttachmentPaths.push(res.body.file_path);

      const diskPath = getAttachmentDiskPath(res.body.file_path);
      expect(fs.existsSync(diskPath)).toBe(true);
      expect(diskPath.length).toBeLessThan(260);
    });

    it("rejects unsupported file types (e.g. .exe or application/x-msdownload) with 400", async () => {
      const exeBuffer = Buffer.from("MZ fake executable");

      const res = await request(app)
        .post(`/api/resources/${resourceId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`)
        .attach("file", exeBuffer, { filename: "program.exe", contentType: "application/x-msdownload" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.fieldErrors).toHaveProperty("file");
    });

    it("rejects requests missing a file with 400", async () => {
      const res = await request(app)
        .post(`/api/resources/${resourceId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`)
        .field("caption", "caption with no file");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.fieldErrors).toHaveProperty("file");
    });

    it("rejects files exceeding 10MB limit with 400", async () => {
      // 10MB + 1024 bytes
      const bigBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024);

      const res = await request(app)
        .post(`/api/resources/${resourceId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`)
        .attach("file", bigBuffer, { filename: "large.png", contentType: "image/png" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.fieldErrors).toHaveProperty("file");
    });

    it("returns 404 when uploading to a non-existent resource", async () => {
      const fakeResourceId = "11111111-1111-1111-1111-111111111111";
      const pngBuffer = Buffer.from("fake-png");

      const res = await request(app)
        .post(`/api/resources/${fakeResourceId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`)
        .attach("file", pngBuffer, { filename: "diagram.png", contentType: "image/png" });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/resources/:id/attachments (List)", () => {
    it("rejects unauthenticated list requests with 401", async () => {
      const res = await request(app).get(`/api/resources/${resourceId}/attachments`);
      expect(res.status).toBe(401);
    });

    it("returns active attachments ordered by created_at asc with expanded uploader", async () => {
      const res = await request(app)
        .get(`/api/resources/${resourceId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(4);

      const firstItem = res.body[0];
      expect(firstItem).toHaveProperty("id");
      expect(firstItem).toHaveProperty("resource_id", resourceId);
      expect(firstItem).toHaveProperty("uploader");
      expect(firstItem.uploader).toHaveProperty("id");
      expect(firstItem.uploader).toHaveProperty("name");
      expect(typeof firstItem.size_bytes).toBe("number");

      // Verify ordering by created_at ascending
      for (let i = 1; i < res.body.length; i++) {
        const prev = new Date(res.body[i - 1].created_at).getTime();
        const curr = new Date(res.body[i].created_at).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    it("returns 404 when listing attachments for non-existent resource", async () => {
      const fakeId = "22222222-2222-2222-2222-222222222222";
      const res = await request(app)
        .get(`/api/resources/${fakeId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/resources/:id/attachments/:attachmentId/content (Content Stream)", () => {
    it("rejects unauthenticated content stream with 401", async () => {
      const res = await request(app).get(
        `/api/resources/${resourceId}/attachments/${pngAttachmentId}/content`
      );
      expect(res.status).toBe(401);
    });

    it("streams inline content with stored mime_type and content headers", async () => {
      const res = await request(app)
        .get(`/api/resources/${resourceId}/attachments/${pngAttachmentId}/content`)
        .set("Authorization", `Bearer ${member1Token}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("image/png");
      expect(res.headers["content-disposition"]).toContain('inline; filename="network-diagram.png"');
      expect(res.body).toBeDefined();
    });

    it("returns 404 for non-existent attachmentId", async () => {
      const fakeAttachmentId = "33333333-3333-3333-3333-333333333333";
      const res = await request(app)
        .get(`/api/resources/${resourceId}/attachments/${fakeAttachmentId}/content`)
        .set("Authorization", `Bearer ${member1Token}`);

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/resources/:id/attachments/:attachmentId (Soft Delete)", () => {
    it("rejects unauthenticated delete request with 401", async () => {
      const res = await request(app).delete(
        `/api/resources/${resourceId}/attachments/${memberUploadedAttachmentId}`
      );
      expect(res.status).toBe(401);
    });

    it("forbids non-admin third party user from deleting someone else's attachment (403)", async () => {
      const res = await request(app)
        .delete(`/api/resources/${resourceId}/attachments/${memberUploadedAttachmentId}`)
        .set("Authorization", `Bearer ${member2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("allows the original uploader (member1) to soft-delete their attachment (200)", async () => {
      const res = await request(app)
        .delete(`/api/resources/${resourceId}/attachments/${memberUploadedAttachmentId}`)
        .set("Authorization", `Bearer ${member1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Attachment deleted successfully");

      // Verify soft delete in DB: deleted_at IS NOT NULL
      const dbRow = await pool.query<{ deleted_at: string; file_path: string }>(
        `SELECT deleted_at, file_path FROM resource_attachments WHERE id = $1`,
        [memberUploadedAttachmentId]
      );
      expect(dbRow.rows[0].deleted_at).not.toBeNull();

      // Verify file is NOT unlinked on disk per specification
      const diskPath = getAttachmentDiskPath(dbRow.rows[0].file_path);
      expect(fs.existsSync(diskPath)).toBe(true);

      // Verify soft-deleted attachment is excluded from list endpoint
      const listRes = await request(app)
        .get(`/api/resources/${resourceId}/attachments`)
        .set("Authorization", `Bearer ${member1Token}`);
      const ids = listRes.body.map((a: { id: string }) => a.id);
      expect(ids).not.toContain(memberUploadedAttachmentId);
    });

    it("allows admin to soft-delete any attachment (200)", async () => {
      const res = await request(app)
        .delete(`/api/resources/${resourceId}/attachments/${jpegAttachmentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Attachment deleted successfully");

      const dbRow = await pool.query<{ deleted_at: string; file_path: string }>(
        `SELECT deleted_at, file_path FROM resource_attachments WHERE id = $1`,
        [jpegAttachmentId]
      );
      expect(dbRow.rows[0].deleted_at).not.toBeNull();

      // Verify file is still intact on disk
      const diskPath = getAttachmentDiskPath(dbRow.rows[0].file_path);
      expect(fs.existsSync(diskPath)).toBe(true);
    });

    it("returns 404 when attempting to delete an already soft-deleted attachment", async () => {
      const res = await request(app)
        .delete(`/api/resources/${resourceId}/attachments/${memberUploadedAttachmentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe("Audit & Activity Logs", () => {
    it("creates activity_logs records for attachment create and delete actions", async () => {
      const logsRes = await pool.query<{
        entity_type: string;
        entity_id: string;
        action: string;
        changed_by: string;
      }>(
        `SELECT entity_type, entity_id, action, changed_by
         FROM activity_logs
         WHERE entity_type = 'resource_attachment' AND entity_id = $1
         ORDER BY created_at ASC`,
        [memberUploadedAttachmentId]
      );

      expect(logsRes.rows.length).toBe(2);
      expect(logsRes.rows[0].action).toBe("create");
      expect(logsRes.rows[0].changed_by).toBe(member1PersonId);
      expect(logsRes.rows[1].action).toBe("delete");
      expect(logsRes.rows[1].changed_by).toBe(member1PersonId);
    });
  });
});
