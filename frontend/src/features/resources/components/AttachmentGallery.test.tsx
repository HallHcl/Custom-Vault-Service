import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttachmentGallery } from "./AttachmentGallery";
import type { ResourceAttachmentWithUploader } from "@/hooks/useResourceAttachments";

const getMock = vi.fn();
const deleteMock = vi.fn();
const toastMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: {
      GET: (...args: unknown[]) => getMock(...args),
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

const SAMPLE_ATTACHMENTS: ResourceAttachmentWithUploader[] = [
  {
    id: "att-1",
    resource_id: "res-1",
    created_in_version_id: "ver-1",
    file_name: "architecture-diagram.png",
    mime_type: "image/png",
    size_bytes: 204800, // 200 KB
    caption: "High-level architecture overview",
    uploaded_by: "user-1",
    created_at: "2026-03-01T10:00:00.000Z",
    file_path: "/api/resources/res-1/attachments/att-1/content",
    deleted_at: null,
    uploader: {
      id: "user-1",
      name: "Alice Smith",
    },
  },
  {
    id: "att-2",
    resource_id: "res-1",
    created_in_version_id: null,
    file_name: "workflow.svg",
    mime_type: "image/svg+xml",
    size_bytes: 51200, // 50 KB
    caption: null,
    uploaded_by: "user-2",
    created_at: "2026-03-02T12:00:00.000Z",
    file_path: "/api/resources/res-1/attachments/att-2/content",
    deleted_at: null,
    uploader: {
      id: "user-2",
      name: "Bob Jones",
    },
  },
];

function renderGallery(props: React.ComponentProps<typeof AttachmentGallery>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AttachmentGallery {...props} />
    </QueryClientProvider>
  );
}

describe("AttachmentGallery", () => {
  beforeEach(() => {
    getMock.mockReset();
    deleteMock.mockReset();
    toastMock.mockReset();
    useAuthMock.mockReturnValue({
      user: { peopleId: "user-1", email: "alice@example.com" },
      roles: ["member"],
      isLoading: false,
    });
  });

  it("renders empty state when there are no attachments", async () => {
    getMock.mockResolvedValue(ok([]));
    renderGallery({ resourceId: "res-1" });

    expect(await screen.findByText("No diagrams or attachments yet")).toBeInTheDocument();
    expect(
      screen.getByText(/upload diagrams, images, or documents/i)
    ).toBeInTheDocument();
  });

  it("renders attachment list with thumbnails, captions, metadata and badges", async () => {
    getMock.mockResolvedValue(ok(SAMPLE_ATTACHMENTS));
    renderGallery({ resourceId: "res-1" });

    expect(await screen.findByText("architecture-diagram.png")).toBeInTheDocument();
    expect(screen.getByText("High-level architecture overview")).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("200 KB")).toBeInTheDocument();
    expect(screen.getByText("png")).toBeInTheDocument();

    expect(screen.getByText("workflow.svg")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("50 KB")).toBeInTheDocument();
    expect(screen.getByText("svg+xml")).toBeInTheDocument();
  });

  it("copies image to clipboard on button click", async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { write: writeMock },
      configurable: true,
      writable: true,
    });
    class MockClipboardItem {
      items: Record<string, unknown>;
      constructor(items: Record<string, unknown>) {
        this.items = items;
      }
    }
    // @ts-expect-error Mock ClipboardItem
    window.ClipboardItem = MockClipboardItem;
    // @ts-expect-error Mock ClipboardItem
    globalThis.ClipboardItem = MockClipboardItem;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(["fake-image"], { type: "image/png" })),
      })
    );

    getMock.mockResolvedValue(ok(SAMPLE_ATTACHMENTS));
    renderGallery({ resourceId: "res-1" });

    await screen.findByText("architecture-diagram.png");
    const copyButtons = screen.getAllByRole("button", { name: /copy image/i });
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(writeMock).toHaveBeenCalledTimes(1);
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Image copied",
        description: '"architecture-diagram.png" copied to clipboard.',
      })
    );

    vi.unstubAllGlobals();
  });

  it("opens full-size image modal when thumbnail is clicked and closes it", async () => {
    getMock.mockResolvedValue(ok(SAMPLE_ATTACHMENTS));
    renderGallery({ resourceId: "res-1" });

    await screen.findByText("architecture-diagram.png");
    const thumbBtn = screen.getByRole("button", {
      name: "View architecture-diagram.png full size",
    });
    fireEvent.click(thumbBtn);

    // Modal dialog is opened showing title and image
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("High-level architecture overview")).toBeInTheDocument();

    // Click Close button in dialog (either X icon button or footer Close button)
    const closeBtn = within(dialog).getAllByRole("button", { name: "Close" })[0];
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows delete button for the uploader and hides it for non-uploader members", async () => {
    useAuthMock.mockReturnValue({
      user: { peopleId: "user-1" },
      roles: ["member"],
      isLoading: false,
    });
    getMock.mockResolvedValue(ok(SAMPLE_ATTACHMENTS));
    renderGallery({ resourceId: "res-1" });

    await screen.findByText("architecture-diagram.png");

    // Alice uploaded att-1 -> can delete
    expect(
      screen.getByRole("button", { name: "Delete architecture-diagram.png" })
    ).toBeInTheDocument();

    // Bob uploaded att-2 -> Alice cannot delete
    expect(
      screen.queryByRole("button", { name: "Delete workflow.svg" })
    ).not.toBeInTheDocument();
  });

  it("shows delete button for all attachments when user is an admin", async () => {
    useAuthMock.mockReturnValue({
      user: { peopleId: "user-admin" },
      roles: ["admin"],
      isLoading: false,
    });
    getMock.mockResolvedValue(ok(SAMPLE_ATTACHMENTS));
    renderGallery({ resourceId: "res-1" });

    await screen.findByText("architecture-diagram.png");

    expect(
      screen.getByRole("button", { name: "Delete architecture-diagram.png" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete workflow.svg" })
    ).toBeInTheDocument();
  });

  it("opens ConfirmDialog and deletes attachment on confirm", async () => {
    deleteMock.mockResolvedValue(ok({ success: true }));
    const onDeleteSuccess = vi.fn();

    getMock.mockResolvedValue(ok(SAMPLE_ATTACHMENTS));
    renderGallery({ resourceId: "res-1", onDeleteSuccess });

    await screen.findByText("architecture-diagram.png");
    const deleteBtn = screen.getByRole("button", { name: "Delete architecture-diagram.png" });
    fireEvent.click(deleteBtn);

    // Confirm dialog appears
    expect(screen.getByText("Delete attachment?")).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete "architecture-diagram.png"/i)
    ).toBeInTheDocument();

    // Click confirm in dialog
    const confirmDeleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith(
        "/api/resources/{id}/attachments/{attachmentId}",
        expect.objectContaining({
          params: { path: { id: "res-1", attachmentId: "att-1" } },
        })
      );
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith({ title: "Attachment deleted" });
      expect(onDeleteSuccess).toHaveBeenCalledWith("att-1");
    });
  });

  it("downloads attachment file when Download button is clicked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(["file-content"], { type: "image/png" })),
      })
    );
    window.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/test-blob");
    window.URL.revokeObjectURL = vi.fn();

    getMock.mockResolvedValue(ok(SAMPLE_ATTACHMENTS));
    renderGallery({ resourceId: "res-1" });

    await screen.findByText("architecture-diagram.png");
    const downloadBtns = screen.getAllByRole("button", { name: /download/i });
    expect(downloadBtns.length).toBeGreaterThan(0);
    fireEvent.click(downloadBtns[0]);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Download started",
        })
      );
    });
  });

  it("renders document attachment (.md) with file badge and Download File button", async () => {
    const docAttachments: ResourceAttachmentWithUploader[] = [
      {
        id: "att-doc",
        resource_id: "res-1",
        created_in_version_id: null,
        file_name: "deploy-instructions.md",
        mime_type: "text/markdown",
        size_bytes: 1024,
        caption: "Markdown deploy guide",
        uploaded_by: "user-1",
        created_at: "2026-03-01T10:00:00.000Z",
        file_path: "/api/resources/res-1/attachments/att-doc/content",
        deleted_at: null,
        uploader: { id: "user-1", name: "Alice Smith" },
      },
    ];

    getMock.mockResolvedValue(ok(docAttachments));
    renderGallery({ resourceId: "res-1" });

    expect(await screen.findByText("deploy-instructions.md")).toBeInTheDocument();
    expect(screen.getByText("MD")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Download deploy-instructions.md" }).length).toBeGreaterThanOrEqual(1);
  });

  it("hides download and action buttons when hideActions is true", async () => {
    getMock.mockResolvedValue(ok(SAMPLE_ATTACHMENTS));
    renderGallery({ resourceId: "res-1", hideActions: true });

    expect(await screen.findByText("architecture-diagram.png")).toBeInTheDocument();
    expect(screen.getByText("workflow.svg")).toBeInTheDocument();

    // No Download or Copy Image buttons
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy image/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("filters inherited attachments correctly using targetVersionNumber and versions", async () => {
    const multiVersionAttachments: ResourceAttachmentWithUploader[] = [
      {
        ...SAMPLE_ATTACHMENTS[0],
        id: "att-v1",
        file_name: "v1-diagram.png",
        created_in_version_id: "ver-1",
      },
      {
        ...SAMPLE_ATTACHMENTS[1],
        id: "att-v3",
        file_name: "v3-diagram.png",
        created_in_version_id: "ver-3",
      },
    ];
    const versions = [
      { id: "ver-3", version_number: 3 },
      { id: "ver-2", version_number: 2 },
      { id: "ver-1", version_number: 1 },
    ];

    getMock.mockResolvedValue(ok(multiVersionAttachments));

    // When viewing version 2: should see v1-diagram.png (inherited), but NOT v3-diagram.png
    const { unmount } = renderGallery({
      resourceId: "res-1",
      targetVersionNumber: 2,
      versions,
    });

    expect(await screen.findByText("v1-diagram.png")).toBeInTheDocument();
    expect(screen.queryByText("v3-diagram.png")).not.toBeInTheDocument();

    unmount();

    // When viewing version 3: should see both v1-diagram.png and v3-diagram.png
    renderGallery({
      resourceId: "res-1",
      targetVersionNumber: 3,
      versions,
    });

    expect(await screen.findByText("v1-diagram.png")).toBeInTheDocument();
    expect(screen.getByText("v3-diagram.png")).toBeInTheDocument();
  });
});
