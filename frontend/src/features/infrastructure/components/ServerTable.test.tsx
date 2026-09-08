import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ServerTable from "./ServerTable";
import type { Server } from "@/types";

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
});
