import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import api from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/useAuth";
import {
  applyTheme,
  cacheTheme,
  getAppliedTheme,
  type Theme,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: Theme;
  /** Set an explicit theme. Optimistic: flips immediately, reverts on failure. */
  setTheme: (theme: Theme) => void;
  /** Flip light <-> dark. */
  toggleTheme: () => void;
  /** A PATCH /api/auth/me is in flight. */
  isSaving: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Initial value = whatever the FOUC script already put on <html>, so the
  // toggle icon never flashes the wrong state before GET /api/auth/me lands.
  const [theme, setThemeState] = useState<Theme>(() => getAppliedTheme());
  const [isSaving, setIsSaving] = useState(false);
  // Mirror of `theme` for stable callbacks (setTheme has no `theme` dep).
  const themeRef = useRef(theme);

  const commit = useCallback((next: Theme) => {
    themeRef.current = next;
    applyTheme(next);
    cacheTheme(next);
    setThemeState(next);
  }, []);

  const accountTheme = user?.theme_preference;

  // When the account preference resolves (or changes), adopt it as the truth
  // and re-sync the FOUC cache. This is the one place localStorage is allowed
  // to be corrected by the server value. If the FOUC-applied theme already
  // matches (the common case), commit() is a cheap no-op — no flicker.
  useEffect(() => {
    if (accountTheme && accountTheme !== themeRef.current) {
      commit(accountTheme);
    } else if (accountTheme) {
      cacheTheme(accountTheme);
    }
  }, [accountTheme, commit]);

  const setTheme = useCallback(
    (next: Theme) => {
      const previous = themeRef.current;
      if (next === previous) return;
      commit(next);

      setIsSaving(true);
      api
        .patch("/auth/me", { theme_preference: next })
        .catch(() => {
          commit(previous); // revert the optimistic flip
          toast({
            title: "Couldn't save theme",
            description:
              "Your theme preference wasn't saved. Please try again.",
            variant: "destructive",
          });
        })
        .finally(() => setIsSaving(false));
    },
    [commit]
  );

  const toggleTheme = useCallback(() => {
    setTheme(themeRef.current === "dark" ? "light" : "dark");
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isSaving }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
