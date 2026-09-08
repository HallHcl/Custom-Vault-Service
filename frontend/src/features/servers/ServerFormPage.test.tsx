import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ServerFormPage from "./ServerFormPage";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { BreadcrumbsProvider } from "@/components/layout/BreadcrumbsContext";

vi.setConfig({ testTimeout: 15000 });

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
    user: { id: "u1", peopleId: "p1", name: "Alex" },
    roles: ["admin"],
    isLoading: false,
    isAuthenticated: true,
  }),
}));

const SAMPLE_ENVIRONMENT = {
  id: "e1",
  project_id: "p1",
  name: "PROD",
  description: null,
  status: "implementation",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  vpn_resource_id: null,
};

const SAMPLE_PROJECT = {
  id: "p1",
  name: "Migration",
  description: null,
  owner_status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

const SAMPLE_SERVER = {
  id: "s1",
  environment_id: "e1",
  hostname: "web-01",
  ip_address: "10.0.0.1",
  tech_stack: ["node", "postgres"],
  monitoring_url: "https://grafana.example.com",
  notes: "Primary web server",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  deleted_at: null,
  display_name: "Web 01",
  service_type: "application" as const,
  access_method: "ssh" as const,
  access_host: "web-01.internal",
  access_port: 22,
  access_path: "/dashboard",
  environment: { id: "e1", name: "Production", project: { id: "p1", name: "Migration" } },
};

function ok<T>(data: T) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

function created<T>(data: T) {
  return { data, error: undefined, response: new Response(null, { status: 201 }) };
}

function apiError(status: number, code: string, message: string, details?: unknown) {
  return {
    data: undefined,
    error: { error: { code, message, details } },
    response: new Response(null, { status }),
  };
}

function renderCreatePage(initialEntry = "/servers/new") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <BreadcrumbsProvider>
          <Breadcrumbs />
          <Routes>
            <Route path="/servers/new" element={<ServerFormPage mode="create" />} />
            <Route path="/servers" element={<div>Servers list page</div>} />
          </Routes>
        </BreadcrumbsProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderEditPage(initialEntry = "/servers/s1/edit") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <BreadcrumbsProvider>
          <Breadcrumbs />
          <Routes>
            <Route path="/servers/:id/edit" element={<ServerFormPage mode="edit" />} />
            <Route path="/servers/:id" element={<div>Server detail page s1</div>} />
            <Route path="/servers" element={<div>Servers list page</div>} />
          </Routes>
        </BreadcrumbsProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ServerFormPage — Create mode", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    toastMock.mockClear();

    getMock.mockImplementation((path: string) => {
      if (path === "/api/projects") {
        return Promise.resolve(
          ok({ data: [SAMPLE_PROJECT], pagination: { page: 1, per_page: 20, total: 1, total_pages: 1 } })
        );
      }
      if (path === "/api/environments") {
        return Promise.resolve(
          ok({ data: [SAMPLE_ENVIRONMENT], pagination: { page: 1, per_page: 20, total: 1, total_pages: 1 } })
        );
      }
      if (path === "/api/servers/service-types") {
        return Promise.resolve(ok(["Jump host", "Application"]));
      }
      throw new Error(`Unexpected GET in test: ${path}`);
    });
  });

  /** Create mode now requires picking the Project before the Environment. */
  async function pickProjectAndEnvironment() {
    fireEvent.click(await screen.findByRole("combobox", { name: /^project$/i }));
    fireEvent.click(await screen.findByRole("option", { name: "Migration" }));
    fireEvent.click(await screen.findByRole("combobox", { name: /^environment$/i }));
    fireEvent.click(await screen.findByRole("option", { name: "PROD" }));
  }

  it("renders empty form with breadcrumbs and back link", async () => {
    renderCreatePage();

    expect(screen.getByRole("heading", { name: "New server", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to servers/i })).toHaveAttribute("href", "/servers");

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Servers" })).toHaveAttribute("href", "/servers");
    expect(within(nav).getByText("New server")).toBeInTheDocument();
  });

  it("blocks submit with client-side errors when required fields are empty", async () => {
    renderCreatePage();

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Project is required.")).toBeInTheDocument();
    expect(screen.getByText("Environment is required.")).toBeInTheDocument();
    expect(screen.getByText("Hostname is required.")).toBeInTheDocument();
    expect(screen.queryByText("Service type is required.")).not.toBeInTheDocument();
    expect(screen.queryByText("Connection type is required.")).not.toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("focuses the first invalid field in DOM order on validation failure", async () => {
    renderCreatePage();

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await screen.findByText("Project is required.");
    expect(document.activeElement).toBe(
      screen.getByRole("combobox", { name: /^project$/i })
    );
  });

  it("creates a server from the simplified form, supporting Jump host and RDP", async () => {
    postMock.mockResolvedValue(created(SAMPLE_SERVER));
    renderCreatePage();

    await pickProjectAndEnvironment();

    fireEvent.change(screen.getByLabelText("Hostname"), { target: { value: "jump-01" } });
    fireEvent.change(screen.getByLabelText(/ip address/i), { target: { value: "10.0.0.1" } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: "root" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "s3cret" } });

    const serviceTrigger = screen.getByRole("combobox", { name: /service type/i });
    fireEvent.click(serviceTrigger);
    fireEvent.click(await screen.findByRole("option", { name: "Jump host" }));

    const connectionTrigger = screen.getByRole("combobox", { name: /connection type/i });
    fireEvent.click(connectionTrigger);
    fireEvent.click(await screen.findByRole("option", { name: "RDP" }));

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const [path, options] = postMock.mock.calls[0];
    expect(path).toBe("/api/servers");
    expect(options.body).toMatchObject({
      environment_id: "e1",
      hostname: "jump-01",
      ip_address: "10.0.0.1",
      username: "root",
      password: "s3cret",
      // derived
      display_name: "jump-01",
      service_type: "Jump host",
      access_method: "rdp",
    });
    // access_host is not sent on create — the backend derives username@host.
    expect(options.body.access_host).toBeUndefined();

    expect(toastMock).toHaveBeenCalledWith({ title: "Server created" });
    expect(await screen.findByText("Servers list page")).toBeInTheDocument();
  });

  it("creates a server without service_type and connection_type if omitted", async () => {
    postMock.mockResolvedValue(created(SAMPLE_SERVER));
    renderCreatePage();

    await pickProjectAndEnvironment();

    fireEvent.change(screen.getByLabelText("Hostname"), { target: { value: "bare-01" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const [path, options] = postMock.mock.calls[0];
    expect(path).toBe("/api/servers");
    expect(options.body).toMatchObject({
      environment_id: "e1",
      hostname: "bare-01",
      display_name: "bare-01",
    });
    expect(options.body.service_type).toBeUndefined();
    expect(options.body.access_method).toBeUndefined();
  });

  it("allows entering and saving a custom service_type like Redis", async () => {
    postMock.mockResolvedValue(created(SAMPLE_SERVER));
    renderCreatePage();

    await pickProjectAndEnvironment();

    fireEvent.change(screen.getByLabelText("Hostname"), { target: { value: "redis-01" } });

    const serviceTrigger = screen.getByRole("combobox", { name: /service type/i });
    fireEvent.click(serviceTrigger);

    const searchInput = screen.getByPlaceholderText(/search or type new/i);
    fireEvent.change(searchInput, { target: { value: "Redis" } });

    const addOption = await screen.findByText(/add "redis"/i);
    fireEvent.click(addOption);

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const [, options] = postMock.mock.calls[0];
    expect(options.body.service_type).toBe("Redis");
  });

  it("navigates back to /servers on cancel without mutation", async () => {
    renderCreatePage();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(postMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Servers list page")).toBeInTheDocument();
  });

  it("surfaces server-side validation error against the relevant field", async () => {
    postMock.mockResolvedValue(
      apiError(400, "VALIDATION_ERROR", "Validation failed", {
        formErrors: [],
        fieldErrors: { hostname: ["Hostname already taken"] },
      })
    );

    renderCreatePage();

    await pickProjectAndEnvironment();
    fireEvent.change(screen.getByLabelText("Hostname"), { target: { value: "web-01" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Hostname already taken")).toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith({
      title: "Couldn't create server",
      description: "Check the highlighted fields below.",
      variant: "destructive",
    });
  });
});

describe("ServerFormPage — Edit mode", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    toastMock.mockClear();

    getMock.mockImplementation((path: string) => {
      if (path === "/api/servers/{id}") return Promise.resolve(ok(SAMPLE_SERVER));
      if (path === "/api/servers/service-types") return Promise.resolve(ok(["Application", "Database"]));
      throw new Error(`Unexpected GET in test: ${path}`);
    });
  });

  it("shows loading state while server data is in flight", () => {
    getMock.mockImplementation(() => new Promise(() => {}));
    renderEditPage();

    expect(screen.getByText(/loading server/i)).toBeInTheDocument();
  });

  it("shows error state when server fetch fails", async () => {
    getMock.mockResolvedValue(apiError(404, "NOT_FOUND", "Server not found"));
    renderEditPage();

    expect(await screen.findByText("This server could not be found.")).toBeInTheDocument();
  });

  it("pre-fills form, locks environment, and renders edit breadcrumbs", async () => {
    renderEditPage();

    expect(await screen.findByRole("heading", { name: "Edit server", level: 1 })).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Servers" })).toHaveAttribute("href", "/servers");
    expect(within(nav).getByRole("link", { name: "Web 01" })).toHaveAttribute("href", "/servers/s1");
    expect(within(nav).getByText("Edit")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /back to web 01/i })).toHaveAttribute("href", "/servers/s1");

    expect(screen.getByLabelText("Display name")).toHaveValue("Web 01");
    expect(screen.getByLabelText("Hostname")).toHaveValue("web-01");
    expect(screen.getByLabelText(/ip address/i)).toHaveValue("10.0.0.1");
    expect(screen.getByLabelText("Tech stack")).toHaveValue("node, postgres");
    expect(screen.getByLabelText("Access host")).toHaveValue("web-01.internal");
    expect(screen.getByLabelText(/port/i)).toHaveValue(22);
    expect(screen.getByLabelText(/access path/i)).toHaveValue("/dashboard");
    expect(screen.getByLabelText(/monitoring url/i)).toHaveValue("https://grafana.example.com");
    expect(screen.getByLabelText(/notes/i)).toHaveValue("Primary web server");

    // Environment is locked and disabled
    expect(screen.getByDisplayValue("Migration / Production")).toBeDisabled();
    expect(
      screen.getByText("A server's environment can't be changed after creation.")
    ).toBeInTheDocument();
  });

  it("submits PATCH with updated_at and without environment_id, toasts and navigates to detail", async () => {
    patchMock.mockResolvedValue(ok({ ...SAMPLE_SERVER, hostname: "web-01-renamed" }));
    renderEditPage();

    await screen.findByDisplayValue("web-01");
    fireEvent.change(screen.getByLabelText("Hostname"), { target: { value: "web-01-renamed" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(patchMock).toHaveBeenCalledTimes(1));
    const [path, options] = patchMock.mock.calls[0];
    expect(path).toBe("/api/servers/{id}");
    expect(options.params).toEqual({ path: { id: "s1" } });
    expect(options.body).toMatchObject({
      hostname: "web-01-renamed",
      updated_at: SAMPLE_SERVER.updated_at,
    });
    expect(options.body.environment_id).toBeUndefined();

    expect(toastMock).toHaveBeenCalledWith({ title: "Server updated" });
    expect(await screen.findByText("Server detail page s1")).toBeInTheDocument();
  });

  it("navigates back to detail on cancel without mutation", async () => {
    renderEditPage();

    await screen.findByDisplayValue("web-01");
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(patchMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Server detail page s1")).toBeInTheDocument();
  });

  it("handles 409 conflict and allows retry with latest timestamp", async () => {
    patchMock.mockResolvedValueOnce(
      apiError(409, "CONFLICT", "Server was modified by someone else; refresh and try again")
    );
    renderEditPage();

    await screen.findByDisplayValue("web-01");
    fireEvent.change(screen.getByLabelText("Hostname"), { target: { value: "web-01-updated" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("This record changed")).toBeInTheDocument();
    expect(
      screen.getByText("Server was modified by someone else; refresh and try again")
    ).toBeInTheDocument();

    const freshServer = { ...SAMPLE_SERVER, updated_at: "2026-01-03T00:00:00.000Z" };
    getMock.mockImplementation((path: string) => {
      if (path === "/api/servers/{id}") return Promise.resolve(ok(freshServer));
      if (path === "/api/servers/service-types") return Promise.resolve(ok(["Application", "Database"]));
      throw new Error(`Unexpected GET in test: ${path}`);
    });
    patchMock.mockResolvedValueOnce(ok({ ...freshServer, hostname: "web-01-updated" }));

    fireEvent.click(screen.getByRole("button", { name: /keep my changes/i }));

    await waitFor(() => expect(patchMock).toHaveBeenCalledTimes(2));
    const [, retryOptions] = patchMock.mock.calls[1];
    expect(retryOptions.body).toMatchObject({
      hostname: "web-01-updated",
      updated_at: freshServer.updated_at,
    });

    expect(toastMock).toHaveBeenCalledWith({ title: "Server updated" });
    expect(await screen.findByText("Server detail page s1")).toBeInTheDocument();
  });
});
