import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../app";
import { pool } from "../db/pool";
import { auth } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { errorHandler } from "../middleware/errorHandler";

const ADMIN_USERNAME = "admin";
const ADMIN_ORIGINAL_PASSWORD = "admin123";

const RUN_ID = Date.now();
const MEMBER_USERNAME = `test_member_${RUN_ID}`;
const MEMBER_PASSWORD = "memberPass123";

// A dedicated, throwaway admin-role user for the password-rotation tests,
// rather than mutating the shared seeded `admin` account: other test files
// run in parallel (separate Jest workers/files) and log in as the seeded
// admin in their own beforeAll blocks, so rotating its password here — even
// with a same-suite restore in afterAll — created a real, observed race
// where a concurrent file's beforeAll login would 401 mid-rotation.
const CHANGE_PW_USERNAME = `test_admin_changepw_${RUN_ID}`;
const CHANGE_PW_ORIGINAL_PASSWORD = "changePwOriginal123";
const CHANGE_PW_NEW_PASSWORD = "brandNewPassword456";

// Temporary admin-only route, mounted directly on the app for this test file only.
app.get(
  "/__test__/admin-only",
  auth,
  requireRole("admin"),
  (_req, res) => res.json({ ok: true })
);
// Re-attach the error handler so errors raised by the route above (e.g. a 403
// from requireRole) are still formatted through the app's standard error shape.
app.use(errorHandler);

let adminUserId: string;
let memberUserId: string;
let changePwUserId: string;
let changePwPersonId: string;
let originalAdminPersonId: string | null = null;
let adminToken: string;
let memberToken: string;
let changePwToken: string;

beforeAll(async () => {
  const adminRow = await pool.query<{ id: string; people_id: string | null }>(
    `SELECT id, people_id FROM users WHERE username = $1`,
    [ADMIN_USERNAME]
  );
  if (adminRow.rows.length === 0) {
    throw new Error("Seeded admin user not found. Run `npm run seed` first.");
  }
  adminUserId = adminRow.rows[0].id;
  originalAdminPersonId = adminRow.rows[0].people_id;
  await pool.query(`UPDATE users SET theme_preference = NULL WHERE id = $1`, [adminUserId]);

  const roleRow = await pool.query<{ id: string }>(
    `SELECT id FROM roles WHERE name = 'member' AND deleted_at IS NULL`
  );
  if (roleRow.rows.length === 0) {
    throw new Error("Seeded 'member' role not found. Run `npm run seed` first.");
  }
  const memberRoleId = roleRow.rows[0].id;

  const adminRoleRow = await pool.query<{ id: string }>(
    `SELECT id FROM roles WHERE name = 'admin' AND deleted_at IS NULL`
  );
  const adminRoleId = adminRoleRow.rows[0].id;

  const memberHash = await bcrypt.hash(MEMBER_PASSWORD, 10);
  const memberRow = await pool.query<{ id: string }>(
    `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
    [MEMBER_USERNAME, `${MEMBER_USERNAME}@example.com`, memberHash]
  );
  memberUserId = memberRow.rows[0].id;
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
    [memberUserId, memberRoleId]
  );

  const memberLogin = await request(app)
    .post("/api/auth/login")
    .send({ username: MEMBER_USERNAME, password: MEMBER_PASSWORD });
  memberToken = memberLogin.body.token;

  // Dedicated admin-role user for the change-password tests (needs a linked
  // people row since a successful change writes to activity_logs.changed_by).
  const personRow = await pool.query<{ id: string }>(
    `INSERT INTO people (name, type) VALUES ($1, 'internal_engineer') RETURNING id`,
    [`Test ChangePw Admin ${RUN_ID}`]
  );
  changePwPersonId = personRow.rows[0].id;

  const changePwHash = await bcrypt.hash(CHANGE_PW_ORIGINAL_PASSWORD, 10);
  const changePwRow = await pool.query<{ id: string }>(
    `INSERT INTO users (people_id, username, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`,
    [changePwPersonId, CHANGE_PW_USERNAME, `${CHANGE_PW_USERNAME}@example.com`, changePwHash]
  );
  changePwUserId = changePwRow.rows[0].id;
  await pool.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [
    changePwUserId,
    adminRoleId,
  ]);

  const changePwLogin = await request(app)
    .post("/api/auth/login")
    .send({ username: CHANGE_PW_USERNAME, password: CHANGE_PW_ORIGINAL_PASSWORD });
  changePwToken = changePwLogin.body.token;
});

afterAll(async () => {
  if (originalAdminPersonId) {
    await pool.query(`UPDATE users SET people_id = $1 WHERE id = $2`, [originalAdminPersonId, adminUserId]);
  }
  await pool.query(`DELETE FROM user_roles WHERE user_id = $1`, [memberUserId]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [memberUserId]);
  await pool.query(`DELETE FROM user_roles WHERE user_id = $1`, [changePwUserId]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [changePwUserId]);
  await pool.end();
});

describe("POST /api/auth/login", () => {
  it("returns 200 and a JWT for correct seeded admin credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: ADMIN_USERNAME, password: ADMIN_ORIGINAL_PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.split(".")).toHaveLength(3);

    adminToken = res.body.token;
  });

  it("returns 401 with error.code UNAUTHORIZED for a wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: ADMIN_USERNAME, password: "definitely-wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 with the SAME generic message for a non-existent username (no user enumeration)", async () => {
    const wrongPasswordRes = await request(app)
      .post("/api/auth/login")
      .send({ username: ADMIN_USERNAME, password: "definitely-wrong" });

    const noSuchUserRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "no_such_user_xyz", password: "whatever123" });

    expect(noSuchUserRes.status).toBe(401);
    expect(noSuchUserRes.body.error.code).toBe("UNAUTHORIZED");
    expect(noSuchUserRes.body.error.message).toBe(wrongPasswordRes.body.error.message);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the correct user profile and roles array with a valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(adminUserId);
    expect(res.body.username).toBe(ADMIN_USERNAME);
    expect(Array.isArray(res.body.roles)).toBe(true);
    expect(res.body.roles).toContain("admin");
  });
});

describe("admin-only route (requireRole('admin'))", () => {
  it("returns 403 for a member-role token", async () => {
    const res = await request(app)
      .get("/__test__/admin-only")
      .set("Authorization", `Bearer ${memberToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 200 for an admin-role token", async () => {
    const res = await request(app)
      .get("/__test__/admin-only")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/auth/me (theme preference)", () => {
  it("GET /me returns theme_preference 'light' when the column is NULL", async () => {
    // memberUser was just inserted in beforeAll and has never set a theme.
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${memberToken}`);

    expect(res.status).toBe(200);
    expect(res.body.theme_preference).toBe("light");
  });

  it("returns 400 VALIDATION_ERROR for a value outside light|dark", async () => {
    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ theme_preference: "system" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 without a token", async () => {
    const res = await request(app)
      .patch("/api/auth/me")
      .send({ theme_preference: "dark" });

    expect(res.status).toBe(401);
  });

  it("persists a valid update and reflects it on the next GET /me", async () => {
    const patchRes = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ theme_preference: "dark" });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.theme_preference).toBe("dark");

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${memberToken}`);
    expect(meRes.body.theme_preference).toBe("dark");
  });

  it("updates only the caller's row — a user id in the body is ignored", async () => {
    // adminUser has never set a theme; try to flip it via a spoofed body id.
    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ id: adminUserId, theme_preference: "dark" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(memberUserId);

    const adminRow = await pool.query<{ theme_preference: string | null }>(
      `SELECT theme_preference FROM users WHERE id = $1`,
      [adminUserId]
    );
    expect(adminRow.rows[0].theme_preference).toBeNull();

    const memberRow = await pool.query<{ theme_preference: string | null }>(
      `SELECT theme_preference FROM users WHERE id = $1`,
      [memberUserId]
    );
    expect(memberRow.rows[0].theme_preference).toBe("dark");
  });
});

describe("POST /api/auth/change-password", () => {
  it("returns 401 when current_password is wrong", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${changePwToken}`)
      .send({ current_password: "totally-wrong", new_password: "irrelevant123" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 VALIDATION_ERROR when new_password is under 8 chars", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${changePwToken}`)
      .send({ current_password: CHANGE_PW_ORIGINAL_PASSWORD, new_password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("succeeds with valid input, rotates the password, and logs the change", async () => {
    const changeRes = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${changePwToken}`)
      .send({
        current_password: CHANGE_PW_ORIGINAL_PASSWORD,
        new_password: CHANGE_PW_NEW_PASSWORD,
      });
    expect(changeRes.status).toBe(200);

    const newLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: CHANGE_PW_USERNAME, password: CHANGE_PW_NEW_PASSWORD });
    expect(newLoginRes.status).toBe(200);
    expect(typeof newLoginRes.body.token).toBe("string");

    const oldLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: CHANGE_PW_USERNAME, password: CHANGE_PW_ORIGINAL_PASSWORD });
    expect(oldLoginRes.status).toBe(401);

    const logRows = await pool.query(
      `SELECT * FROM activity_logs
       WHERE entity_type = 'user' AND entity_id = $1 AND action = 'update'
       ORDER BY created_at DESC LIMIT 1`,
      [changePwUserId]
    );
    expect(logRows.rows.length).toBe(1);
    expect(logRows.rows[0].new_value).toEqual({ action: "password_changed" });
  });
});

describe("PUT /api/auth/me/person", () => {
  let testPerson1Id: string;
  let testPerson2Id: string;
  let tempUserId: string;

  beforeAll(async () => {
    const p1 = await pool.query<{ id: string }>(
      `INSERT INTO people (name, email, type) VALUES ($1, $2, 'internal_engineer') RETURNING id`,
      [`Test Person One ${RUN_ID}`, `person1_${RUN_ID}@example.com`]
    );
    testPerson1Id = p1.rows[0].id;

    const p2 = await pool.query<{ id: string }>(
      `INSERT INTO people (name, email, type) VALUES ($1, $2, 'internal_engineer') RETURNING id`,
      [`Test Person Two ${RUN_ID}`, `person2_${RUN_ID}@example.com`]
    );
    testPerson2Id = p2.rows[0].id;

    const hash = await bcrypt.hash("tempPass123!", 10);
    const u = await pool.query<{ id: string }>(
      `INSERT INTO users (people_id, username, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id`,
      [testPerson2Id, `tempuser_${RUN_ID}`, `tempuser_${RUN_ID}@example.com`, hash]
    );
    tempUserId = u.rows[0].id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE id = $1`, [tempUserId]);
    await pool.query(`DELETE FROM people WHERE id IN ($1, $2)`, [testPerson1Id, testPerson2Id]);
  });

  it("returns 401 without a token", async () => {
    const res = await request(app)
      .put("/api/auth/me/person")
      .send({ people_id: testPerson1Id });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin user", async () => {
    const res = await request(app)
      .put("/api/auth/me/person")
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ people_id: testPerson1Id });
    expect(res.status).toBe(403);
  });

  it("returns 400 VALIDATION_ERROR for an invalid UUID", async () => {
    const res = await request(app)
      .put("/api/auth/me/person")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ people_id: "not-a-uuid" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for a non-existent person", async () => {
    const res = await request(app)
      .put("/api/auth/me/person")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ people_id: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(404);
  });

  it("updates linked person for admin, synchronizes user email, and returns new token", async () => {
    const res = await request(app)
      .put("/api/auth/me/person")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ people_id: testPerson1Id });

    expect(res.status).toBe(200);
    expect(res.body.user.peopleId).toBe(testPerson1Id);
    expect(res.body.user.email).toBe(`person1_${RUN_ID}@example.com`);
    expect(res.body.user.person.id).toBe(testPerson1Id);
    expect(res.body.user.person.name).toBe(`Test Person One ${RUN_ID}`);
    expect(res.body.user.person.email).toBe(`person1_${RUN_ID}@example.com`);
    expect(typeof res.body.token).toBe("string");

    // Verify DB reflects updated email
    const dbUser = await pool.query<{ email: string; people_id: string }>(
      `SELECT email, people_id FROM users WHERE id = $1`,
      [adminUserId]
    );
    expect(dbUser.rows[0].email).toBe(`person1_${RUN_ID}@example.com`);
    expect(dbUser.rows[0].people_id).toBe(testPerson1Id);

    // Subsequent GET /auth/me with the new token reflects the new person and email
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${res.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.peopleId).toBe(testPerson1Id);
    expect(meRes.body.email).toBe(`person1_${RUN_ID}@example.com`);
    expect(meRes.body.person.name).toBe(`Test Person One ${RUN_ID}`);
  });

  it("preserves existing user email when linked person has no email", async () => {
    const pNoEmail = await pool.query<{ id: string }>(
      `INSERT INTO people (name, email, type) VALUES ($1, NULL, 'internal_engineer') RETURNING id`,
      [`Test Person No Email ${RUN_ID}`]
    );
    const personNoEmailId = pNoEmail.rows[0].id;

    try {
      const res = await request(app)
        .put("/api/auth/me/person")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ people_id: personNoEmailId });

      expect(res.status).toBe(200);
      expect(res.body.user.peopleId).toBe(personNoEmailId);
      // Keeps the previous email because target person has no email
      expect(res.body.user.email).toBe(`person1_${RUN_ID}@example.com`);
      expect(res.body.user.person.email).toBeNull();
    } finally {
      await pool.query(`DELETE FROM people WHERE id = $1`, [personNoEmailId]);
    }
  });

  it("returns 409 CONFLICT if target person's email is already used by another user", async () => {
    // tempUserId already has email tempuser_${RUN_ID}@example.com
    const pConflict = await pool.query<{ id: string }>(
      `INSERT INTO people (name, email, type) VALUES ($1, $2, 'internal_engineer') RETURNING id`,
      [`Conflict Person ${RUN_ID}`, `tempuser_${RUN_ID}@example.com`]
    );
    const conflictPersonId = pConflict.rows[0].id;

    try {
      const res = await request(app)
        .put("/api/auth/me/person")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ people_id: conflictPersonId });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(res.body.error.message).toMatch(/already in use/i);
    } finally {
      await pool.query(`DELETE FROM people WHERE id = $1`, [conflictPersonId]);
    }
  });

  it("unlinks existing user if target person was already linked to someone else", async () => {
    // testPerson2Id is currently linked to tempUserId
    const res = await request(app)
      .put("/api/auth/me/person")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ people_id: testPerson2Id });

    expect(res.status).toBe(200);
    expect(res.body.user.peopleId).toBe(testPerson2Id);

    // Verify tempUserId was unlinked (people_id set to null)
    const tempUserCheck = await pool.query<{ people_id: string | null }>(
      `SELECT people_id FROM users WHERE id = $1`,
      [tempUserId]
    );
    expect(tempUserCheck.rows[0].people_id).toBeNull();
  });
});

