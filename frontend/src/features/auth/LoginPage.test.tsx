import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";
import * as useAuthModule from "./useAuth";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("LoginPage", () => {
  const mockLogin = vi.fn();
  const mockRegister = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      login: mockLogin,
      register: mockRegister,
      logout: vi.fn(),
      updateLinkedPerson: vi.fn(),
      user: null,
      roles: [],
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it("renders sign in header and inputs by default", async () => {
    vi.spyOn(useAuthModule, "fetchRegistrationStatus").mockResolvedValue({
      isOpen: false,
      remainingSlots: 0,
      maxAllowed: 5,
      currentCount: 5,
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByText(/Register new admin/i)).not.toBeInTheDocument();
  });

  it("shows registration toggle when registration is open", async () => {
    vi.spyOn(useAuthModule, "fetchRegistrationStatus").mockResolvedValue({
      isOpen: true,
      remainingSlots: 4,
      maxAllowed: 5,
      currentCount: 1,
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const regLink = await screen.findByText(/Register new admin \(4 slots left\)/i);
    expect(regLink).toBeInTheDocument();
  });

  it("navigates to /overview on successful login", async () => {
    vi.spyOn(useAuthModule, "fetchRegistrationStatus").mockResolvedValue({
      isOpen: false,
      remainingSlots: 0,
      maxAllowed: 5,
      currentCount: 5,
    });
    mockLogin.mockResolvedValueOnce({ id: "user-1", username: "testuser" });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("testuser", "secret123");
      expect(mockNavigate).toHaveBeenCalledWith("/overview", { replace: true });
    });
  });

  it("switches to registration mode and shows register form", async () => {
    vi.spyOn(useAuthModule, "fetchRegistrationStatus").mockResolvedValue({
      isOpen: true,
      remainingSlots: 3,
      maxAllowed: 5,
      currentCount: 2,
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const regLink = await screen.findByText(/Register new admin/i);
    fireEvent.click(regLink);

    expect(screen.getByRole("heading", { name: "Create admin account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register & Link profile" })).toBeInTheDocument();
  });

  it("shows error when passwords do not match during registration", async () => {
    vi.spyOn(useAuthModule, "fetchRegistrationStatus").mockResolvedValue({
      isOpen: true,
      remainingSlots: 3,
      maxAllowed: 5,
      currentCount: 2,
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const regLink = await screen.findByText(/Register new admin/i);
    fireEvent.click(regLink);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "newadmin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "mismatch456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Register & Link profile" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("navigates to /settings/manage-users on successful registration", async () => {
    vi.spyOn(useAuthModule, "fetchRegistrationStatus").mockResolvedValue({
      isOpen: true,
      remainingSlots: 3,
      maxAllowed: 5,
      currentCount: 2,
    });
    mockRegister.mockResolvedValueOnce({ id: "user-2", username: "newadmin" });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const regLink = await screen.findByText(/Register new admin/i);
    fireEvent.click(regLink);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "newadmin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Register & Link profile" }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith("newadmin", "password123");
      expect(mockNavigate).toHaveBeenCalledWith("/settings/manage-users", { replace: true });
    });
  });
});

