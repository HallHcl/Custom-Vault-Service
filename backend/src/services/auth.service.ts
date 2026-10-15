import { pool } from "../db/pool";
import { withTransaction } from "../db/withTransaction";
import { ApiError } from "../middleware/errorHandler";
import { logActivity } from "../middleware/activityLogger";
import { User } from "../types";

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

    // 4. Update the current user's people_id
    const updatedUserResult = await tx.query<User>(
      `UPDATE users SET people_id = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [newPeopleId, userId]
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

