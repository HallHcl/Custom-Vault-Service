import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CopyButton, writeTextToClipboard } from "./CopyButton";
import * as useToastModule from "@/hooks/use-toast";

describe("CopyButton & writeTextToClipboard", () => {
  const toastMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useToastModule, "toast").mockImplementation(toastMock);
  });

  it("copies via navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<CopyButton value="root@10.99.3.244" label="access host" />);
    const btn = screen.getByRole("button", { name: /copy access host/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("root@10.99.3.244");
      expect(screen.getByRole("button", { name: /access host copied/i })).toBeInTheDocument();
    });
  });

  it("falls back to document.execCommand('copy') when navigator.clipboard is undefined (insecure HTTP)", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });

    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    render(<CopyButton value="root@10.99.3.244" label="access host" />);
    const btn = screen.getByRole("button", { name: /copy access host/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(execCommand).toHaveBeenCalledWith("copy");
      expect(screen.getByRole("button", { name: /access host copied/i })).toBeInTheDocument();
    });
  });

  it("shows toast error when both modern API and execCommand fail", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });

    document.execCommand = vi.fn().mockReturnValue(false);

    render(<CopyButton value="root@10.99.3.244" label="access host" />);
    const btn = screen.getByRole("button", { name: /copy access host/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Couldn't copy",
          description: "Copy the access host manually: root@10.99.3.244",
          variant: "destructive",
        })
      );
    });
  });
});
