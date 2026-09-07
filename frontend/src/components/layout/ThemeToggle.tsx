import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/features/theme/ThemeProvider";

/**
 * Topbar quick-switch: one click flips light <-> dark and persists via
 * PATCH /api/auth/me (handled inside useTheme). Shows the icon of the theme
 * you'd switch TO. State comes from the FOUC-applied class on first paint, so
 * the icon is correct before GET /api/auth/me resolves.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme, isSaving } = useTheme();
  const nextLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      disabled={isSaving}
      aria-label={nextLabel}
      title={nextLabel}
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
