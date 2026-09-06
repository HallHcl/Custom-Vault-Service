import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ThemeToggle from "./ThemeToggle";

const useThemeMock = vi.fn();

vi.mock("@/features/theme/ThemeProvider", () => ({
  useTheme: () => useThemeMock(),
}));

beforeEach(() => useThemeMock.mockReset());

describe("ThemeToggle", () => {
  it("shows the 'switch to dark' affordance while in light mode", () => {
    useThemeMock.mockReturnValue({ theme: "light", toggleTheme: vi.fn(), isSaving: false });
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
  });

  it("shows the 'switch to light' affordance while in dark mode", () => {
    useThemeMock.mockReturnValue({ theme: "dark", toggleTheme: vi.fn(), isSaving: false });
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("calls toggleTheme on click", () => {
    const toggleTheme = vi.fn();
    useThemeMock.mockReturnValue({ theme: "light", toggleTheme, isSaving: false });
    render(<ThemeToggle />);
    screen.getByRole("button").click();
    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it("is disabled while a save is in flight", () => {
    useThemeMock.mockReturnValue({ theme: "light", toggleTheme: vi.fn(), isSaving: true });
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
