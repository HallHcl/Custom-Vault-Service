import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ClientDetailPage from "./ClientDetailPage";

const getMock = vi.fn();

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: { GET: (...args: unknown[]) => getMock(...args) },
  };
});

function ok<T>(data: T) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

function apiError(status: number, code: string, message: string) {
  return {
    data: undefined,
    error: { error: { code, message } },
    response: new Response(null, { status }),
  };
}

const CLIENT_DETAIL = {
  id: "c1",
  name: "Acme Corp",
  status: "active",
  description: "Long-standing client",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  deleted_at: null,
};

function mockGetByPath(handlers: { client?: unknown }) {
  getMock.mockImplementation((path: string) => {
    if (path === "/api/clients/{id}") return Promise.resolve(handlers.client ?? ok(CLIENT_DETAIL));
    throw new Error(`Unexpected path in test: ${path}`);
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/clients/c1"]}>
        <Routes>
          <Route path="/clients/:id" element={<ClientDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ClientDetailPage", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("shows a loading state while the fetch is in flight", () => {
    getMock.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading client/i)).toBeInTheDocument();
  });

  it("renders the client's fields once loaded", async () => {
    mockGetByPath({});

    renderPage();

    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Long-standing client")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("exposes the client name as the page's single <h1>", async () => {
    mockGetByPath({});

    renderPage();

    expect(await screen.findByRole("heading", { name: "Acme Corp", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders a not-found error state for a missing client", async () => {
    mockGetByPath({ client: apiError(404, "NOT_FOUND", "Client not found") });

    renderPage();

    expect(await screen.findByText("Client not found")).toBeInTheDocument();
  });
});
