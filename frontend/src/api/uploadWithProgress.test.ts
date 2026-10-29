import { describe, expect, it, vi } from "vitest";
import { uploadResourceAttachmentWithProgress } from "./uploadWithProgress";

vi.mock("./client", () => ({
  apiClient: {
    POST: vi.fn().mockResolvedValue({
      data: { id: "att-1" },
      error: undefined,
      response: new Response(null, { status: 201 }),
    }),
  },
  unwrapApiResult: vi.fn().mockImplementation((res) => Promise.resolve(res.data)),
}));

describe("uploadResourceAttachmentWithProgress", () => {
  it("uploads attachment and reports progress callback", async () => {
    const onProgress = vi.fn();
    const file = new File(["dummy file content"], "large-file.tar.gz", {
      type: "application/gzip",
    });

    const result = await uploadResourceAttachmentWithProgress({
      resourceId: "res-123",
      file,
      createdInVersionId: "ver-1",
      onProgress,
    });

    expect(result).toEqual({ id: "att-1" });
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        percent: 100,
      })
    );
  });
});

