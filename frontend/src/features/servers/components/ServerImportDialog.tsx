import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useProjects } from "@/hooks/useProjects";
import { useEnvironments } from "@/hooks/useEnvironments";
import { useCreateServer, useServiceTypes } from "@/hooks/useServers";
import { ServiceTypeCombobox, COMMON_SERVICE_TYPES } from "@/components/ServiceTypeCombobox";
import {
  parseTsv,
  isHeaderRow,
  detectColumnMappings,
  buildParsedServers,
  type ColumnMapping,
  type ParsedServerRow,
  type ServerColumnType,
} from "../utils/excelParser";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEnvironmentId?: string;
  onSuccess?: () => void;
}

const COLUMN_OPTIONS: { value: ServerColumnType; label: string }[] = [
  { value: "hostname", label: "Hostname" },
  { value: "ip_address", label: "IP Address" },
  { value: "username", label: "Username" },
  { value: "password", label: "Password" },
  { value: "service_type", label: "Service Type" },
  { value: "access_method", label: "Connection (SSH/RDP...)" },
  { value: "notes", label: "Include in Notes" },
  { value: "ignore", label: "Ignore" },
];

export function ServerImportDialog({
  open,
  onOpenChange,
  initialEnvironmentId,
  onSuccess,
}: Props) {
  const { data: projects = [] } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const { data: environments = [] } = useEnvironments(selectedProjectId || undefined);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>("");

  const [rawText, setRawText] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [defaultServiceType, setDefaultServiceType] = useState<string | undefined>(undefined);
  const [defaultAccessMethod, setDefaultAccessMethod] = useState<"ssh" | "rdp" | "telnet" | "web" | "other" | undefined>("ssh");

  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const { data: serviceTypesList = [] } = useServiceTypes();

  interface RowOverride {
    service_type?: string;
    access_method?: "ssh" | "rdp" | "telnet" | "web" | "other" | "none";
  }

  const [rowOverrides, setRowOverrides] = useState<Record<number, RowOverride>>({});

  const createServer = useCreateServer();

  // Pre-select project and environment
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (environments.length > 0) {
      if (initialEnvironmentId && environments.some((e) => e.id === initialEnvironmentId)) {
        setSelectedEnvironmentId(initialEnvironmentId);
      } else if (!selectedEnvironmentId || !environments.some((e) => e.id === selectedEnvironmentId)) {
        setSelectedEnvironmentId(environments[0].id);
      }
    } else {
      setSelectedEnvironmentId("");
    }
  }, [environments, initialEnvironmentId, selectedEnvironmentId]);

  // Parse raw text into rows
  const parsedRows = useMemo(() => parseTsv(rawText), [rawText]);

  // Whenever parsedRows or rawText changes significantly, re-detect headers and initial mappings
  useEffect(() => {
    if (parsedRows.length === 0) {
      setMappings([]);
      setRowOverrides({});
      return;
    }
    const detectedHeader = isHeaderRow(parsedRows[0]);
    setHasHeader(detectedHeader);
    const initialMappings = detectColumnMappings(parsedRows, detectedHeader);
    setMappings(initialMappings);
  }, [parsedRows]);

  // Handle manual toggle of "First row is header"
  function handleHeaderToggle(newHasHeader: boolean) {
    setHasHeader(newHasHeader);
    if (parsedRows.length > 0) {
      setMappings(detectColumnMappings(parsedRows, newHasHeader));
    }
  }

  function handleColumnTypeChange(index: number, newType: ServerColumnType) {
    setMappings((prev) =>
      prev.map((m) => (m.index === index ? { ...m, type: newType } : m))
    );
  }

  // Build the live preview of server records
  const serverPreviews = useMemo(() => {
    if (parsedRows.length === 0 || mappings.length === 0) return [];
    return buildParsedServers(parsedRows, mappings, hasHeader, defaultServiceType, defaultAccessMethod);
  }, [parsedRows, mappings, hasHeader, defaultServiceType, defaultAccessMethod]);

  function getEffectiveServiceType(row: ParsedServerRow): string {
    const override = rowOverrides[row.index];
    if (override?.service_type !== undefined) {
      return override.service_type;
    }
    return row.service_type || defaultServiceType || "";
  }

  function getEffectiveAccessMethod(
    row: ParsedServerRow
  ): "ssh" | "rdp" | "telnet" | "web" | "other" | undefined {
    const override = rowOverrides[row.index];
    if (override?.access_method !== undefined) {
      return override.access_method === "none" ? undefined : override.access_method;
    }
    return row.access_method ?? defaultAccessMethod;
  }

  // Dynamic service types list combining database records, presets, and any custom values entered in the table
  const dynamicServiceTypes = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(serviceTypesList)) {
      serviceTypesList.forEach((t) => set.add(t));
    }
    COMMON_SERVICE_TYPES.forEach((t) => set.add(t));
    if (defaultServiceType?.trim()) {
      set.add(defaultServiceType.trim());
    }
    Object.values(rowOverrides).forEach((o) => {
      if (o.service_type?.trim()) {
        set.add(o.service_type.trim());
      }
    });
    serverPreviews.forEach((s) => {
      if (s.service_type?.trim()) {
        set.add(s.service_type.trim());
      }
    });
    return Array.from(set);
  }, [serviceTypesList, defaultServiceType, rowOverrides, serverPreviews]);

  const validServers = useMemo(
    () => serverPreviews.filter((s) => s.isValid),
    [serverPreviews]
  );
  const invalidCount = serverPreviews.length - validServers.length;

  function handleReset() {
    setRawText("");
    setMappings([]);
    setRowOverrides({});
    setProgress(null);
    setIsImporting(false);
  }

  async function handleImport() {
    if (!selectedEnvironmentId) {
      toast({
        title: "Environment required",
        description: "Please select a target environment for the servers.",
        variant: "destructive",
      });
      return;
    }

    if (validServers.length === 0) {
      toast({
        title: "No valid servers",
        description: "No servers ready to import. Make sure each server has a Hostname.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < validServers.length; i++) {
      const row = validServers[i];
      const effServiceType = getEffectiveServiceType(row).trim() || undefined;
      const effAccessMethod = getEffectiveAccessMethod(row);
      setProgress({ current: i + 1, total: validServers.length });

      try {
        await createServer.mutateAsync({
          environment_id: selectedEnvironmentId,
          display_name: row.hostname,
          hostname: row.hostname,
          ip_address: row.ip_address,
          username: row.username,
          password: row.password,
          service_type: effServiceType,
          access_method: effAccessMethod,
          notes: row.notes,
        });
        successCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create";
        errors.push(`${row.hostname}: ${msg}`);
      }
    }

    setIsImporting(false);
    setProgress(null);

    if (successCount > 0) {
      toast({
        title: "Import complete",
        description: `Successfully imported ${successCount} servers${
          errors.length > 0 ? ` (${errors.length} failed)` : ""
        }.`,
        variant: errors.length > 0 ? "destructive" : "default",
      });
      onSuccess?.();
      handleReset();
      onOpenChange(false);
    } else {
      toast({
        title: "Import failed",
        description: errors.slice(0, 3).join("\n"),
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !isImporting && onOpenChange(v)}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import servers from Excel / Spreadsheet
          </DialogTitle>
          <DialogDescription>
            Copy server rows from Excel or Google Sheets and paste below. The system will
            automatically map Hostname, IP, Username, Password, and package any extra columns into Notes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-1">
          {/* Environment and Defaults Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-lg border">
            <div>
              <Label className="text-xs font-medium">Target Project</Label>
              <Select
                value={selectedProjectId}
                onValueChange={(val) => {
                  setSelectedProjectId(val);
                }}
                disabled={isImporting}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium">Target Environment *</Label>
              <Select
                value={selectedEnvironmentId}
                onValueChange={setSelectedEnvironmentId}
                disabled={isImporting || environments.length === 0}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder={environments.length === 0 ? "No environments" : "Select environment"} />
                </SelectTrigger>
                <SelectContent>
                  {environments.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium">Default Service Type</Label>
              <div className="mt-1">
                <ServiceTypeCombobox
                  value={defaultServiceType}
                  onChange={setDefaultServiceType}
                  placeholder="Optional default"
                  disabled={isImporting}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Default Connection</Label>
              <Select
                value={defaultAccessMethod ?? "none"}
                onValueChange={(v) =>
                  setDefaultAccessMethod(v === "none" ? undefined : (v as typeof defaultAccessMethod))
                }
                disabled={isImporting}
              >
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="Connection type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ssh">SSH</SelectItem>
                  <SelectItem value="rdp">RDP</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="telnet">Telnet</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="none">None (Unspecified)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Paste Input Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="paste-input" className="text-sm font-medium">
                Paste Excel data (TSV)
              </Label>
              {rawText && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={handleReset}
                  disabled={isImporting}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <Textarea
              id="paste-input"
              rows={4}
              placeholder={`Paste your Excel rows here (Ctrl + V)... Example:\nHostname\tIP Address\tUsername\tPassword\tSpec\nsrv-db-01\t10.99.3.244\troot\tsecret123\tcpu 4 ram 8 sda: 500G\nsrv-web-01\t10.99.3.245\tadmin\tsecret123\tcpu 2 ram 4`}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              disabled={isImporting}
              className="font-mono text-xs whitespace-pre"
            />
          </div>

          {/* Column Mapping Section (Only visible when data is pasted) */}
          {mappings.length > 0 && (
            <div className="space-y-2 bg-muted/20 p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Detected Columns & Mapping
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasHeader}
                    onChange={(e) => handleHeaderToggle(e.target.checked)}
                    disabled={isImporting}
                    className="rounded border-gray-300"
                  />
                  First row contains column headers
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {mappings.map((m) => (
                  <div key={m.index} className="bg-background p-2 rounded border shadow-sm">
                    <div className="text-xs font-medium truncate mb-1" title={m.headerName}>
                      {m.headerName}
                    </div>
                    <Select
                      value={m.type}
                      onValueChange={(val) => handleColumnTypeChange(m.index, val as ServerColumnType)}
                      disabled={isImporting}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview Table */}
          {serverPreviews.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="text-sm font-medium flex items-center gap-2">
                  <span>Preview ({serverPreviews.length} servers detected)</span>
                  {invalidCount > 0 ? (
                    <Badge variant="destructive" className="text-xs">
                      {invalidCount} incomplete
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-success-text border-success-border">
                      <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                      All valid
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  💡 พิมพ์ชื่อ Service Type (เช่น Zabbix) ได้ทันที หรือคลิกลูกศรเพื่อเลือก | ระบบจะบันทึกให้อัตโนมัติเมื่อกด Import
                </span>
              </div>

              <div className="border rounded-md max-h-60 overflow-y-auto overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 text-center">#</TableHead>
                      <TableHead className="min-w-[120px]">Hostname</TableHead>
                      <TableHead className="min-w-[105px]">IP Address</TableHead>
                      <TableHead className="min-w-[90px]">Username</TableHead>
                      <TableHead className="min-w-[75px]">Password</TableHead>
                      <TableHead className="min-w-[145px]">Service Type</TableHead>
                      <TableHead className="min-w-[110px]">Connection</TableHead>
                      <TableHead className="min-w-[150px]">Notes (Aggregated)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serverPreviews.map((row) => {
                      const effService = getEffectiveServiceType(row);
                      const effConn = getEffectiveAccessMethod(row);
                      return (
                        <TableRow key={row.index} className={!row.isValid ? "bg-destructive/10" : undefined}>
                          <TableCell className="text-xs text-muted-foreground font-mono text-center">
                            {row.index}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {row.hostname ? (
                              row.hostname
                            ) : (
                              <span className="text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Missing
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{row.ip_address || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{row.username || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">
                            {row.password ? "••••••" : "—"}
                          </TableCell>
                          <TableCell className="p-1 min-w-[150px]">
                            <ServiceTypeCombobox
                              value={effService || undefined}
                              onChange={(val) => {
                                setRowOverrides((prev) => ({
                                  ...prev,
                                  [row.index]: { ...prev[row.index], service_type: val ?? "" },
                                }));
                              }}
                              placeholder="Select or type..."
                              disabled={isImporting}
                              aria-label={`Service type for ${row.hostname || `server ${row.index}`}`}
                              className="h-8 text-xs px-2 py-1"
                              extraOptions={dynamicServiceTypes}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Select
                              value={effConn ?? "none"}
                              onValueChange={(v) => {
                                setRowOverrides((prev) => ({
                                  ...prev,
                                  [row.index]: {
                                    ...prev[row.index],
                                    access_method: v as "ssh" | "rdp" | "telnet" | "web" | "other" | "none",
                                  },
                                }));
                              }}
                              disabled={isImporting}
                            >
                              <SelectTrigger
                                className="h-7 text-xs px-2 py-1"
                                aria-label={`Connection for ${row.hostname || `server ${row.index}`}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ssh" className="text-xs">SSH</SelectItem>
                                <SelectItem value="rdp" className="text-xs">RDP</SelectItem>
                                <SelectItem value="web" className="text-xs">Web</SelectItem>
                                <SelectItem value="telnet" className="text-xs">Telnet</SelectItem>
                                <SelectItem value="other" className="text-xs">Other</SelectItem>
                                <SelectItem value="none" className="text-xs text-muted-foreground">None</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground font-mono" title={row.notes}>
                            {row.notes || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Progress Bar while importing */}
          {isImporting && progress && (
            <div className="bg-muted p-3 rounded-lg border space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Importing servers...
                </span>
                <span>
                  {progress.current} of {progress.total}
                </span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-200"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 pt-3 border-t flex flex-row items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {validServers.length > 0 && (
              <span>
                Ready to import: <strong>{validServers.length}</strong> servers
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={isImporting || !selectedEnvironmentId || validServers.length === 0}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing ({progress?.current ?? 0}/{progress?.total ?? validServers.length})...
                </>
              ) : (
                <>Import {validServers.length > 0 ? `${validServers.length} ` : ""}servers</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
