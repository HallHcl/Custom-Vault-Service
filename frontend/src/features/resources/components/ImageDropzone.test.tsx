import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageDropzone } from "./ImageDropzone";

const postMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: {
      POST: (...args: unknown[]) => postMock(...args),
    },
  };
});

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

function ok<T>(data: T) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

function renderDropzone(props: React.ComponentProps<typeof ImageDropzone> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ImageDropzone {...props} />
    </QueryClientProvider>
  );
}

describe("ImageDropzone", () => {
  beforeEach(() => {
    postMock.mockReset();
    toastMock.mockReset();
  });

  it("renders drag and drop instructions and helper text", () => {
    renderDropzone();
    expect(
      screen.getByText(/drag and drop diagrams or images/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/PNG, JPEG, WebP, SVG up to 10 MB each/i)
    ).toBeInTheDocument();
  });

  it("rejects files with invalid MIME types with an inline error", async () => {
    renderDropzone();
    const input = screen.getByTestId("image-dropzone-input");

    const textFile = new File(["dummy text"], "notes.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [textFile] } });

    expect(
      await screen.findByText(/"notes.txt" has an unsupported format/i)
    ).toBeInTheDocument();
  });

  it("rejects files larger than 10 MB with an inline error", async () => {
    renderDropzone();
    const input = screen.getByTestId("image-dropzone-input");

    const largeFile = new File(["a".repeat(100)], "large.png", { type: "image/png" });
    Object.defineProperty(largeFile, "size", { value: 11 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [largeFile] } });

    expect(
      await screen.findByText(/"large.png" exceeds the 10 MB limit/i)
    ).toBeInTheDocument();
  });

  it("allows dismissing the inline error alert", async () => {
    renderDropzone();
    const input = screen.getByTestId("image-dropzone-input");

    const textFile = new File(["dummy text"], "notes.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [textFile] } });

    expect(await screen.findByText(/"notes.txt" has an unsupported format/i)).toBeInTheDocument();
    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    fireEvent.click(dismissButton);

    expect(screen.queryByText(/"notes.txt" has an unsupported format/i)).not.toBeInTheDocument();
  });

  it("calls onFilesSelected when valid files are provided in staging mode", async () => {
    const onFilesSelected = vi.fn();
    renderDropzone({ onFilesSelected });

    const input = screen.getByTestId("image-dropzone-input");
    const validPng = new File(["png content"], "diagram.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [validPng] } });

    expect(onFilesSelected).toHaveBeenCalledTimes(1);
    expect(onFilesSelected).toHaveBeenCalledWith([validPng]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uploads valid file directly and triggers onUploadSuccess when resourceId is provided", async () => {
    const onUploadSuccess = vi.fn();
    const mockAttachment = {
      id: "att-1",
      resource_id: "res-1",
      file_name: "diagram.png",
      file_path: "resources/res-1/diagram.png",
      mime_type: "image/png",
      size_bytes: 1024,
      caption: null,
      uploaded_by: "p-1",
      uploader: { id: "p-1", name: "Alice" },
      created_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    };
    postMock.mockResolvedValue(ok(mockAttachment));

    renderDropzone({ resourceId: "res-1", onUploadSuccess });

    const input = screen.getByTestId("image-dropzone-input");
    const validPng = new File(["png content"], "diagram.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [validPng] } });

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(1);
    });

    expect(postMock).toHaveBeenCalledWith(
      "/api/resources/{id}/attachments",
      expect.objectContaining({
        params: { path: { id: "res-1" } },
      })
    );

    expect(onUploadSuccess).toHaveBeenCalledWith(mockAttachment);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Upload complete" })
    );
  });
});
