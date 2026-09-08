import { describe, it, expect } from "vitest";
import {
  parseTsv,
  isHeaderRow,
  detectColumnMappings,
  buildParsedServers,
} from "./excelParser";

describe("excelParser", () => {
  it("parses tab-separated text into rows and columns", () => {
    const raw = "web-01\t10.99.3.10\troot\nweb-02\t10.99.3.11\tadmin";
    const rows = parseTsv(raw);
    expect(rows).toEqual([
      ["web-01", "10.99.3.10", "root"],
      ["web-02", "10.99.3.11", "admin"],
    ]);
  });

  it("handles quoted cells with tabs or newlines", () => {
    const raw = 'web-01\t"cpu 4\tram 8"\troot';
    const rows = parseTsv(raw);
    expect(rows).toEqual([["web-01", "cpu 4\tram 8", "root"]]);
  });

  it("handles multiline cells created with Alt+Enter in Excel without breaking into multiple rows", () => {
    const raw =
      'zabbix-db\t10.99.3.241\t"CPU: 4 Memroy: 15 Disk: sda : 100G\nsdb : 300G"\troot\tsecret123\n' +
      'zabbix-proxy1\t10.99.3.242\t"CPU: 4 Memroy: 8 Disk: sda : 50G"\troot\tsecret123';
    const rows = parseTsv(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe("zabbix-db");
    expect(rows[0][1]).toBe("10.99.3.241");
    expect(rows[0][2]).toBe("CPU: 4 Memroy: 15 Disk: sda : 100G\nsdb : 300G");
    expect(rows[0][3]).toBe("root");
    expect(rows[0][4]).toBe("secret123");
    expect(rows[1][0]).toBe("zabbix-proxy1");
  });


  it("identifies header rows correctly", () => {
    expect(isHeaderRow(["Hostname", "IP Address", "Username", "Password", "Spec"])).toBe(true);
    expect(isHeaderRow(["web-01", "10.99.3.244", "root", "123456"])).toBe(false);
  });

  it("detects column mappings with headers and gathers extra columns into notes", () => {
    const rows = [
      ["Hostname", "IP Address", "Username", "Password", "Spec", "OS"],
      ["web-01", "10.99.3.10", "root", "pass123", "cpu 4 ram 8 sda: 500G", "Ubuntu 22.04"],
      ["web-02", "10.99.3.11", "root", "pass123", "cpu 8 ram 16", "Debian 12"],
    ];

    const mappings = detectColumnMappings(rows, true);
    expect(mappings[0].type).toBe("hostname");
    expect(mappings[1].type).toBe("ip_address");
    expect(mappings[2].type).toBe("username");
    expect(mappings[3].type).toBe("password");
    expect(mappings[4].type).toBe("notes");
    expect(mappings[5].type).toBe("notes");

    const parsed = buildParsedServers(rows, mappings, true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].hostname).toBe("web-01");
    expect(parsed[0].ip_address).toBe("10.99.3.10");
    expect(parsed[0].username).toBe("root");
    expect(parsed[0].password).toBe("pass123");
    expect(parsed[0].notes).toBe("Spec: cpu 4 ram 8 sda: 500G\nOS: Ubuntu 22.04");
    expect(parsed[0].isValid).toBe(true);
  });

  it("detects column mappings without headers using IP and common usernames", () => {
    const rows = [
      ["srv-app-01", "192.168.1.50", "ubuntu", "secret", "quad-core 16gb"],
      ["srv-app-02", "192.168.1.51", "ubuntu", "secret", "quad-core 16gb"],
    ];

    const mappings = detectColumnMappings(rows, false);
    expect(mappings.find((m) => m.type === "hostname")?.index).toBe(0);
    expect(mappings.find((m) => m.type === "ip_address")?.index).toBe(1);
    expect(mappings.find((m) => m.type === "username")?.index).toBe(2);

    const parsed = buildParsedServers(rows, mappings, false);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].hostname).toBe("srv-app-01");
    expect(parsed[0].ip_address).toBe("192.168.1.50");
    expect(parsed[0].username).toBe("ubuntu");
    expect(parsed[0].notes).toBe("secret\nquad-core 16gb");
    expect(parsed[0].isValid).toBe(true);
  });

  it("flags invalid rows when hostname is missing", () => {
    const rows = [
      ["Hostname", "IP Address"],
      ["", "10.0.0.1"],
    ];
    const mappings = detectColumnMappings(rows, true);
    const parsed = buildParsedServers(rows, mappings, true);

    expect(parsed[0].isValid).toBe(false);
    expect(parsed[0].errors).toContain("Missing hostname");
  });
});
