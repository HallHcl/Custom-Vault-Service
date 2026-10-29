import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDetailPage from "./ProjectDetailPage";

const getMock = vi.fn();
const useAuthMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: {
      GET: (...args: unknown[]) => getMock(...args),
      POST: vi.fn(),
      DELETE: vi.fn(),
    },
  };
});

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

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

const PROJECT_DETAIL = {
  id: "p1",
  client_id: "c1",
  name: "Migration",
  description: "Legacy data migration",
  owner_status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  deleted_at: null,
  client: { id: "c1", name: "Acme Corp" },
};

function mockGetByPath(handlers: {
  project?: unknown;
  roster?: unknown;
  clientPeople?: unknown;
  environments?: unknown;
  servers?: unknown;
  resources?: unknown;
}) {
  getMock.mockImplementation((path: string) => {
    if (path === "/api/projects/{id}") return Promise.resolve(handlers.project ?? ok(PROJECT_DETAIL));
    if (path === "/api/projects/{id}/people") return Promise.resolve(handlers.roster ?? ok([]));
    if (path === "/api/clients/{id}/people") return Promise.resolve(handlers.clientPeople ?? ok([]));
    if (path === "/api/environments") return Promise.resolve(handlers.environments ?? ok([]));
    if (path === "/api/servers") return Promise.resolve(handlers.servers ?? ok([]));
    if (path === "/api/resources") return Promise.resolve(handlers.resources ?? ok([]));
    throw new Error(`Unexpected path in test: ${path}`);
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/projects/p1"]}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    useAuthMock.mockReset();
    navigateMock.mockReset();
    useAuthMock.mockReturnValue({ roles: ["member"], isLoading: false });
  });

  it("shows a loading state while the fetch is in flight", () => {
    getMock.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading project/i)).toBeInTheDocument();
  });

  it("renders the project's fields once loaded", async () => {
    mockGetByPath({});

    renderPage();

    expect(await screen.findByText("Migration")).toBeInTheDocument();
    expect(screen.getByText("Legacy data migration")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("exposes the project name as the page's single <h1>", async () => {
    mockGetByPath({});

    renderPage();

    expect(await screen.findByRole("heading", { name: "Migration", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders a not-found error state for a missing project", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/api/projects/{id}") {
        return Promise.resolve(apiError(404, "NOT_FOUND", "Project not found"));
      }
      return Promise.resolve(ok([]));
    });

    renderPage();

    expect(await screen.findByText("Project not found")).toBeInTheDocument();
  });

  it("renders the roster section", async () => {
    mockGetByPath({
      roster: ok([
        {
          id: "pp1",
          project_id: "p1",
          role_in_project: "Lead engineer",
          created_at: "2026-01-01T00:00:00.000Z",
          person: { id: "person1", name: "Ada Lovelace", email: null, type: "internal_engineer", deleted_at: null },
        },
      ]),
    });

    renderPage();

    expect(await screen.findByText("Team")).toBeInTheDocument();
    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Lead engineer")).toBeInTheDocument();
  });

  it("shows the Edit button to an admin", async () => {
    useAuthMock.mockReturnValue({ roles: ["admin"], isLoading: false });
    mockGetByPath({});

    renderPage();

    expect(await screen.findByText("Migration")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("hides the Edit button from a non-admin (Project update is admin-only, verified against backend/src/routes/projects.routes.ts)", async () => {
    useAuthMock.mockReturnValue({ roles: ["member"], isLoading: false });
    mockGetByPath({});

    renderPage();

    expect(await screen.findByText("Migration")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });

  describe("single-column DetailPageShell adoption", () => {
    it("renders no aside column — the Team roster keeps the full content width", async () => {
      mockGetByPath({});
      const { container } = renderPage();

      await screen.findByText("Migration");
      // The shell only emits its two-column grid when an `aside` is passed;
      // this page passes none, so the 400px rail must never appear.
      expect(container.innerHTML).not.toContain("1fr_400px");
    });

    it("keeps the roster's own loading state while the page itself is fully rendered", async () => {
      getMock.mockImplementation((path: string) => {
        if (path === "/api/projects/{id}") return Promise.resolve(ok(PROJECT_DETAIL));
        // The roster query never resolves: only this nested section pends.
        if (path === "/api/projects/{id}/people") return new Promise(() => {});
        return Promise.resolve(ok([]));
      });

      renderPage();

      expect(await screen.findByText("Migration")).toBeInTheDocument();
      expect(screen.getByText("Loading team...")).toBeInTheDocument();
      // The shell's page-level loading state has resolved and must be gone.
      expect(screen.queryByText(/loading project/i)).not.toBeInTheDocument();
    });

    it("keeps the roster's two mutually-exclusive client-link hints distinct, not a generic empty state", async () => {
      // No people linked to the client at all.
      mockGetByPath({ roster: ok([]), clientPeople: ok([]) });
      const { unmount } = renderPage();

      expect(
        await screen.findByText(/No people are linked to this project's client yet/i)
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/already on the team/i)
      ).not.toBeInTheDocument();
      unmount();

      // Client has people, but all of them are already on the roster.
      const PERSON = { id: "person1", name: "Ada Lovelace", email: null, type: "internal_engineer", deleted_at: null };
      mockGetByPath({
        roster: ok([
          {
            id: "pp1",
            project_id: "p1",
            role_in_project: "Lead engineer",
            created_at: "2026-01-01T00:00:00.000Z",
            person: PERSON,
          },
        ]),
        clientPeople: ok([PERSON]),
      });
      renderPage();

      expect(
        await screen.findByText(/Everyone linked to this project's client is already on the team/i)
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/No people are linked to this project's client yet/i)
      ).not.toBeInTheDocument();
    });
  });

  describe("Google Drive-style Environments (sub-folders)", () => {
    const SAMPLE_ENV = {
      id: "env-1",
      project_id: "p1",
      name: "production",
      description: "Live production cluster",
      status: "production",
      created_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    };

    it("renders environments as Google Drive folder tiles with status badge", async () => {
      mockGetByPath({
        environments: ok({ data: [SAMPLE_ENV], pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 } }),
        servers: ok({ data: [{ id: "srv-1" }], pagination: { total: 3, page: 1, per_page: 1, total_pages: 3 } }),
      });

      renderPage();

      expect(await screen.findByTestId("environments-grid")).toBeInTheDocument();
      expect(screen.getAllByText(/production/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Live production cluster")).toBeInTheDocument();
    });

    it("navigates into the environment detail page when an environment card is clicked", async () => {
      mockGetByPath({
        environments: ok({ data: [SAMPLE_ENV], pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 } }),
      });

      renderPage();

      const envCard = await screen.findByRole("button", { name: "Open production environment" });
      envCard.click();

      expect(navigateMock).toHaveBeenCalledWith("/environments/env-1");
    });

    it("shows the New environment button to an admin", async () => {
      useAuthMock.mockReturnValue({ roles: ["admin"], isLoading: false });
      mockGetByPath({
        environments: ok({ data: [], pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 } }),
      });

      renderPage();

      expect(await screen.findByRole("button", { name: /new environment/i })).toBeInTheDocument();
    });
  });

  describe("Attached Resources section", () => {
    const SAMPLE_RESOURCE = {
      id: "res-1",
      project_id: "p1",
      type: "runbook",
      title: "Deploy Guide",
      category: "Operations",
      tags: [],
      current_version_id: "ver-1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
      deleted_at: null,
      current_version: {
        id: "ver-1",
        version_number: 2,
        created_at: "2026-01-02T00:00:00.000Z",
        author: { id: "u1", name: "Alice" },
      },
    };

    it("renders resources linked to the project as cards", async () => {
      mockGetByPath({
        resources: ok({
          data: [SAMPLE_RESOURCE],
          pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
        }),
      });

      renderPage();

      expect(await screen.findByTestId("resources-grid")).toBeInTheDocument();
      expect(screen.getByText("Deploy Guide")).toBeInTheDocument();
      expect(screen.getByText("Runbook")).toBeInTheDocument();
      expect(screen.getByText("v2")).toBeInTheDocument();
    });

    it("navigates to /resources?selected=res-1 when resource card is clicked", async () => {
      mockGetByPath({
        resources: ok({
          data: [SAMPLE_RESOURCE],
          pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 },
        }),
      });

      renderPage();

      const resCard = await screen.findByRole("button", { name: "Open Deploy Guide resource" });
      resCard.click();

      expect(navigateMock).toHaveBeenCalledWith("/resources?selected=res-1");
    });

    it("shows empty state when no resources are attached to the project", async () => {
      mockGetByPath({
        resources: ok({
          data: [],
          pagination: { total: 0, page: 1, per_page: 20, total_pages: 0 },
        }),
      });

      renderPage();

      expect(
        await screen.findByText(/This project doesn't have any attached resources yet/i)
      ).toBeInTheDocument();
    });
  });
});
