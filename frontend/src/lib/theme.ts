// Low-level theme primitives — DOM + localStorage only, dependency-free.
//
// Source of truth (Task 3): the user's account preference, delivered by
// GET /api/auth/me and mutated via PATCH /api/auth/me. See
// features/theme/ThemeProvider.tsx for the wiring.
//
// localStorage (`qqm_theme`) is now only a *cache* of the account value, read
// by two things that run before React/auth state exists:
//   1. the pre-paint inline script in index.html (avoids a light flash)
//   2. the initial ThemeProvider state (so the topbar icon is correct on
//      first paint, before GET /api/auth/me resolves)
// The ThemeProvider re-syncs this cache once the account value is known.
//
// Manual toggle only: prefers-color-scheme is never consulted.

export type Theme = "light" | "dark";

const STORAGE_KEY = "qqm_theme";

/** Toggle the `dark` class on <html> to match `theme`. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** The theme currently on the DOM (already applied by the FOUC script). */
export function getAppliedTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Cached account preference, or "light" when unset/invalid/unavailable. */
export function getCachedTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Update the FOUC cache to mirror the account preference. */
export function cacheTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable (private mode, disabled) — cache is best-effort */
  }
}
