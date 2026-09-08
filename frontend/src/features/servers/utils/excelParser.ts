/**
 * Utility for parsing and auto-detecting server data copied from Excel or spreadsheets.
 * Excel copies tabular data as Tab-Separated Values (TSV).
 */

export type ServerColumnType =
  | "hostname"
  | "ip_address"
  | "username"
  | "password"
  | "service_type"
  | "access_method"
  | "notes"
  | "ignore";

export interface ColumnMapping {
  index: number;
  headerName: string;
  type: ServerColumnType;
}

export interface ParsedServerRow {
  index: number;
  hostname: string;
  ip_address?: string;
  username?: string;
  password?: string;
  service_type?: string;
  access_method?: "ssh" | "rdp" | "telnet" | "web" | "other";
  notes?: string;
  rawColumns: string[];
  isValid: boolean;
  errors: string[];
}


const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

const COMMON_USERNAMES = new Set([
  "root",
  "admin",
  "administrator",
  "ubuntu",
  "debian",
  "centos",
  "ec2-user",
  "oracle",
  "postgres",
  "sa",
  "user",
  "app",
  "deploy",
]);

/**
 * Splits raw clipboard text from Excel (TSV) into 2D string array.
 * Robust parser that respects quotes across newlines (e.g. cells with Alt+Enter in Excel).
 */
export function parseTsv(text: string): string[][] {
  if (!text) return [];

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "\t" && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i++; // skip \n in CRLF
      }
      currentRow.push(currentCell.trim());
      // Only push non-empty rows
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += char;
    }
  }

  // Push last cell & row if any
  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}


/**
 * Checks if the first row appears to be a header row.
 */
export function isHeaderRow(firstRow: string[]): boolean {
  if (firstRow.length === 0) return false;

  const headerKeywords = [
    "host",
    "hostname",
    "server",
    "ip",
    "ip address",
    "ip_address",
    "address",
    "user",
    "username",
    "pass",
    "password",
    "pwd",
    "spec",
    "os",
    "cpu",
    "ram",
    "disk",
    "type",
    "service",
    "service_type",
    "note",
    "notes",
    "desc",
    "remark",
    "location",
  ];

  let matches = 0;
  for (const cell of firstRow) {
    const lower = cell.toLowerCase().trim();
    if (headerKeywords.some((kw) => lower === kw || lower.includes(kw))) {
      matches++;
    }
  }

  // If at least one keyword matches and no cell looks like an actual IP address
  const hasIpInFirstRow = firstRow.some((cell) => IPV4_REGEX.test(cell.trim()));
  return matches >= 1 && !hasIpInFirstRow;
}

/**
 * Automatically detects column types based on headers and sample values.
 */
export function detectColumnMappings(rows: string[][], hasHeader: boolean): ColumnMapping[] {
  if (rows.length === 0) return [];

  const colCount = Math.max(...rows.map((r) => r.length));
  const headers = hasHeader ? rows[0] : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const assignedTypes = new Set<ServerColumnType>();
  const mappings: ColumnMapping[] = [];

  for (let c = 0; c < colCount; c++) {
    const header = (headers[c] ?? "").trim();
    const hLower = header.toLowerCase();
    let detectedType: ServerColumnType = "notes";

    // 1. Try matching header name if available
    if (hasHeader && header) {
      if (/^(hostname|host|server|server[-_\s]?name|name|ชื่อเครื่อง)$/i.test(hLower)) {
        detectedType = "hostname";
      } else if (/^(ip|ip[-_\s]?address|address|ipaddr)$/i.test(hLower)) {
        detectedType = "ip_address";
      } else if (/^(username|user|login|account|u\/n|ชื่อผู้ใช้)$/i.test(hLower)) {
        detectedType = "username";
      } else if (/^(password|pass|pwd|p\/w|รหัสผ่าน)$/i.test(hLower)) {
        detectedType = "password";
      } else if (/^(service[-_\s]?type|service|type|ประเภท)$/i.test(hLower)) {
        detectedType = "service_type";
      } else if (/^(access[-_\s]?method|connection|conn|protocol|method|การเชื่อมต่อ)$/i.test(hLower)) {
        detectedType = "access_method";
      } else {
        // Any other column (e.g. Spec, OS, CPU, RAM, Remarks) defaults to notes
        detectedType = "notes";
      }
    } else {
      // 2. No headers: inspect column values across sample rows
      const values = dataRows.map((r) => (r[c] ?? "").trim()).filter(Boolean);

      const ipMatches = values.filter((v) => IPV4_REGEX.test(v)).length;
      const userMatches = values.filter((v) => COMMON_USERNAMES.has(v.toLowerCase())).length;

      if (ipMatches > 0 && ipMatches >= values.length * 0.5 && !assignedTypes.has("ip_address")) {
        detectedType = "ip_address";
      } else if (userMatches > 0 && userMatches >= values.length * 0.5 && !assignedTypes.has("username")) {
        detectedType = "username";
      } else if (!assignedTypes.has("hostname")) {
        detectedType = "hostname";
      } else {
        detectedType = "notes";
      }
    }

    if (detectedType !== "notes") {
      assignedTypes.add(detectedType);
    }

    mappings.push({
      index: c,
      headerName: header || `Column ${c + 1}`,
      type: detectedType,
    });
  }

  // Ensure at least one column is assigned to "hostname" if possible
  if (!mappings.some((m) => m.type === "hostname") && mappings.length > 0) {
    // Pick the first column that isn't IP, Username, or Password
    const candidate = mappings.find(
      (m) => m.type !== "ip_address" && m.type !== "username" && m.type !== "password" && m.type !== "access_method"
    );
    if (candidate) {
      candidate.type = "hostname";
    } else {
      mappings[0].type = "hostname";
    }
  }

  return mappings;
}

/**
 * Transforms raw 2D rows into server payloads using the defined column mappings.
 * Unmapped/extra columns marked as "notes" are bundled into the `notes` field.
 */
export function buildParsedServers(
  rows: string[][],
  mappings: ColumnMapping[],
  hasHeader: boolean,
  defaultServiceType?: string,
  defaultAccessMethod?: "ssh" | "rdp" | "telnet" | "web" | "other"
): ParsedServerRow[] {
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((row, rowIdx) => {
    let hostname = "";
    let ip_address: string | undefined;
    let username: string | undefined;
    let password: string | undefined;
    let service_type: string | undefined = defaultServiceType?.trim() || undefined;
    let access_method: "ssh" | "rdp" | "telnet" | "web" | "other" | undefined = defaultAccessMethod;
    const noteEntries: string[] = [];

    mappings.forEach((m) => {
      const val = (row[m.index] ?? "").trim();
      if (!val) return;

      switch (m.type) {
        case "hostname":
          hostname = val;
          break;
        case "ip_address":
          ip_address = val;
          break;
        case "username":
          username = val;
          break;
        case "password":
          password = val;
          break;
        case "service_type":
          service_type = val;
          break;
        case "access_method": {
          const lower = val.toLowerCase();
          if (lower.includes("ssh")) access_method = "ssh";
          else if (lower.includes("rdp") || lower.includes("remote")) access_method = "rdp";
          else if (lower.includes("telnet")) access_method = "telnet";
          else if (lower.includes("web") || lower.includes("http")) access_method = "web";
          else access_method = "other";
          break;
        }
        case "notes": {
          const prefix = m.headerName && !m.headerName.startsWith("Column ") ? `${m.headerName}: ` : "";
          noteEntries.push(`${prefix}${val}`);
          break;
        }
        case "ignore":
          break;
      }
    });

    const errors: string[] = [];
    if (!hostname) {
      errors.push("Missing hostname");
    }
    if (ip_address && !IPV4_REGEX.test(ip_address)) {
      errors.push("Invalid IP format");
    }

    return {
      index: rowIdx + 1,
      hostname,
      ip_address,
      username,
      password,
      service_type,
      access_method,
      notes: noteEntries.length > 0 ? noteEntries.join("\n") : undefined,
      rawColumns: row,
      isValid: errors.length === 0,
      errors,
    };
  });
}
