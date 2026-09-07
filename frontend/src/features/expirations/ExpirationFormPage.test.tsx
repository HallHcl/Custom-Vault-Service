import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbsProvider } from "@/components/layout/BreadcrumbsContext";
import ExpirationFormPage from "./ExpirationFormPage";

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: {
      GET: (...args: unknown[]) => getMock(...args),
      POST: (...args: unknown[]) => postMock(...args),
      PATCH: (...args: unknown[]) => patchMock(...args),
    },
  };
});

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Alice" },
    roles: ["admin"],
    isAuthenticated: true,
  }),
}));

function ok<T>(data: T) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

function paginated<T>(data: T[]) {
  return {
    data,
    pagination: { page: 1, per_page: 20, total: data.length, total_pages: 1 },
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
  name: "Wildcard SSL",
  provider_or_vendor: "Let's Encrypt",
  identifier: "*.acme.corp",
  expiry_date: "2026-10-01",
  alert_threshold_days: 30,
  status: "active",
  notes: "Auto-renewed cert",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  days_until_expiry: 25,
  is_expired: false,
  is_critical: false,
  is_expiring_soon: true,
};

function renderPage(initialUrl: string, mode?: "create" | "edit") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BreadcrumbsProvider>
        <MemoryRouter initialEntries={[initialUrl]}>
          <Routes>
            <Route path="/expirations" element={<div data-testid="list-page">Expirations List</div>} />
            <Route path="/expirations/new" element={<ExpirationFormPage mode={mode ?? "create"} />} />
            <Route path="/expirations/:id/edit" element={<ExpirationFormPage mode={mode ?? "edit"} />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbsProvider>
    </QueryClientProvider>
  );
}

describe("ExpirationFormPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    toastMock.mockReset();

    getMock.mockImplementation((path: string) => {
      if (path === "/api/clients") return Promise.resolve(ok(paginated([SAMPLE_CLIENT])));
      if (path === "/api/expirations/{id}") return Promise.resolve(ok(SAMPLE_EXPIRATION));
      if (path === "/api/projects") return Promise.resolve(ok(paginated([])));
      if (path === "/api/environments") return Promise.resolve(ok(paginated([])));
      if (path === "/api/servers") return Promise.resolve(ok(paginated([])));
      return Promise.resolve(ok([]));
    });
  });

  it("renders create form with empty defaults and default alert threshold 30", async () => {
    renderPage("/expirations/new", "create");

    expect(screen.getByRole("heading", { name: "New expiration", level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText(/Alert threshold/i)).toHaveValue(30);
    expect(screen.getByRole("button", { name: "Create expiration" })).toBeInTheDocument();
  });

  it("validates required fields client-side on submit", async () => {
    renderPage("/expirations/new", "create");

    const submitBtn = screen.getByRole("button", { name: "Create expiration" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Name is required.")).toBeInTheDocument();
      expect(screen.getByText("Client is required.")).toBeInTheDocument();
      expect(screen.getByText("Expiry date is required.")).toBeInTheDocument();
    });

    expect(postMock).not.toHaveBeenCalled();
  });

  it("submits valid create payload and navigates back to /expirations", async () => {
    postMock.mockResolvedValueOnce(ok(SAMPLE_EXPIRATION));

    renderPage("/expirations/new", "create");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Wildcard SSL" } });
    fireEvent.change(screen.getByLabelText("Expiry date"), { target: { value: "2026-11-01" } });

    // Open and pick client
    const clientTrigger = await screen.findByLabelText("Client");
    fireEvent.click(clientTrigger);
    const clientOption = await screen.findByRole("option", { name: "Acme Corp" });
    fireEvent.click(clientOption);

    const submitBtn = screen.getByRole("button", { name: "Create expiration" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/expirations", {
        body: expect.objectContaining({
          name: "New Wildcard SSL",
          client_id: "c-1",
          type: "ssl_certificate",
          expiry_date: "2026-11-01",
          alert_threshold_days: 30,
          status: "active",
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("list-page")).toBeInTheDocument();
    });
    expect(toastMock).toHaveBeenCalledWith({ title: "Expiration created" });
  });

  it("pre-fills form fields from fetched expiration in edit mode", async () => {
    renderPage("/expirations/exp-1/edit", "edit");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Edit expiration", level: 1 })).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Name")).toHaveValue("Wildcard SSL");
    expect(screen.getByLabelText("Expiry date")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText(/Identifier/i)).toHaveValue("*.acme.corp");
    expect(screen.getByLabelText(/Provider/i)).toHaveValue("Let's Encrypt");
    expect(screen.getByLabelText(/Notes/i)).toHaveValue("Auto-renewed cert");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("submits update with updated_at optimistic lock token and navigates back to /expirations", async () => {
    patchMock.mockResolvedValueOnce(ok(SAMPLE_EXPIRATION));

    renderPage("/expirations/exp-1/edit", "edit");

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toHaveValue("Wildcard SSL");
    });

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Updated Wildcard SSL" } });

    const submitBtn = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(patchMock).toHaveBeenCalledWith("/api/expirations/{id}", {
        params: { path: { id: "exp-1" } },
        body: expect.objectContaining({
          name: "Updated Wildcard SSL",
          updated_at: "2026-01-01T00:00:00.000Z",
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("list-page")).toBeInTheDocument();
    });
    expect(toastMock).toHaveBeenCalledWith({ title: "Expiration updated" });
  });

  it("captures 409 conflict on update and displays ConflictState", async () => {
    patchMock.mockResolvedValueOnce({
      data: undefined,
      error: { error: { message: "Record was updated by another user", code: "CONFLICT" } },
      response: new Response(null, { status: 409 }),
    });

    renderPage("/expirations/exp-1/edit", "edit");

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toHaveValue("Wildcard SSL");
    });

    const submitBtn = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Record was updated by another user")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Reload latest version/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Keep my changes/i })).toBeInTheDocument();
  });
});
