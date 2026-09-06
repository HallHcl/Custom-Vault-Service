import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbsProvider } from "@/components/layout/BreadcrumbsContext";
import ExpirationsPage from "./ExpirationsPage";

const getMock = vi.fn();
const postMock = vi.fn();
const deleteMock = vi.fn();
const useAuthMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: {
      GET: (...args: unknown[]) => getMock(...args),
      POST: (...args: unknown[]) => postMock(...args),
      PATCH: (...args: unknown[]) => patchMock(...args),
      DELETE: (...args: unknown[]) => deleteMock(...args),
    },
  };
});

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

function ok<T>(data: T) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

function paginated<T>(data: T[], totalPages = 1) {
  return {
    data,
    pagination: { page: 1, per_page: 20, total: data.length, total_pages: totalPages },
  };
}

const SAMPLE_CLIENT = {
  id: "c-1",
  name: "Acme Corp",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

const SAMPLE_EXPIRATION = {
  id: "exp-1",
  client_id: "c-1",
  project_id: null,
  server_id: null,
  type: "ssl_certificate",
  name: "Production Wildcard SSL",
  provider_or_vendor: "DigiCert",
  identifier: "*.acme.corp",
  expiry_date: "2026-10-01",
  alert_threshold_days: 30,
  status: "active",
  notes: "Auto-renewal enabled",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  days_until_expiry: 25,
  is_expired: false,
  is_critical: false,
  is_expiring_soon: true,
};

const DELETED_EXPIRATION = {
  ...SAMPLE_EXPIRATION,
  id: "exp-deleted",
  name: "Old Internal Cert",
  deleted_at: "2026-02-01T00:00:00.000Z",
};

function renderPage(initialUrl = "/expirations") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BreadcrumbsProvider>
        <MemoryRouter initialEntries={[initialUrl]}>
          <Routes>
            <Route path="/expirations" element={<ExpirationsPage />} />
            <Route path="/expirations/new" element={<div data-testid="new-page">New Expiration Page</div>} />
            <Route path="/expirations/:id/edit" element={<div data-testid="edit-page">Edit Page</div>} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbsProvider>
    </QueryClientProvider>
  );
}

describe("ExpirationsPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
    toastMock.mockReset();
    useAuthMock.mockReturnValue({
      user: { id: "u-1", name: "Alice", role: "admin" },
      roles: ["admin"],
      isAuthenticated: true,
    });

    getMock.mockImplementation((path: string) => {
      if (path === "/api/clients") return Promise.resolve(ok(paginated([SAMPLE_CLIENT])));
      if (path === "/api/expirations") return Promise.resolve(ok(paginated([SAMPLE_EXPIRATION])));
      return Promise.resolve(ok([]));
    });
  });

  it("renders expirations list once loaded with formatted columns and badges", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Production Wildcard SSL")).toBeInTheDocument();
    });

    expect(screen.getByText("*.acme.corp")).toBeInTheDocument();
    expect(screen.getByText("SSL Certificate")).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Production Wildcard SSL/i });
    expect(within(row).getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("25d left")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("parses days_ahead=30 from URL and requests backend with days_ahead: 30", async () => {
    renderPage("/expirations?days_ahead=30");

    await waitFor(() => {
      expect(screen.getByText("Production Wildcard SSL")).toBeInTheDocument();
    });

    const expCalls = getMock.mock.calls.filter(([path]) => path === "/api/expirations");
    expect(expCalls.length).toBeGreaterThanOrEqual(1);
    const lastCall = expCalls[expCalls.length - 1];
    expect(lastCall[1].params.query.days_ahead).toBe(30);

    // Filter bar shows "Clear days filter" when days_ahead is set
    expect(screen.getByRole("button", { name: /Clear days filter/i })).toBeInTheDocument();
  });

  it("shows empty state when no expirations match current filters", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/clients") return Promise.resolve(ok(paginated([SAMPLE_CLIENT])));
      if (path === "/api/expirations") return Promise.resolve(ok(paginated([])));
      return Promise.resolve(ok([]));
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No expirations found")).toBeInTheDocument();
    });
  });

  it("shows New expiration button to admin and member, but hides from viewer", async () => {
    const { unmount } = renderPage();
    expect(screen.getByRole("button", { name: "New expiration" })).toBeInTheDocument();
    unmount();

    useAuthMock.mockReturnValue({
      user: { id: "u-2", name: "Bob", role: "viewer" },
      roles: ["viewer"],
      isAuthenticated: true,
    });

    renderPage();
    expect(screen.queryByRole("button", { name: "New expiration" })).not.toBeInTheDocument();
  });

  it("navigates to /expirations/new when New expiration button is clicked", async () => {
    renderPage();

    const newBtn = await screen.findByRole("button", { name: "New expiration" });
    fireEvent.click(newBtn);

    expect(screen.getByTestId("new-page")).toBeInTheDocument();
  });

  it("navigates to /expirations/:id/edit when Edit is clicked in row actions", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Production Wildcard SSL")).toBeInTheDocument();
    });

    const actionsBtn = screen.getByRole("button", { name: "Actions" });
    fireEvent.pointerDown(actionsBtn, { button: 0 });

    const editItem = await screen.findByRole("menuitem", { name: "Edit" });
    fireEvent.click(editItem);

    expect(screen.getByTestId("edit-page")).toBeInTheDocument();
  });

  it("opens confirmation dialog on Delete and sends DELETE request on confirm", async () => {
    deleteMock.mockResolvedValueOnce(ok(SAMPLE_EXPIRATION));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Production Wildcard SSL")).toBeInTheDocument();
    });

    const actionsBtn = screen.getByRole("button", { name: "Actions" });
    fireEvent.pointerDown(actionsBtn, { button: 0 });

    const deleteItem = await screen.findByRole("menuitem", { name: "Delete" });
    fireEvent.click(deleteItem);

    expect(screen.getByText("Delete this expiration?")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("/api/expirations/{id}", {
        params: { path: { id: "exp-1" } },
      });
    });
  });

  it("shows Restore button on deleted row and calls restore endpoint on click", async () => {
    postMock.mockResolvedValueOnce(ok(SAMPLE_EXPIRATION));

    getMock.mockImplementation((path: string) => {
      if (path === "/api/clients") return Promise.resolve(ok(paginated([SAMPLE_CLIENT])));
      if (path === "/api/expirations") return Promise.resolve(ok(paginated([DELETED_EXPIRATION])));
      return Promise.resolve(ok([]));
    });

    renderPage("/expirations?deleted=true");

    await waitFor(() => {
      expect(screen.getByText("Old Internal Cert")).toBeInTheDocument();
    });

    const row = screen.getByRole("row", { name: /Old Internal Cert/i });
    expect(within(row).getByText("Deleted")).toBeInTheDocument();

    const restoreBtn = screen.getByRole("button", { name: "Restore" });
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/expirations/{id}/restore", {
        params: { path: { id: "exp-deleted" } },
      });
    });
  });

  it("shows Mark as Renewed for active and expired items, hides for renewed, deleted, and viewer", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/clients") return Promise.resolve(ok(paginated([SAMPLE_CLIENT])));
      if (path === "/api/expirations") {
        return Promise.resolve(ok(paginated([SAMPLE_EXPIRATION, EXPIRED_EXPIRATION, RENEWED_EXPIRATION])));
      }
      return Promise.resolve(ok([]));
    });

    const { unmount } = renderPage();

    await waitFor(() => {
      expect(screen.getByText("Production Wildcard SSL")).toBeInTheDocument();
      expect(screen.getByText("Old Expired Domain")).toBeInTheDocument();
      expect(screen.getByText("Renewed Firewall License")).toBeInTheDocument();
    });

    const activeRow = screen.getByRole("row", { name: /Production Wildcard SSL/i });
    const expiredRow = screen.getByRole("row", { name: /Old Expired Domain/i });
    const renewedRow = screen.getByRole("row", { name: /Renewed Firewall License/i });

    expect(within(activeRow).getByRole("button", { name: "Mark as Renewed" })).toBeInTheDocument();
    expect(within(expiredRow).getByRole("button", { name: "Mark as Renewed" })).toBeInTheDocument();
    expect(within(renewedRow).queryByRole("button", { name: "Mark as Renewed" })).not.toBeInTheDocument();

    unmount();

    // Viewer role should not see any Mark as Renewed button
    useAuthMock.mockReturnValue({
      user: { id: "u-2", name: "Bob", role: "viewer" },
      roles: ["viewer"],
      isAuthenticated: true,
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Production Wildcard SSL")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Mark as Renewed" })).not.toBeInTheDocument();
  });

  it("marks active expiration as renewed without changing expiry date", async () => {
    patchMock.mockResolvedValueOnce(ok({ ...SAMPLE_EXPIRATION, status: "renewed" }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Production Wildcard SSL")).toBeInTheDocument();
    });

    const row = screen.getByRole("row", { name: /Production Wildcard SSL/i });
    const renewBtn = within(row).getByRole("button", { name: "Mark as Renewed" });
    fireEvent.click(renewBtn);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Mark "Production Wildcard SSL" as renewed/i)).toBeInTheDocument();

    const confirmBtn = within(dialog).getByRole("button", { name: "Mark as Renewed" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith("/api/expirations/{id}", {
        params: { path: { id: "exp-1" } },
        body: {
          status: "renewed",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      });
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Expiration marked as renewed",
      })
    );
  });

  it("marks expiration as renewed with a new expiry date", async () => {
    patchMock.mockResolvedValueOnce(
      ok({ ...SAMPLE_EXPIRATION, status: "renewed", expiry_date: "2027-06-01" })
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Production Wildcard SSL")).toBeInTheDocument();
    });

    const row = screen.getByRole("row", { name: /Production Wildcard SSL/i });
    const renewBtn = within(row).getByRole("button", { name: "Mark as Renewed" });
    fireEvent.click(renewBtn);

    const dialog = await screen.findByRole("dialog");
    const dateInput = within(dialog).getByLabelText(/New Expiry Date/i);
    fireEvent.change(dateInput, { target: { value: "2027-06-01" } });

    const confirmBtn = within(dialog).getByRole("button", { name: "Mark as Renewed" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith("/api/expirations/{id}", {
        params: { path: { id: "exp-1" } },
        body: {
          status: "renewed",
          expiry_date: "2027-06-01",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      });
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Expiration marked as renewed",
      })
    );
  });

  it("handles 409 conflict when marking as renewed and informs user", async () => {
    patchMock.mockResolvedValueOnce(
      apiError(409, "CONFLICT", "Conflict: Record was modified by another user.")
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Production Wildcard SSL")).toBeInTheDocument();
    });

    const row = screen.getByRole("row", { name: /Production Wildcard SSL/i });
    const renewBtn = within(row).getByRole("button", { name: "Mark as Renewed" });
    fireEvent.click(renewBtn);

    const dialog = await screen.findByRole("dialog");
    const confirmBtn = within(dialog).getByRole("button", { name: "Mark as Renewed" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "This record was updated elsewhere",
          variant: "destructive",
        })
      );
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

