import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServerImportPage from "./ServerImportPage";
import { BreadcrumbsProvider } from "@/components/layout/BreadcrumbsContext";

vi.setConfig({ testTimeout: 15000 });

let currentRender: ReturnType<typeof render> | undefined;

afterEach(() => {
  currentRender?.unmount();
  cleanup();
});

const getMock = vi.fn();
const postMock = vi.fn();
const toastMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: {
      GET: (...args: unknown[]) => getMock(...args),
      POST: (...args: unknown[]) => postMock(...args),
    },
  };
});

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const SAMPLE_PROJECT = { id: "p-1", name: "Project Alpha" };
const SAMPLE_ENV = { id: "e-1", name: "DEV", project_id: "p-1" };

function renderPage(initialEntry = "/servers/import") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  currentRender = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <BreadcrumbsProvider>
          <Routes>
            <Route path="/servers/import" element={<ServerImportPage />} />
            <Route path="/servers" element={<div>Servers list page</div>} />
          </Routes>
        </BreadcrumbsProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return currentRender;
}

describe("ServerImportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation((url: string) => {
      if (url === "/api/projects") {
        return Promise.resolve({
          data: { data: [SAMPLE_PROJECT], pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 } },
          error: undefined,
          response: new Response(),
        });
      }
      if (url === "/api/environments") {
        return Promise.resolve({
          data: { data: [SAMPLE_ENV], pagination: { total: 1, page: 1, per_page: 20, total_pages: 1 } },
          error: undefined,
          response: new Response(),
        });
      }
      if (url === "/api/servers/service-types") {
        return Promise.resolve({ data: ["Application", "Database"], error: undefined, response: new Response() });
      }
      return Promise.resolve({ data: { data: [] }, error: undefined, response: new Response() });
    });
    postMock.mockResolvedValue({
      data: { id: "srv-new" },
      error: undefined,
      response: new Response(null, { status: 201 }),
    });
  });

  it("renders page header, back link, destination pickers, and instructions", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: /Import servers from Excel/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to servers/i })).toBeInTheDocument();
    expect(screen.getByText(/1\. Target Destination/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Batch Defaults/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Paste Spreadsheet Data/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Paste Excel rows here/i)).toBeInTheDocument();
  });

  it("loads sample data when clicking 'Load sample data'", async () => {
    renderPage();
    const loadSampleBtn = await screen.findByRole("button", { name: /Load sample data/i });
    fireEvent.click(loadSampleBtn);

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(within(table).getByText("app-prod-01")).toBeInTheDocument();
      expect(within(table).getByText("db-prod-01")).toBeInTheDocument();
      expect(within(table).getByText("win-rdp-01")).toBeInTheDocument();
    });
  });

  it("parses pasted Excel rows, shows live preview, and maps columns", async () => {
    renderPage();
    const textarea = await screen.findByLabelText(/Paste Excel rows here/i);
    const pastedExcel =
      "Hostname\tIP Address\tUsername\tPassword\tSpec\tOS\n" +
      "web-01\t10.99.3.244\troot\tsecret123\tcpu 4 ram 8 sda : 500G\tUbuntu 22.04\n" +
      "db-01\t10.99.3.245\tpostgres\tdbpass\tcpu 8 ram 16\tDebian 12";

    fireEvent.change(textarea, { target: { value: pastedExcel } });

    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(within(table).getByText("web-01")).toBeInTheDocument();
      expect(within(table).getByText("db-01")).toBeInTheDocument();
      expect(within(table).getByText("10.99.3.244")).toBeInTheDocument();
      expect(within(table).getByText("10.99.3.245")).toBeInTheDocument();
      expect(within(table).getByText(/root/i)).toBeInTheDocument();
      expect(within(table).getByText(/postgres/i)).toBeInTheDocument();
      expect(within(table).getByTitle(/Spec: cpu 4 ram 8 sda : 500G/i)).toBeInTheDocument();
      expect(screen.getByText(/All valid/i)).toBeInTheDocument();
    });
  });

  it("submits parsed servers and navigates to /servers on success", async () => {
    renderPage();
    const textarea = await screen.findByLabelText(/Paste Excel rows here/i);
    const pastedExcel =
      "Hostname\tIP Address\tUsername\tPassword\tSpec\n" +
      "srv-prod-01\t192.168.1.100\troot\t123456\tcpu 4 ram 8 sda : 500G";

    fireEvent.change(textarea, { target: { value: pastedExcel } });

    await waitFor(() => {
      expect(screen.getByText("srv-prod-01")).toBeInTheDocument();
    });

    const importBtn = screen.getByRole("button", { name: /import 1 server/i });
    await waitFor(() => {
      expect(importBtn).not.toBeDisabled();
    });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/servers", {
        body: expect.objectContaining({
          environment_id: "e-1",
          hostname: "srv-prod-01",
          display_name: "srv-prod-01",
          ip_address: "192.168.1.100",
          username: "root",
          password: "123456",
          notes: "Spec: cpu 4 ram 8 sda : 500G",
        }),
      });
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Import complete",
          description: "Successfully imported 1 servers.",
        })
      );
      expect(navigateMock).toHaveBeenCalledWith("/servers");
    });
  });

  it("allows inline editing of service type and connection per row", async () => {
    renderPage();
    const textarea = await screen.findByLabelText(/Paste Excel rows here/i);
    const pastedExcel =
      "Hostname\tIP Address\n" +
      "srv-alpha\t10.0.0.1\n" +
      "srv-beta\t10.0.0.2";

    fireEvent.change(textarea, { target: { value: pastedExcel } });

    await waitFor(() => {
      expect(screen.getByText("srv-alpha")).toBeInTheDocument();
      expect(screen.getByText("srv-beta")).toBeInTheDocument();
    });

    const serviceInputAlpha = screen.getByRole("combobox", {
      name: /service type for srv-alpha/i,
    });
    fireEvent.click(serviceInputAlpha);
    const dbOption = await screen.findByRole("option", { name: "Database" });
    fireEvent.click(dbOption);

    const serviceInputBeta = screen.getByRole("combobox", {
      name: /service type for srv-beta/i,
    });
    fireEvent.click(serviceInputBeta);
    const webOption = await screen.findByRole("option", { name: "Web" });
    fireEvent.click(webOption);

    const importBtn = screen.getByRole("button", { name: /import 2 servers/i });
    await waitFor(() => {
      expect(importBtn).not.toBeDisabled();
    });
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/api/servers", {
        body: expect.objectContaining({
          hostname: "srv-alpha",
          service_type: "Database",
        }),
      });
      expect(postMock).toHaveBeenCalledWith("/api/servers", {
        body: expect.objectContaining({
          hostname: "srv-beta",
          service_type: "Web",
        }),
      });
    });
  });
});
