import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ServerTable from "./ServerTable";
import type { Server } from "@/types";

const apiPostMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    post: (...args: unknown[]) => apiPostMock(...args),
  },
  default: {
    post: (...args: unknown[]) => apiPostMock(...args),
  },
}));

vi.mock("./CredentialRefList", () => ({
  default: () => <div data-testid="mock-cred-list">No credential references.</div>,
}));

const BASE_SERVER: Server = {
  id: "s1",
  environment_id: "e1",
  hostname: "srv-01",
  ip_address: "10.0.0.1",
  tech_stack: ["node"],
  monitoring_url: null,
  notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  display_name: "Srv 01",
  service_type: "application",
  access_method: "ssh",
  access_host: "root@10.0.0.1",
  access_port: 22,
  access_path: null,
};

describe("ServerTable", () => {
  beforeEach(() => {
    apiPostMock.mockReset();
    apiPostMock.mockResolvedValue({ data: { success: true } });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  it("renders access method and target when access_method is provided", () => {
    render(
      <MemoryRouter>
        <ServerTable servers={[BASE_SERVER]} />
      </MemoryRouter>
    );

    expect(screen.getByText("SSH")).toBeInTheDocument();
    expect(screen.getByText("root@10.0.0.1:22")).toBeInTheDocument();
  });

  it("renders target even when access_method is null (e.g. user entered IP and username without connection type)", () => {
    const serverWithoutMethod: Server = {
      ...BASE_SERVER,
      access_method: null,
      access_host: "root@20.30.4.10",
      access_port: null,
    };

    render(
      <MemoryRouter>
        <ServerTable servers={[serverWithoutMethod]} />
      </MemoryRouter>
    );

    expect(screen.queryByText("SSH")).not.toBeInTheDocument();
    expect(screen.getByText("root@20.30.4.10")).toBeInTheDocument();
  });

  it("falls back to username@ip if access_host is empty", () => {
    const serverFallback: Server = {
      ...BASE_SERVER,
      username: "admin",
      ip_address: "192.168.1.50",
      access_method: null,
      access_host: "",
      access_port: null,
    };

    render(
      <MemoryRouter>
        <ServerTable servers={[serverFallback]} />
      </MemoryRouter>
    );

    expect(screen.getByText("admin@192.168.1.50")).toBeInTheDocument();
  });

  it("renders dash when server has no access host, username, or ip", () => {
    const emptyServer: Server = {
      ...BASE_SERVER,
      username: null,
      ip_address: null,
      access_method: null,
      access_host: "",
      access_port: null,
    };

    render(
      <MemoryRouter>
        <ServerTable servers={[emptyServer]} />
      </MemoryRouter>
    );

    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("renders encrypted password when expanded, and toggles plaintext", () => {
    const serverWithCreds: Server = {
      ...BASE_SERVER,
      username: "root",
      password: "secretPassword123",
      encrypted_password: "enc_9f8a7b6c5d4e3f21",
    };

    render(
      <MemoryRouter>
        <ServerTable servers={[serverWithCreds]} />
      </MemoryRouter>
    );

    // Initially collapsed
    expect(screen.queryByText("Password:")).not.toBeInTheDocument();

    // Click Show button
    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    // Now hash password should be visible (username should not be displayed in credentials drawer)
    expect(screen.queryByText("Username:")).not.toBeInTheDocument();
    expect(screen.getByText("Password:")).toBeInTheDocument();
    expect(screen.getByText("enc_9f8a7b6c5d4e3f21")).toBeInTheDocument();
    expect(screen.queryByText("secretPassword123")).not.toBeInTheDocument();

    // CopyButton should be present
    expect(screen.getByRole("button", { name: /copy password/i })).toBeInTheDocument();

    // Toggle Eye to show plaintext
    fireEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(screen.getByText("secretPassword123")).toBeInTheDocument();
    expect(screen.queryByText("enc_9f8a7b6c5d4e3f21")).not.toBeInTheDocument();
  });

  it("logs reveal_password and copy_password when viewing or copying password from the drawer", async () => {
    const serverWithCreds: Server = {
      ...BASE_SERVER,
      password: "secretPassword123",
      encrypted_password: "enc_9f8a7b6c5d4e3f21",
    };

    render(
      <MemoryRouter>
        <ServerTable servers={[serverWithCreds]} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    // Click copy password
    const copyBtn = screen.getByRole("button", { name: /copy password/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith("/servers/s1/access-log", {
        action_type: "copy_password",
      });
    });

    // Click eye to reveal password
    const eyeBtn = screen.getByRole("button", { name: /show password/i });
    fireEvent.click(eyeBtn);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith("/servers/s1/access-log", {
        action_type: "reveal_password",
      });
    });
  });

  it("renders One-Click Remote Connection command and logs copy_ssh_command when copied", async () => {
    render(
      <MemoryRouter>
        <ServerTable servers={[BASE_SERVER]} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(screen.getByText("SSH:")).toBeInTheDocument();
    expect(screen.getByText("ssh root@10.0.0.1")).toBeInTheDocument();

    const copyBtn = screen.getByRole("button", { name: /copy ssh command/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith("/servers/s1/access-log", {
        action_type: "copy_ssh_command",
      });
    });
  });

  it("renders audit trail link pointing to /activity?entity_type=server&entity_id=:id", () => {
    const serverWithCreds: Server = {
      ...BASE_SERVER,
      password: "secretPassword123",
    };

    render(
      <MemoryRouter>
        <ServerTable servers={[serverWithCreds]} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(screen.getByText(/all password reveals and copies are recorded in audit logs/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /audit trail/i });
    expect(link).toHaveAttribute("href", "/activity?entity_type=server&entity_id=s1");
  });
});

