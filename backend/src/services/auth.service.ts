import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool";
import { withTransaction } from "../db/withTransaction";
import { ApiError } from "../middleware/errorHandler";
import { logActivity } from "../middleware/activityLogger";
import { User } from "../types";
import { RegisterInput } from "../validators/auth.validator";

export interface UserWithPerson extends User {
  person_name?: string | null;
  person_email?: string | null;
}

export async function findUserByUsername(
  username: string
): Promise<UserWithPerson | null> {
  const result = await pool.query<UserWithPerson>(
    `SELECT u.*, p.name AS person_name, p.email AS person_email
     FROM users u
     LEFT JOIN people p ON p.id = u.people_id
     WHERE u.username = $1 AND u.deleted_at IS NULL`,
    [username]
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserWithPerson | null> {
  const result = await pool.query<UserWithPerson>(
    `SELECT u.*, p.name AS person_name, p.email AS person_email
     FROM users u
     LEFT JOIN people p ON p.id = u.people_id
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function updateUserPassword(
  userId: string,
  passwordHash: string
): Promise<void> {
  await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`,
    [passwordHash, userId]
  );
}

export async function updateUserThemePreference(
  userId: string,
  themePreference: "light" | "dark"
): Promise<void> {
  await pool.query(
    `UPDATE users SET theme_preference = $1, updated_at = now() WHERE id = $2`,
    [themePreference, userId]
  );
}

export async function updateUserLinkedPerson(
  userId: string,
  newPeopleId: string,
  actingPeopleId?: string | null
): Promise<UserWithPerson> {
  return withTransaction(async (tx) => {
    // 1. Verify target person exists and is active
    const personCheck = await tx.query<{ id: string; name: string; email: string | null }>(
      `SELECT id, name, email FROM people WHERE id = $1 AND deleted_at IS NULL`,
      [newPeopleId]
    );
    if (personCheck.rows.length === 0) {
      throw new ApiError(404, "Person not found", "NOT_FOUND");
    }
    const targetPerson = personCheck.rows[0];

    // 2. Fetch existing user
    const existingUserResult = await tx.query<User>(
      `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    const existingUser = existingUserResult.rows[0];
    if (!existingUser) {
      throw new ApiError(404, "User not found", "NOT_FOUND");
    }

    const effectiveActingPeopleId = actingPeopleId ?? existingUser.people_id ?? newPeopleId;

    // Determine candidate email from target person
    let targetEmail = existingUser.email;
    if (targetPerson.email && targetPerson.email.trim() !== "") {
      const candidateEmail = targetPerson.email.trim();
      const emailConflictResult = await tx.query<User>(
        `SELECT id FROM users WHERE email = $1 AND id != $2 AND deleted_at IS NULL`,
        [candidateEmail, userId]
      );
      if (emailConflictResult.rows.length > 0) {
        throw new ApiError(409, "Email is already in use by another user", "CONFLICT");
      }
      targetEmail = candidateEmail;
    }

    // 3. Unlink any other user currently linked to newPeopleId to satisfy unique index
    const conflictUserResult = await tx.query<User>(
      `SELECT * FROM users WHERE people_id = $1 AND id != $2 AND deleted_at IS NULL`,
      [newPeopleId, userId]
    );
    if (conflictUserResult.rows.length > 0) {
      const conflictUser = conflictUserResult.rows[0];
      const unlinkedUserResult = await tx.query<User>(
        `UPDATE users SET people_id = NULL, updated_at = now() WHERE id = $1 RETURNING *`,
        [conflictUser.id]
      );
      await logActivity(
        "user",
        conflictUser.id,
        "update",
        effectiveActingPeopleId,
        conflictUser,
        unlinkedUserResult.rows[0],
        tx
      );
    }

    // 4. Update the current user's people_id and email
    const updatedUserResult = await tx.query<User>(
      `UPDATE users SET people_id = $1, email = $2, updated_at = now() WHERE id = $3 RETURNING *`,
      [newPeopleId, targetEmail, userId]
    );
    const updatedUser = updatedUserResult.rows[0];

    await logActivity(
      "user",
      userId,
      "update",
      effectiveActingPeopleId,
      existingUser,
      updatedUser,
      tx
    );

    return {
      ...updatedUser,
      person_name: targetPerson.name,
      person_email: targetPerson.email,
    };
  });
}

export async function findRoleNamesForUser(userId: string): Promise<string[]> {
  const result = await pool.query<{ name: string }>(
    `SELECT r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.deleted_at IS NULL`,
    [userId]
  );
  return result.rows.map((r) => r.name);
}

export const MAX_REGISTRATIONS = 5;

export async function getRegistrationStatus(): Promise<{
  isOpen: boolean;
  remainingSlots: number;
  maxAllowed: number;
  currentCount: number;
}> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM users WHERE is_registered = true AND deleted_at IS NULL`
  );
  const currentCount = parseInt(result.rows[0].count, 10);
  const remainingSlots = Math.max(0, MAX_REGISTRATIONS - currentCount);
  return {
    isOpen: remainingSlots > 0,
    remainingSlots,
    maxAllowed: MAX_REGISTRATIONS,
    currentCount,
  };
}

export async function registerUser(input: RegisterInput): Promise<{
  user: UserWithPerson;
  token: string;
  roles: string[];
}> {
  return withTransaction(async (tx) => {
    // 1. Check registration quota
    const countResult = await tx.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM users WHERE is_registered = true AND deleted_at IS NULL`
    );
    const registeredCount = parseInt(countResult.rows[0].count, 10);
    if (registeredCount >= MAX_REGISTRATIONS) {
      throw new ApiError(
        403,
        "Registration is closed. Maximum user quota reached.",
        "REGISTRATION_CLOSED"
      );
    }

    // 2. Check if username already exists
    const usernameConflict = await tx.query<User>(
      `SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL`,
      [input.username]
    );
    if (usernameConflict.rows.length > 0) {
      throw new ApiError(409, "Username is already taken", "CONFLICT");
    }

    // 3. Find admin role ID
    const roleResult = await tx.query<{ id: string }>(
      `SELECT id FROM roles WHERE name = 'admin' AND deleted_at IS NULL`
    );
    if (roleResult.rows.length === 0) {
      throw new ApiError(500, "Admin role not found", "INTERNAL_ERROR");
    }
    const adminRoleId = roleResult.rows[0].id;

    // 4. Default email (must be unique)
    let candidateEmail = `${input.username.toLowerCase()}@vault.local`;
    const emailConflict = await tx.query<User>(
      `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [candidateEmail]
    );
    if (emailConflict.rows.length > 0) {
      candidateEmail = `${input.username.toLowerCase()}_${Date.now()}@vault.local`;
    }

    // 5. Hash password
    const passwordHash = await bcrypt.hash(input.password, 10);

    // 6. Insert new user
    const insertResult = await tx.query<User>(
      `INSERT INTO users (username, email, password_hash, is_registered)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [input.username, candidateEmail, passwordHash]
    );
    const newUser = insertResult.rows[0];

    // 7. Assign admin role
    await tx.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
      [newUser.id, adminRoleId]
    );


    // 9. Generate JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new ApiError(500, "JWT secret is not configured");
    }
    const roles = ["admin"];
    const token = jwt.sign(
      { id: newUser.id, peopleId: null, roles },
      secret,
      { expiresIn: "8h" }
    );

    return {
      user: {
        ...newUser,
        person_name: null,
        person_email: null,
      },
      token,
      roles,
    };
  });
}
