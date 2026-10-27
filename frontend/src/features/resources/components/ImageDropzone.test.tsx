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
      screen.getByText(/drag and drop files or attachments/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/all file types supported up to 1 gb each/i)
    ).toBeInTheDocument();
  });

  it("accepts all file types including binary (.exe) files", async () => {
    const onFilesSelected = vi.fn();
    renderDropzone({ onFilesSelected });
    const input = screen.getByTestId("image-dropzone-input");

    const exeFile = new File(["dummy binary"], "program.exe", { type: "application/x-msdownload" });
    fireEvent.change(input, { target: { files: [exeFile] } });

    expect(onFilesSelected).toHaveBeenCalledTimes(1);
    expect(onFilesSelected).toHaveBeenCalledWith([exeFile]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("rejects files larger than 1 GB with an inline error", async () => {
    renderDropzone();
    const input = screen.getByTestId("image-dropzone-input");

    const largeFile = new File(["a".repeat(100)], "large.bin", { type: "application/octet-stream" });
    Object.defineProperty(largeFile, "size", { value: 1024 * 1024 * 1024 + 1024 });

    fireEvent.change(input, { target: { files: [largeFile] } });

    expect(
      await screen.findByText(/"large.bin" exceeds the 1 GB limit/i)
    ).toBeInTheDocument();
  });

  it("allows dismissing the inline error alert", async () => {
    renderDropzone();
    const input = screen.getByTestId("image-dropzone-input");

    const largeFile = new File(["a".repeat(100)], "large.bin", { type: "application/octet-stream" });
    Object.defineProperty(largeFile, "size", { value: 1024 * 1024 * 1024 + 1024 });
    fireEvent.change(input, { target: { files: [largeFile] } });

    expect(await screen.findByText(/"large.bin" exceeds the 1 GB limit/i)).toBeInTheDocument();
    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    fireEvent.click(dismissButton);

    expect(screen.queryByText(/"large.bin" exceeds the 1 GB limit/i)).not.toBeInTheDocument();
  });

  it("calls onFilesSelected when valid files including Excel (.xlsx) and CSV (.csv) are provided in staging mode", async () => {
    const onFilesSelected = vi.fn();
    renderDropzone({ onFilesSelected });

    const input = screen.getByTestId("image-dropzone-input");
    const validXlsx = new File(["fake xlsx"], "data.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const validCsv = new File(["a,b,c"], "records.csv", { type: "text/csv" });

    fireEvent.change(input, { target: { files: [validXlsx, validCsv] } });

    expect(onFilesSelected).toHaveBeenCalledTimes(1);
    expect(onFilesSelected).toHaveBeenCalledWith([validXlsx, validCsv]);
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
