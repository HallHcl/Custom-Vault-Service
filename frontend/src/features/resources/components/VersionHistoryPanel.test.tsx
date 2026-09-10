import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VersionHistoryPanel from "./VersionHistoryPanel";

const getMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: { GET: (...args: unknown[]) => getMock(...args) },
  };
});

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

function ok<T>(data: T) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

const VERSIONS = [
  {
    id: "v2",
    version_number: 2,
    commit_message: "Second pass",
    created_at: "2026-01-02T00:00:00.000Z",
    author: { id: "p1", name: "Alex" },
  },
  {
    id: "v1",
    version_number: 1,
    commit_message: "Initial version",
    created_at: "2026-01-01T00:00:00.000Z",
    author: { id: "p1", name: "Alex" },
  },
];

function versionDetail(id: string) {
  const summary = VERSIONS.find((v) => v.id === id)!;
  return {
    ...summary,
    resource_id: "r1",
    content: `Content for ${id}`,
    content_hash: `hash-${id}`,
    external_url: null,
    file_path: null,
    author_id: "p1",
  };
}

function mockGetByPath() {
  getMock.mockImplementation(
    (path: string, options: { params: { path: { versionId?: string } } }) => {
      if (path === "/api/resources/{id}/versions") {
        return Promise.resolve(
          ok({ data: VERSIONS, pagination: { page: 1, per_page: 20, total: 2, total_pages: 1 } })
        );
      }
      if (path === "/api/resources/{id}/versions/{versionId}") {
        return Promise.resolve(ok(versionDetail(options.params.path.versionId as string)));
      }
      if (path === "/api/resources/{id}/attachments") {
        return Promise.resolve(
          ok([
            {
              id: "att-v1",
              resource_id: "r1",
              created_in_version_id: "v1",
              file_name: "manual.pdf",
              file_path: "resources/r1/manual.pdf",
              mime_type: "application/pdf",
              size_bytes: 2048,
              caption: null,
              uploaded_by: "p1",
              uploader: { id: "p1", name: "Alex" },
              created_at: "2026-01-01T00:00:00.000Z",
              deleted_at: null,
            },
          ])
        );
      }
      throw new Error(`Unexpected path: ${path}`);
    }
  );
}

function renderPanel(onRevert = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <VersionHistoryPanel resourceId="r1" onRevert={onRevert} />
    </QueryClientProvider>
  );
  return { onRevert };
}

describe("VersionHistoryPanel — revert affordance", () => {
  beforeEach(() => {
    getMock.mockReset();
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({ roles: ["admin"], isLoading: false });
    mockGetByPath();
  });

  it("shows 'Revert to this version' on the historical (non-HEAD) version but not on HEAD (v2)", async () => {
    renderPanel();

    await screen.findByText("Second pass");
    expect(screen.getAllByRole("button", { name: /revert to this version/i })).toHaveLength(1);
  });

  it("calls onRevert with the historical version's id, not the current version's", async () => {
    const { onRevert } = renderPanel();

    await screen.findByText("Second pass");
    fireEvent.click(screen.getByRole("button", { name: /revert to this version/i }));

    expect(onRevert).toHaveBeenCalledWith("v1");
  });

  it("hides Revert from a role with neither admin nor member", async () => {
    useAuthMock.mockReturnValue({ roles: [], isLoading: false });
    renderPanel();

    await screen.findByText("Second pass");
    expect(screen.queryByRole("button", { name: /revert to this version/i })).not.toBeInTheDocument();
  });

  it("shows Revert to a member (admin+member gated, same as Add version)", async () => {
    useAuthMock.mockReturnValue({ roles: ["member"], isLoading: false });
    renderPanel();

    await screen.findByText("Second pass");
    expect(await screen.findByRole("button", { name: /revert to this version/i })).toBeInTheDocument();
  });

  it("still renders normally (no revert buttons at all) when onRevert is not provided", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <VersionHistoryPanel resourceId="r1" />
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText("Second pass")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /revert to this version/i })).not.toBeInTheDocument();
  });

  it("renders attachments associated with the selected version in the history panel without download buttons", async () => {
    renderPanel();

    await screen.findByText("Second pass");
    // HEAD version (v2) inherits manual.pdf from v1
    expect(await screen.findByText("manual.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Download File")).not.toBeInTheDocument();

    // Switch to v1
    const v1Button = screen.getByRole("button", { name: /v1/i });
    fireEvent.click(v1Button);

    expect(await screen.findByText("manual.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Download File")).not.toBeInTheDocument();
  });
});
