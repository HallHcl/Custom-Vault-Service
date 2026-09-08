import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResourceFormPage from "./ResourceFormPage";

vi.setConfig({ testTimeout: 15000 });

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

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: "p1", peopleId: "p1", name: "Alex" },
    roles: ["admin"],
    isLoading: false,
    isAuthenticated: true,
  }),
}));

function ok<T>(data: T) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}



function renderCreatePage(initialEntry = "/resources/new") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/resources/new" element={<ResourceFormPage mode="create" />} />
          <Route path="/resources" element={<div>Resources list page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderNewVersionPage(resourceId = "r1", search = "") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const entry = `/resources/${resourceId}/new-version${search}`;
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/resources/:id/new-version" element={<ResourceFormPage mode="new-version" />} />
          <Route path="/resources" element={<div>Resources list page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ResourceFormPage — create mode", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    toastMock.mockClear();
    getMock.mockResolvedValue(
      ok({ data: [], pagination: { page: 1, per_page: 20, total: 0, total_pages: 1 } })
    );
  });

  it("renders back to resources link and New resource header", () => {
    renderCreatePage();
    expect(screen.getByRole("link", { name: /back to resources/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New resource" })).toBeInTheDocument();
  });

  it("renders all 7 resource types in the Type select", async () => {
    renderCreatePage();

    fireEvent.click(screen.getByRole("combobox", { name: "Type" }));
    for (const label of ["Runbook", "SOP", "Architecture", "Troubleshooting", "FAQ", "Link", "PDF"]) {
      expect(await screen.findByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("blocks submit and shows a field error when content is empty for a content-required type", async () => {
    postMock.mockResolvedValue(ok({ id: "r1" }));
    renderCreatePage();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Deploy guide" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/content is required/i)).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("blocks submit and shows a field error for a non-https external_url on type link", async () => {
    renderCreatePage();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Docs link" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Type" }));
    fireEvent.click(await screen.findByRole("option", { name: "Link" }));

    fireEvent.change(screen.getByLabelText("External URL"), {
      target: { value: "http://insecure.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/must be a valid https:\/\/ URL/i)).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("submits the full payload on valid create and navigates back", async () => {
    postMock.mockResolvedValue(ok({ id: "r1" }));
    renderCreatePage();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Deploy guide" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Step 1: run test" } });
    fireEvent.change(screen.getByLabelText("Commit message"), { target: { value: "Initial draft" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        "/api/resources",
        expect.objectContaining({
          body: expect.objectContaining({
            title: "Deploy guide",
            type: "runbook",
            content: "Step 1: run test",
            commit_message: "Initial draft",
          }),
        })
      );
    });

    expect(await screen.findByText("Resources list page")).toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith({ title: "Resource created" });
  });

  it("stages diagrams and uploads them after creating the resource", async () => {
    postMock.mockImplementation((path: string) => {
      if (path === "/api/resources") {
        return Promise.resolve(ok({ id: "r1" }));
      }
      if (path === "/api/resources/{id}/attachments") {
        return Promise.resolve(ok({ id: "att-1", file_name: "diag.png" }));
      }
      return Promise.resolve(ok({}));
    });

    renderCreatePage();

    // Stage a file via the dropzone
    const input = screen.getByTestId("image-dropzone-input");
    const file = new File(["diag content"], "diag.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("diag.png")).toBeInTheDocument();
    expect(
      screen.getByText(/Staged files \(1\) — will upload when resource is saved/i)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Architecture Overview" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Overview body" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        "/api/resources/{id}/attachments",
        expect.objectContaining({
          params: { path: { id: "r1" } },
        })
      );
    });

    expect(await screen.findByText("Resources list page")).toBeInTheDocument();
  });

  it("loads content from file and infers title when Choose File is used", async () => {
    renderCreatePage();

    const fileInput = screen.getByTestId("content-file-input");
    const file = new File(["# Incident Response Runbook\n\nStep 1: Check logs"], "incident_response.md", {
      type: "text/markdown",
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByDisplayValue("incident response")).toBeInTheDocument();
    expect(screen.getByLabelText("Content")).toHaveValue(
      "# Incident Response Runbook\n\nStep 1: Check logs"
    );
    expect(toastMock).toHaveBeenCalledWith({
      title: "File loaded",
      description: 'Loaded content from "incident_response.md"',
    });
  });

  it("navigates back on Cancel without saving", async () => {
    renderCreatePage();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(await screen.findByText("Resources list page")).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });
});

describe("ResourceFormPage — new-version mode", () => {
  const SAMPLE_RESOURCE = {
    id: "r1",
    title: "Deploy guide",
    type: "runbook",
    current_version_id: "v1",
  };

  const SAMPLE_VERSION = {
    id: "v1",
    resource_id: "r1",
    version_number: 1,
    content: "Original content",
    external_url: null,
  };

  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    toastMock.mockClear();

    getMock.mockImplementation((path: string) => {
      if (path === "/api/resources/{id}") {
        return Promise.resolve(ok(SAMPLE_RESOURCE));
      }
      if (path === "/api/resources/{id}/versions/{versionId}") {
        return Promise.resolve(ok(SAMPLE_VERSION));
      }
      if (path === "/api/resources/{id}/attachments") {
        return Promise.resolve(ok([]));
      }
      return Promise.resolve(ok({ data: [] }));
    });
  });

  it("renders back to resource title link and pre-fills content from current version", async () => {
    renderNewVersionPage("r1");

    expect(await screen.findByRole("link", { name: "Back to Deploy guide" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Original content")).toBeInTheDocument();
  });

  it("renders existing attachments gallery and upload dropzone in new-version mode", async () => {
    renderNewVersionPage("r1");

    expect(await screen.findByText("Attachments & Diagrams")).toBeInTheDocument();
    expect(await screen.findByText("No diagrams or attachments yet")).toBeInTheDocument();
    expect(screen.getByText(/drag and drop diagrams or images/i)).toBeInTheDocument();
  });

  it("warns on duplicate baseline submission and allows proceeding", async () => {
    postMock.mockResolvedValue(ok({ id: "v2" }));
    renderNewVersionPage("r1");

    await screen.findByDisplayValue("Original content");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/this content is identical to the current version/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /create anyway/i }));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        "/api/resources/{id}/versions",
        expect.objectContaining({
          body: expect.objectContaining({
            content: "Original content",
          }),
        })
      );
    });

    expect(await screen.findByText("Resources list page")).toBeInTheDocument();
  });
});
