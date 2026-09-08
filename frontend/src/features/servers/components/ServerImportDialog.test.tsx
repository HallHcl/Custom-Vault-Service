import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerImportDialog } from "./ServerImportDialog";

const getMock = vi.fn();
const postMock = vi.fn();
const toastMock = vi.fn();

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

function renderDialog(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ServerImportDialog
        open={true}
        onOpenChange={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  );
}

describe("ServerImportDialog", () => {
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


  it("renders modal and instructions", async () => {
    renderDialog();
    expect(await screen.findByText(/Import servers from Excel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Paste Excel data/i)).toBeInTheDocument();
  });

  it("parses pasted Excel rows, shows live preview, and maps extra columns to notes", async () => {
    renderDialog();
    const textarea = await screen.findByLabelText(/Paste Excel data/i);

    const pastedExcel =
      "Hostname\tIP Address\tUsername\tPassword\tSpec\tOS\n" +
      "web-01\t10.99.3.244\troot\tsecret123\tcpu 4 ram 8 sda : 500G\tUbuntu 22.04\n" +
      "db-01\t10.99.3.245\tpostgres\tdbpass\tcpu 8 ram 16\tDebian 12";

    fireEvent.change(textarea, { target: { value: pastedExcel } });

    await waitFor(() => {
      expect(screen.getByText(/Preview \(2 servers detected\)/i)).toBeInTheDocument();
      expect(screen.getByText("web-01")).toBeInTheDocument();
      expect(screen.getByText("db-01")).toBeInTheDocument();
      expect(screen.getByText("10.99.3.244")).toBeInTheDocument();
      expect(screen.getByText("10.99.3.245")).toBeInTheDocument();
      expect(screen.getByText("root")).toBeInTheDocument();
      expect(screen.getByText("postgres")).toBeInTheDocument();
      expect(screen.getByText(/Spec: cpu 4 ram 8 sda : 500G/i)).toBeInTheDocument();
      expect(screen.getByText(/All valid/i)).toBeInTheDocument();
    });
  });

  it("submits parsed servers with aggregated notes on clicking import button", async () => {
    const onSuccess = vi.fn();
    renderDialog({ onSuccess });

    const textarea = await screen.findByLabelText(/Paste Excel data/i);
    const pastedExcel =
      "Hostname\tIP Address\tUsername\tPassword\tSpec\n" +
      "srv-prod-01\t192.168.1.100\troot\t123456\tcpu 4 ram 8 sda : 500G";

    fireEvent.change(textarea, { target: { value: pastedExcel } });

    await waitFor(() => {
      expect(screen.getByText("srv-prod-01")).toBeInTheDocument();
    });

    const importBtn = screen.getByRole("button", { name: /import 1 servers/i });
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
      expect(onSuccess).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Import complete",
          description: "Successfully imported 1 servers.",
        })
      );
    });
  });
});
