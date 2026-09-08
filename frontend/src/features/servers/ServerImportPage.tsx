import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  HelpCircle,
  Loader2,
  RefreshCw,
  Table as TableIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { OptionalLabel } from "@/components/ui/optional-label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProjectPicker } from "@/components/ProjectPicker";
import { EnvironmentPicker } from "@/components/EnvironmentPicker";
import { ServiceTypeCombobox, COMMON_SERVICE_TYPES } from "@/components/ServiceTypeCombobox";
import { HOME_SEGMENT, useBreadcrumbs } from "@/components/layout/BreadcrumbsContext";
import { toast } from "@/hooks/use-toast";
import { useProjects } from "@/hooks/useProjects";
import { useEnvironments } from "@/hooks/useEnvironments";
import { useCreateServer, useServiceTypes } from "@/hooks/useServers";
import {
  parseTsv,
  isHeaderRow,
  detectColumnMappings,
  buildParsedServers,
  type ColumnMapping,
  type ParsedServerRow,
  type ServerColumnType,
} from "./utils/excelParser";

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

const SAMPLE_TSV = `Hostname\tIP Address\tConnection\tService\tUsername\tPassword\tNotes
app-prod-01\t192.168.1.10\tSSH\tApplication\tubuntu\tsecret123\tMain backend node
db-prod-01\t192.168.1.20\tSSH\tDatabase\tpostgres\tdbpass456\tPrimary PostgreSQL
win-rdp-01\t192.168.1.30\tRDP\tWeb\tAdministrator\tWinP@ss!\tIIS Web server`;

interface RowOverride {
  service_type?: string;
  access_method?: "ssh" | "rdp" | "telnet" | "web" | "other" | "none";
}

export default function ServerImportPage() {
  useBreadcrumbs([
    HOME_SEGMENT,
    { label: "Servers", href: "/servers" },
    { label: "Import servers" },
  ]);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialProjectId = searchParams.get("project_id") ?? undefined;
  const initialEnvId = searchParams.get("environment_id") ?? undefined;

  const { data: projects = [] } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(initialProjectId);
  const { data: environments = [] } = useEnvironments(selectedProjectId);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | undefined>(initialEnvId);

  const [rawText, setRawText] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [defaultServiceType, setDefaultServiceType] = useState<string | undefined>(undefined);
  const [defaultAccessMethod, setDefaultAccessMethod] = useState<
    "ssh" | "rdp" | "telnet" | "web" | "other" | undefined
  >("ssh");

  const [rowOverrides, setRowOverrides] = useState<Record<number, RowOverride>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const { data: serviceTypesList = [] } = useServiceTypes();
  const createServer = useCreateServer();

  // Pre-select project and environment
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (environments.length > 0) {
      if (initialEnvId && environments.some((e) => e.id === initialEnvId)) {
        setSelectedEnvironmentId(initialEnvId);
      } else if (!selectedEnvironmentId || !environments.some((e) => e.id === selectedEnvironmentId)) {
        setSelectedEnvironmentId(environments[0].id);
      }
    } else {
      setSelectedEnvironmentId(undefined);
    }
  }, [environments, initialEnvId, selectedEnvironmentId]);

  // Parse raw text into rows
  const parsedRows = useMemo(() => parseTsv(rawText), [rawText]);

  // When parsedRows changes significantly, detect headers and initial mappings
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

  const serverPreviews = useMemo(() => {
    if (parsedRows.length === 0 || mappings.length === 0) return [];
    return buildParsedServers(
      parsedRows,
      mappings,
      hasHeader,
      defaultServiceType,
      defaultAccessMethod
    );
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

  function handleLoadSample() {
    setRawText(SAMPLE_TSV);
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
      navigate("/servers");
    } else {
      toast({
        title: "Import failed",
        description: errors.slice(0, 3).join("\n"),
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/servers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to servers
      </Link>

      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1 className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Import servers from Excel
            </h1>
          </CardTitle>
          <CardDescription>
            Copy server rows from Excel or Google Sheets and paste below to batch-import servers into an environment.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Section 1: Target Destination */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              1. Target Destination
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="project">Project</Label>
                <ProjectPicker
                  id="project"
                  value={selectedProjectId}
                  onChange={(v) => {
                    setSelectedProjectId(v);
                    setSelectedEnvironmentId(undefined);
                  }}
                  placeholder="Select a project"
                  disabled={isImporting}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="environment">Environment *</Label>
                <EnvironmentPicker
                  id="environment"
                  value={selectedEnvironmentId}
                  onChange={setSelectedEnvironmentId}
                  projectId={selectedProjectId}
                  placeholder={selectedProjectId ? "Select an environment" : "Select a project first"}
                  disabled={isImporting || !selectedProjectId}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Batch Defaults */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              2. Batch Defaults
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="default-service-type">
                  Default Service Type <OptionalLabel />
                </Label>
                <ServiceTypeCombobox
                  id="default-service-type"
                  value={defaultServiceType}
                  onChange={setDefaultServiceType}
                  placeholder="e.g. Application, Database..."
                  disabled={isImporting}
                />
                <p className="text-xs text-muted-foreground">
                  Applied to servers that don't have a specific service type column or value.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="default-connection">
                  Default Connection <OptionalLabel />
                </Label>
                <Select
                  value={defaultAccessMethod ?? "none"}
                  onValueChange={(v) =>
                    setDefaultAccessMethod(v === "none" ? undefined : (v as typeof defaultAccessMethod))
                  }
                  disabled={isImporting}
                >
                  <SelectTrigger id="default-connection">
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
                <p className="text-xs text-muted-foreground">
                  Default protocol if not provided in the spreadsheet data.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Paste Data Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="paste-input"
                className="text-sm font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer"
              >
                3. Paste Spreadsheet Data (TSV)
              </Label>
              <div className="flex items-center gap-2">
                {!rawText && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleLoadSample}
                    disabled={isImporting}
                  >
                    Load sample data
                  </Button>
                )}
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
                    Clear data
                  </Button>
                )}
              </div>
            </div>

            <Textarea
              id="paste-input"
              aria-label="Paste Excel rows here"
              rows={5}
              placeholder={`Paste your Excel rows here (Ctrl + V)... Example:\nHostname\tIP Address\tConnection\tService\tUsername\tPassword\tNotes\nsrv-db-01\t10.99.3.244\tSSH\tDatabase\troot\tsecret123\tcpu 4 ram 8 sda: 500G\nsrv-web-01\t10.99.3.245\tSSH\tWeb\tadmin\tsecret123\tcpu 2 ram 4`}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              disabled={isImporting}
              className="font-mono text-xs whitespace-pre"
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              Tip: Select rows and columns directly in Excel or Google Sheets, copy them (Ctrl+C), and paste here.
            </p>
          </div>

          {/* Section 4: Column Mapping (Visible when data pasted) */}
          {mappings.length > 0 && (
            <div className="space-y-3 bg-muted/20 p-4 rounded-lg border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  4. Column Mapping & Headers
                </h2>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
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

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {mappings.map((m) => (
                  <div key={m.index} className="bg-background p-2.5 rounded border shadow-sm space-y-1.5">
                    <div className="text-xs font-medium truncate" title={m.headerName}>
                      {m.headerName}
                    </div>
                    <Select
                      value={m.type}
                      onValueChange={(val) => handleColumnTypeChange(m.index, val as ServerColumnType)}
                      disabled={isImporting}
                    >
                      <SelectTrigger className="h-8 text-xs" aria-label={`Mapping for ${m.headerName}`}>
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

          {/* Section 5: Data Preview Table */}
          {serverPreviews.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TableIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">
                    {`Preview (${serverPreviews.length} servers detected)`}
                  </span>
                  {invalidCount > 0 ? (
                    <Badge variant="destructive" className="text-xs">
                      {invalidCount} incomplete
                    </Badge>
                  ) : (
                    <Badge variant="default" className="text-xs bg-emerald-600 hover:bg-emerald-700">
                      All valid
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Ready to import: <span className="font-semibold text-foreground">{validServers.length}</span> / {serverPreviews.length}
                </div>
              </div>

              <div className="rounded-md border overflow-x-auto max-h-[480px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead>Hostname</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Credentials</TableHead>
                      <TableHead className="min-w-[150px]">Service Type</TableHead>
                      <TableHead className="min-w-[120px]">Connection</TableHead>
                      <TableHead className="min-w-[200px]">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serverPreviews.map((row) => {
                      const effType = getEffectiveServiceType(row);
                      const effConn = getEffectiveAccessMethod(row);

                      return (
                        <TableRow
                          key={row.index}
                          className={!row.isValid ? "bg-destructive/5" : undefined}
                        >
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">
                            {row.index + 1}
                          </TableCell>
                          <TableCell>
                            {row.isValid ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 flex items-center gap-1 w-fit"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Valid
                              </Badge>
                            ) : (
                              <Badge
                                variant="destructive"
                                className="text-[10px] flex items-center gap-1 w-fit"
                                title={row.errors.join(", ")}
                              >
                                <AlertCircle className="h-3 w-3" />
                                {row.errors[0] || "Invalid"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-xs">
                            {row.hostname ? (
                              row.hostname
                            ) : (
                              <span className="text-destructive italic">Missing Hostname</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {row.ip_address || "—"}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {row.username ? (
                              <span>
                                {row.username}
                                {row.password && " : ••••"}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="p-1 min-w-[160px]">
                            <ServiceTypeCombobox
                              value={effType || undefined}
                              onChange={(val) => {
                                setRowOverrides((prev) => ({
                                  ...prev,
                                  [row.index]: {
                                    ...prev[row.index],
                                    service_type: val ?? "",
                                  },
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
                                className="h-8 text-xs px-2 py-1"
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
                          <TableCell
                            className="text-xs max-w-[220px] truncate text-muted-foreground font-mono"
                            title={row.notes}
                          >
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
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t p-6">
          <Button variant="outline" asChild disabled={isImporting}>
            <Link to="/servers">Cancel</Link>
          </Button>

          <div className="flex items-center gap-3">
            {progress && (
              <span className="text-xs text-muted-foreground">
                Importing {progress.current} of {progress.total}...
              </span>
            )}
            <Button
              onClick={handleImport}
              disabled={isImporting || validServers.length === 0 || !selectedEnvironmentId}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${validServers.length} server${validServers.length === 1 ? "" : "s"}`
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
