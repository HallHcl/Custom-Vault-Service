import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must not exceed 50 characters")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username may only contain letters, numbers, dots, hyphens, and underscores"
    ),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Dark Mode: the two allowed persisted theme values. NULL in the DB (no row
// value yet) is resolved to "light" at the application layer, so it is not an
// accepted input here — a client always sends an explicit choice.
export const updateThemePreferenceSchema = z.object({
  theme_preference: z.enum(["light", "dark"]),
});

export type UpdateThemePreferenceInput = z.infer<
  typeof updateThemePreferenceSchema
>;

export const updateLinkedPersonSchema = z.object({
  people_id: z.string().uuid(),
});

export type UpdateLinkedPersonInput = z.infer<
  typeof updateLinkedPersonSchema
>;
