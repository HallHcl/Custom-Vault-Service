import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ManageUsersPage from "./ManageUsersPage";

const useAuthMock = vi.fn();
const updateLinkedPersonMock = vi.fn();
const toastMock = vi.fn();
const usePeopleMock = vi.fn();

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

vi.mock("@/hooks/usePeople", () => ({
  usePeople: (...args: unknown[]) => usePeopleMock(...args),
}));

vi.mock("@/features/theme/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn(), isSaving: false }),
}));


const SAMPLE_PEOPLE = [
  { id: "person-alex", name: "Alex Engineer", email: "alex@example.com", type: "internal_engineer" },
  { id: "person-bob", name: "Bob Developer", email: "bob@example.com", type: "internal_engineer" },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ManageUsersPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ManageUsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePeopleMock.mockReturnValue({
      data: SAMPLE_PEOPLE,
      isLoading: false,
    });
  });

  it("renders signed in user and linked person details", () => {
    useAuthMock.mockReturnValue({
      user: {
        id: "u1",
        username: "admin",
        email: "admin@example.com",
        peopleId: "person-alex",
        person: {
          id: "person-alex",
          name: "Alex Engineer",
          email: "alex@example.com",
        },
        roles: ["admin"],
      },
      updateLinkedPerson: updateLinkedPersonMock,
    });

    renderPage();

    expect(screen.getByText("Signed in as")).toBeInTheDocument();
    expect(screen.getAllByText("admin").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(screen.getByText("Linked Person")).toBeInTheDocument();
    expect(screen.getAllByText("Alex Engineer").length).toBeGreaterThanOrEqual(1);
  });

  it("allows admin to select a different person and save changes", async () => {
    updateLinkedPersonMock.mockResolvedValueOnce({
      id: "u1",
      peopleId: "person-bob",
      person: { id: "person-bob", name: "Bob Developer", email: "bob@example.com" },
    });

    useAuthMock.mockReturnValue({
      user: {
        id: "u1",
        username: "admin",
        email: "admin@example.com",
        peopleId: "person-alex",
        person: {
          id: "person-alex",
          name: "Alex Engineer",
          email: "alex@example.com",
        },
        roles: ["admin"],
      },
      updateLinkedPerson: updateLinkedPersonMock,
    });

    renderPage();

    expect(screen.getByText("Change linked person")).toBeInTheDocument();
    const saveBtn = screen.getByRole("button", { name: "Save changes" });
    expect(saveBtn).toBeDisabled(); // Initially same person selected

    // Open select dropdown and pick Bob Developer
    const trigger = screen.getByRole("combobox", { name: "Select person to link" });
    fireEvent.click(trigger);

    // Click Bob Developer
    const bobOption = await screen.findByRole("option", { name: /Bob Developer/ });
    fireEvent.click(bobOption);

    // Save button should now be enabled
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateLinkedPersonMock).toHaveBeenCalledWith("person-bob");
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Linked person updated",
      })
    );
  });

  it("restricts non-admin users from changing the linked person", () => {
    useAuthMock.mockReturnValue({
      user: {
        id: "u2",
        username: "john",
        email: "john@example.com",
        peopleId: "person-alex",
        person: {
          id: "person-alex",
          name: "Alex Engineer",
          email: "alex@example.com",
        },
        roles: ["member"],
      },
      updateLinkedPerson: updateLinkedPersonMock,
    });

    renderPage();

    expect(
      screen.getByText("Only system administrators can reassign or change the linked person.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Change linked person")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Select person to link" })).not.toBeInTheDocument();
  });
});
