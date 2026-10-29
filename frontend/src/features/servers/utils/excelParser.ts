/**
 * Utility for parsing and auto-detecting server data copied from Excel or spreadsheets.
 * Excel copies tabular data as Tab-Separated Values (TSV).
 */

export type ServerColumnType =
  | "hostname"
  | "display_name"
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
  display_name?: string;
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

// Strict common usernames (avoiding ambiguous tokens like "app", "user", "zone")
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
 * Checks if a given row appears to be a header row.
 */
export function isHeaderRow(row: string[]): boolean {
  if (!row || row.length === 0) return false;

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
    "memory",
    "disk",
    "type",
    "service",
    "service_type",
    "note",
    "notes",
    "desc",
    "description",
    "remark",
    "location",
    "vlan",
    "zone",
    "subnet",
    "gateway",
    "vfw",
    "network",
    "system",
  ];

  let matches = 0;
  for (const cell of row) {
    const lower = cell.toLowerCase().trim();
    if (headerKeywords.some((kw) => lower === kw || lower.includes(kw))) {
      matches++;
    }
  }

  const hasIp = row.some((cell) => IPV4_REGEX.test(cell.trim()));
  return matches >= 1 && !hasIp;
}

/**
 * Detects if the table has 0, 1, or 2 header rows.
 * Real-world Excel sheets often feature a 2-level header (e.g. Row 1: "Network", Row 2: "IP Address", "VLAN", "ZONE").
 */
export function detectHeaderRowCount(rows: string[][]): 0 | 1 | 2 {
  if (rows.length === 0) return 0;
  if (!isHeaderRow(rows[0])) return 0;

  if (rows.length >= 2) {
    const row2 = rows[1];
    // If row 2 contains any valid IP address, it cannot be a header
    const hasIpInRow2 = row2.some((c) => IPV4_REGEX.test(c.trim()));
    if (!hasIpInRow2) {
      const subHeaderKeywords = [
        "vlan",
        "ip",
        "ip address",
        "subnet",
        "gateway",
        "port",
        "service",
        "service / port",
        "vfw",
        "zone",
        "net",
        "network",
        "interface",
        "mac",
        "mask",
        "cidr",
        "broadcast",
      ];
      let subMatches = 0;
      for (const cell of row2) {
        const lower = cell.toLowerCase().trim();
        if (subHeaderKeywords.some((kw) => lower === kw || lower.includes(kw))) {
          subMatches++;
        }
      }
      // If row 2 matches sub-header keywords, it's a 2-row header
      if (subMatches >= 2 || (subMatches >= 1 && row2.filter(Boolean).length <= 10)) {
        return 2;
      }
    }
  }

  return 1;
}

/**
 * Combines header rows (if 2 rows) and returns clean unified column headers and remaining data rows.
 */
export function extractHeadersAndData(
  rows: string[][],
  headerCount: number | boolean
): { headers: string[]; dataRows: string[][] } {
  const count = typeof headerCount === "boolean" ? (headerCount ? 1 : 0) : headerCount;

  if (count === 0 || rows.length === 0) {
    return { headers: [], dataRows: rows };
  }

  if (count === 1) {
    return { headers: rows[0], dataRows: rows.slice(1) };
  }

  // 2 header rows
  const row1 = rows[0] || [];
  const row2 = rows[1] || [];
  const colCount = Math.max(row1.length, row2.length);
  const combinedHeaders: string[] = [];

  let currentCategory = "";
  for (let c = 0; c < colCount; c++) {
    const top = (row1[c] ?? "").trim();
    const sub = (row2[c] ?? "").trim();

    if (top) {
      currentCategory = top;
    }

    if (top && sub) {
      combinedHeaders.push(`${top} - ${sub}`);
    } else if (sub) {
      // If there's an ongoing merged category from row 1, prefix it unless already contained
      if (currentCategory && !sub.toLowerCase().includes(currentCategory.toLowerCase())) {
        combinedHeaders.push(`${currentCategory} - ${sub}`);
      } else {
        combinedHeaders.push(sub);
      }
    } else if (top) {
      combinedHeaders.push(top);
    } else {
      combinedHeaders.push(`Column ${c + 1}`);
    }
  }

  return { headers: combinedHeaders, dataRows: rows.slice(2) };
}

/**
 * Automatically detects column types based on headers and sample values.
 * Differentiates Hostname (zbapp101) vs Display Name / Server Name (Server Zabbix),
 * and handles multi-row combined headers cleanly.
 */
export function detectColumnMappings(
  rows: string[][],
  hasHeader: boolean | number
): ColumnMapping[] {
  if (rows.length === 0) return [];

  const headerCount =
    typeof hasHeader === "number"
      ? hasHeader
      : hasHeader
      ? detectHeaderRowCount(rows) || 1
      : 0;

  const { headers, dataRows } = extractHeadersAndData(rows, headerCount);
  const colCount = Math.max(
    headers.length,
    ...rows.map((r) => r.length)
  );

  const assignedTypes = new Set<ServerColumnType>();
  const mappings: ColumnMapping[] = [];

  for (let c = 0; c < colCount; c++) {
    const header = (headers[c] ?? "").trim();
    const hLower = header.toLowerCase();
    let detectedType: ServerColumnType = "notes";

    if (headerCount > 0 && header) {
      // 1. Host Name (Exact or strong match for hostname/FQDN)
      if (/^(host[-_\s]?name|host|ชื่อเครื่อง|fqdn)$/i.test(hLower)) {
        if (!assignedTypes.has("hostname")) {
          detectedType = "hostname";
        }
      }
      // 2. Display Name / Server Name / Description
      else if (/^(server[-_\s]?name|display[-_\s]?name|server[-_\s]?desc|description|รายละเอียด|ชื่อเซิร์ฟเวอร์|ชื่อเล่น)$/i.test(hLower)) {
        if (!assignedTypes.has("display_name")) {
          detectedType = "display_name";
        }
      }
      // 3. IP Address (can be "IP Address", "IP", or combined "Network - IP Address")
      else if (/(?:^|[-_\s])(ip|ip[-_\s]?address|address|ipaddr)(?:$|[-_\s])/i.test(hLower)) {
        if (!assignedTypes.has("ip_address")) {
          detectedType = "ip_address";
        }
      }
      // 4. Username / Login
      else if (/^(username|user|login|account|u\/n|ชื่อผู้ใช้)$/i.test(hLower)) {
        if (!assignedTypes.has("username")) {
          detectedType = "username";
        }
      }
      // 5. Password / Pwd
      else if (/^(password|pass|pwd|p\/w|รหัสผ่าน)$/i.test(hLower)) {
        if (!assignedTypes.has("password")) {
          detectedType = "password";
        }
      }
      // 6. Service Type / Service / Port
      else if (/^(service[-_\s]?type|service|type|ประเภท|service\s*\/\s*port)$/i.test(hLower)) {
        if (!assignedTypes.has("service_type")) {
          detectedType = "service_type";
        }
      }
      // 7. Access Method / Connection
      else if (/^(access[-_\s]?method|connection|conn|protocol|method|การเชื่อมต่อ)$/i.test(hLower)) {
        if (!assignedTypes.has("access_method")) {
          detectedType = "access_method";
        }
      }
      // 8. General fallback for Server if neither hostname nor display_name assigned
      else if (/^(server)$/i.test(hLower)) {
        if (!assignedTypes.has("hostname")) {
          detectedType = "hostname";
        } else if (!assignedTypes.has("display_name")) {
          detectedType = "display_name";
        }
      } else {
        detectedType = "notes";
      }
    } else {
      // No headers: inspect column values across sample rows
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
    const candidate = mappings.find(
      (m) =>
        m.type !== "ip_address" &&
        m.type !== "username" &&
        m.type !== "password" &&
        m.type !== "access_method"
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
 * Transforms raw 2D rows into server payloads using defined column mappings.
 * - Supports forward-filling merged group cells (like "System")
 * - Distinguishes between hostname and display_name
 * - Formats extra hardware / network columns into cleanly formatted Notes
 * - Auto-detects access_method (e.g. Linux -> SSH, Windows -> RDP, Web ports -> Web)
 */
export function buildParsedServers(
  rows: string[][],
  mappings: ColumnMapping[],
  hasHeader: boolean | number,
  defaultServiceType?: string,
  defaultAccessMethod?: "ssh" | "rdp" | "telnet" | "web" | "other"
): ParsedServerRow[] {
  const headerCount =
    typeof hasHeader === "number"
      ? hasHeader
      : hasHeader
      ? detectHeaderRowCount(rows) || 1
      : 0;

  const { dataRows } = extractHeadersAndData(rows, headerCount);

  // Track previous values for forward-filling merged cells (e.g. System, Category)
  const lastFillValues: Record<number, string> = {};

  return dataRows.map((row, rowIdx) => {
    let hostname = "";
    let display_name: string | undefined;
    let ip_address: string | undefined;
    let username: string | undefined;
    let password: string | undefined;
    let service_type: string | undefined = defaultServiceType?.trim() || undefined;
    let access_method: "ssh" | "rdp" | "telnet" | "web" | "other" | undefined = defaultAccessMethod;
    const noteEntries: string[] = [];
    let detectedOS = "";

    mappings.forEach((m) => {
      let val = (row[m.index] ?? "").trim();
      const hLower = (m.headerName || "").toLowerCase();

      // Forward-fill merged cells for grouping headers like "System", "Group", "Category"
      if (/^(system|group|category|project|ระบบ)$/i.test(hLower)) {
        if (val) {
          lastFillValues[m.index] = val;
        } else if (lastFillValues[m.index]) {
          val = lastFillValues[m.index];
        }
      }

      if (!val) return;

      if (hLower.includes("os") || hLower.includes("operating system")) {
        detectedOS = val;
      }

      switch (m.type) {
        case "hostname":
          hostname = val;
          break;
        case "display_name":
          display_name = val;
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
        case "service_type": {
          service_type = val;
          const lower = val.toLowerCase();
          if (lower.includes("http") || lower.includes("nginx") || lower.includes("apache") || lower.includes("web")) {
            if (!defaultAccessMethod) access_method = "web";
          }
          break;
        }
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

    // Auto-infer access_method from OS if not explicitly set
    if (!access_method) {
      const osLower = detectedOS.toLowerCase();
      if (osLower.includes("windows")) {
        access_method = "rdp";
      } else if (
        osLower.includes("linux") ||
        osLower.includes("alma") ||
        osLower.includes("ubuntu") ||
        osLower.includes("centos") ||
        osLower.includes("debian")
      ) {
        access_method = "ssh";
      }
    }

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
      display_name: display_name || hostname,
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
