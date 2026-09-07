import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import ThemeToggle from "@/components/layout/ThemeToggle";

const patchMock = vi.fn();
const toastMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("@/lib/api", () => ({
  default: { patch: (...args: unknown[]) => patchMock(...args) },
}));
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));
vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

function Consumer() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme("dark")}>go dark</button>
      <button onClick={() => setTheme("light")}>go light</button>
    </div>
  );
}

function html() {
  return document.documentElement;
}

function renderProvider(ui = <Consumer />) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  patchMock.mockReset().mockResolvedValue({ data: {} });
  toastMock.mockReset();
  useAuthMock.mockReset().mockReturnValue({ user: null });
  html().classList.remove("dark");
  localStorage.clear();
});

describe("ThemeProvider", () => {
  it("adopts the account preference once GET /auth/me resolves", async () => {
    useAuthMock.mockReturnValue({ user: { theme_preference: "dark" } });
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("dark"));
    expect(html().classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("qqm_theme")).toBe("dark");
    expect(patchMock).not.toHaveBeenCalled(); // adopting is not a user edit
  });

  it("persists a toggle via PATCH /auth/me and flips the class immediately", async () => {
    useAuthMock.mockReturnValue({ user: { theme_preference: "light" } });
    renderProvider();

    screen.getByText("go dark").click();

    expect(html().classList.contains("dark")).toBe(true); // optimistic DOM flip
    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith("/auth/me", { theme_preference: "dark" })
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(localStorage.getItem("qqm_theme")).toBe("dark");
  });

  it("reverts the visual state and toasts when the PATCH fails", async () => {
    patchMock.mockRejectedValue(new Error("network"));
    useAuthMock.mockReturnValue({ user: { theme_preference: "light" } });
    renderProvider();

    screen.getByText("go dark").click();
    expect(html().classList.contains("dark")).toBe(true); // optimistic flip

    await waitFor(() => expect(html().classList.contains("dark")).toBe(false)); // reverted
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(localStorage.getItem("qqm_theme")).toBe("light");
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" })
    );
  });

  it("does not PATCH when the chosen theme is already active", async () => {
    useAuthMock.mockReturnValue({ user: { theme_preference: "dark" } });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("dark"));

    screen.getByText("go dark").click();
    expect(patchMock).not.toHaveBeenCalled();
  });

  it("keeps the topbar toggle and settings control in sync (shared context)", async () => {
    useAuthMock.mockReturnValue({ user: { theme_preference: "light" } });
    renderProvider(
      <>
        <Consumer />
        <ThemeToggle />
      </>
    );

    // Toggle icon starts on "switch to dark".
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();

    // Flip via the settings-style control.
    screen.getByText("go dark").click();

    // The topbar toggle reflects it without its own state.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Switch to light theme" })
      ).toBeInTheDocument()
    );
  });

  it("does not fight the FOUC script: pre-applied dark + matching account value stays dark, no PATCH", async () => {
    // Simulate the index.html pre-paint script having already run.
    html().classList.add("dark");
    localStorage.setItem("qqm_theme", "dark");
    useAuthMock.mockReturnValue({ user: { theme_preference: "dark" } });

    renderProvider();

    // Never leaves dark, never re-persists.
    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("dark"));
    expect(html().classList.contains("dark")).toBe(true);
    expect(patchMock).not.toHaveBeenCalled();
  });
});
