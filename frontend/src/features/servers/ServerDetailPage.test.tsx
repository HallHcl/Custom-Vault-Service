import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ServerDetailPage from "./ServerDetailPage";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { BreadcrumbsProvider } from "@/components/layout/BreadcrumbsContext";

const getMock = vi.fn();
const patchMock = vi.fn();
const toastMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: {
      GET: (...args: unknown[]) => getMock(...args),
      PATCH: (...args: unknown[]) => patchMock(...args),
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

function apiError(status: number, code: string, message: string, details?: unknown) {
  return {
    data: undefined,
    error: { error: { code, message, details } },
    response: new Response(null, { status }),
  };
}

const SERVER_DETAIL = {
  id: "s1",
  environment_id: "e1",
  hostname: "web-01",
  ip_address: "10.0.0.1",
  tech_stack: ["node"],
  monitoring_url: null,
  notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  deleted_at: null,
  display_name: "Web 01",
  service_type: "application",
  access_method: "ssh",
  access_host: "web-01.internal",
  access_port: 22,
  access_path: null,
  environment: { id: "e1", name: "Production", project: { id: "p1", name: "Migration" } },
};

const PROJECT_DETAIL = {
  id: "p1",
  client_id: "c1",
  name: "Migration",
  description: null as string | null,
  owner_status: "owned",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null as string | null,
  client: { id: "c1", name: "Acme Corp" },
};

function mockGetByPath(handlers: {
  server?: unknown;
  credentials?: unknown;
  project?: unknown;
}) {
  getMock.mockImplementation((path: string) => {
    if (path === "/api/servers/{id}") return Promise.resolve(handlers.server ?? ok(SERVER_DETAIL));
    if (path === "/api/servers/{serverId}/credential-references")
      return Promise.resolve(handlers.credentials ?? ok([]));
    // Client-segment backfill for the breadcrumb trail (Task 3). Default: a
    // live project carrying its client. A soft-deleted project 404s here —
    // pass `project: apiError(404, ...)` to exercise that path.
    if (path === "/api/projects/{id}") return Promise.resolve(handlers.project ?? ok(PROJECT_DETAIL));
    throw new Error(`Unexpected path in test: ${path}`);
  });
}

function renderPage(initialPath = "/servers/s1") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <BreadcrumbsProvider>
          <Breadcrumbs />
          <Routes>
            <Route path="/servers/:id" element={<ServerDetailPage />} />
            <Route path="/servers/:id/edit" element={<div>Server edit page</div>} />
          </Routes>
        </BreadcrumbsProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ServerDetailPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    patchMock.mockReset();
    toastMock.mockClear();
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({ roles: ["member"], isLoading: false });
  });

  it("shows a loading state while the fetch is in flight", () => {
    getMock.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading server/i)).toBeInTheDocument();
  });

  it("renders the server's Access Documentation fields once loaded", async () => {
    mockGetByPath({});

    renderPage();

    expect(await screen.findByText("Web 01")).toBeInTheDocument();
    expect(screen.getByText("web-01")).toBeInTheDocument();
    expect(screen.getByText("Application")).toBeInTheDocument();
    expect(screen.getByText("SSH")).toBeInTheDocument();
    expect(screen.getByText("web-01.internal")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();
  });

  it("exposes the server display name as the page's single <h1>", async () => {
    mockGetByPath({});

    renderPage();

    expect(await screen.findByRole("heading", { name: "Web 01", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders a not-found error state for a missing server", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/servers/{id}") {
        return Promise.resolve(apiError(404, "NOT_FOUND", "Server not found"));
      }
      return Promise.resolve(ok([]));
    });

    renderPage();

    expect(await screen.findByText("Server not found")).toBeInTheDocument();
  });

  it("renders the credential references section as a management surface (Part 23d): visible list, Add gated to admin+member, Delete gated to admin only", async () => {
    mockGetByPath({
      credentials: ok([
        {
          id: "c1",
          server_id: "s1",
          label: "Vault path",
          reference_location: "secret/servers/web-01",
          notes: null,
          created_at: "2026-01-01T00:00:00.000Z",
          applies_to_access_method: "ssh",
        },
      ]),
    });
    useAuthMock.mockReturnValue({ roles: ["member"], isLoading: false });

    renderPage();

    expect(await screen.findByText("Credential references")).toBeInTheDocument();
    expect(await screen.findByText("Vault path")).toBeInTheDocument();
    expect(screen.getByText("secret/servers/web-01")).toBeInTheDocument();
    // Add is admin+member — visible to a member.
    expect(screen.getByRole("button", { name: /add credential reference/i })).toBeInTheDocument();
    // Delete is admin-only — not visible to a member (full CRUD gating is
    // covered in depth by CredentialRefList.test.tsx).
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
  });

  describe("Edit gating — admin+member (Server update, NOT admin-only like Environments)", () => {
    it("shows the Edit button to a member", async () => {
      useAuthMock.mockReturnValue({ roles: ["member"], isLoading: false });
      mockGetByPath({});

      renderPage();

      expect(await screen.findByText("Web 01")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    });

    it("shows the Edit button to an admin", async () => {
      useAuthMock.mockReturnValue({ roles: ["admin"], isLoading: false });
      mockGetByPath({});

      renderPage();

      expect(await screen.findByText("Web 01")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    });
  });

  describe("Edit navigation", () => {
    it("clicking Edit navigates to /servers/:id/edit", async () => {
      mockGetByPath({});
      renderPage();

      await screen.findByText("Web 01");
      fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));

      expect(await screen.findByText("Server edit page")).toBeInTheDocument();
    });
  });

  describe("breadcrumb Client segment (backfilled via useProject)", () => {
    it("shows the full Home > Clients > [Client] > Projects > [Project] > Environments > [Environment] > Servers > [Server] trail once the project fetch resolves", async () => {
      mockGetByPath({});

      renderPage();

      const nav = await screen.findByRole("navigation", { name: "Breadcrumb" });
      expect(await within(nav).findByRole("link", { name: "Clients" })).toHaveAttribute(
        "href",
        "/clients"
      );
      expect(within(nav).getByRole("link", { name: "Acme Corp" })).toHaveAttribute(
        "href",
        "/clients/c1"
      );
      expect(within(nav).getByRole("link", { name: "Migration" })).toHaveAttribute(
        "href",
        "/projects/p1"
      );
      expect(within(nav).getByText("Web 01")).toHaveAttribute("aria-current", "page");
    });

    it("degrades to the shorter trail (no Client segment, no error) when the project is soft-deleted and GET /projects/:id 404s", async () => {
      mockGetByPath({ project: apiError(404, "NOT_FOUND", "Project not found") });

      renderPage();

      const nav = await screen.findByRole("navigation", { name: "Breadcrumb" });
      expect(await within(nav).findByRole("link", { name: "Projects" })).toBeInTheDocument();
      expect(within(nav).getByRole("link", { name: "Migration" })).toHaveAttribute(
        "href",
        "/projects/p1"
      );
      expect(within(nav).queryByRole("link", { name: "Clients" })).not.toBeInTheDocument();
      // The server page itself renders fine regardless.
      expect(screen.getByText("web-01.internal")).toBeInTheDocument();
    });
  });

  describe("credential-reference gating after the two-column shell refactor", () => {
    // The audit warned that this section carries four distinct permission
    // conditions (manageable + Add/Edit admin+member + Delete admin-only) and
    // must move into the shell's `aside` as a unit rather than be re-derived.
    // These lock all four in place from the page's own perspective.
    const CREDENTIAL = {
      id: "c1",
      server_id: "s1",
      label: "Vault path",
      reference_location: "secret/servers/web-01",
      notes: null,
      created_at: "2026-01-01T00:00:00.000Z",
      applies_to_access_method: "ssh",
    };

    it("shows Add and Edit but not Delete to a member", async () => {
      mockGetByPath({ credentials: ok([CREDENTIAL]) });
      useAuthMock.mockReturnValue({ roles: ["member"], isLoading: false });

      renderPage();

      expect(await screen.findByText("Vault path")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add credential reference/i })).toBeInTheDocument();
      // Two Edit buttons: the header's (server edit) and the credential's.
      expect(screen.getAllByRole("button", { name: /^edit$/i })).toHaveLength(2);
      expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
    });

    it("shows Add, Edit and Delete to an admin", async () => {
      mockGetByPath({ credentials: ok([CREDENTIAL]) });
      useAuthMock.mockReturnValue({ roles: ["admin"], isLoading: false });

      renderPage();

      expect(await screen.findByText("Vault path")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add credential reference/i })).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /^edit$/i })).toHaveLength(2);
      expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
    });

    it("shows no management affordances at all to a user with no role", async () => {
      mockGetByPath({ credentials: ok([CREDENTIAL]) });
      useAuthMock.mockReturnValue({ roles: [], isLoading: false });

      renderPage();

      // The list itself still renders — only the write affordances are gated.
      expect(await screen.findByText("Vault path")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /add credential reference/i })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
    });

    it("keeps its own inline loading text rather than adopting the shell's page-level LoadingState", async () => {
      getMock.mockImplementation((path: string) => {
        if (path === "/api/servers/{id}") return Promise.resolve(ok(SERVER_DETAIL));
        // Credentials never resolve: the page itself must be fully rendered
        // while only this nested section is still pending.
        return new Promise(() => {});
      });

      renderPage();

      expect(await screen.findByText("Web 01")).toBeInTheDocument();
      expect(screen.getByText("Loading credentials...")).toBeInTheDocument();
      // The shell's page-level loading state must be gone by now.
      expect(screen.queryByText(/loading server/i)).not.toBeInTheDocument();
    });
  });
});
