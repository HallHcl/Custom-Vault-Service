import { useMemo } from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileCode,
  FileText,
  HelpCircle,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ResourceListItem, ResourceType } from "@/hooks/useResources";
import { useProjects } from "@/hooks/useProjects";
import { DELETED_CARD_TEXT, DELETED_ROW_TEXT } from "@/test/deletedRow";

interface Props {
  resources: ResourceListItem[];
  selectedId?: string;
  onSelect: (resource: ResourceListItem) => void;
}

function getResourceIcon(type: ResourceType) {
  switch (type) {
    case "runbook":
      return <BookOpen className="h-4 w-4 text-brand shrink-0" />;
    case "sop":
      return <FileText className="h-4 w-4 text-emerald-500 shrink-0" />;
    case "architecture":
      return <Layers className="h-4 w-4 text-blue-500 shrink-0" />;
    case "troubleshooting":
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case "faq":
      return <HelpCircle className="h-4 w-4 text-purple-500 shrink-0" />;
    case "link":
      return <ExternalLink className="h-4 w-4 text-cyan-500 shrink-0" />;
    case "pdf":
      return <FileCode className="h-4 w-4 text-rose-500 shrink-0" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

export function ResourceFileTable({ resources, selectedId, onSelect }: Props) {
  const { data: projects = [] } = useProjects();
  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-[40%]">Name</TableHead>
            <TableHead className="w-[15%]">Type</TableHead>
            <TableHead className="w-[20%]">Project</TableHead>
            <TableHead className="w-[10%]">Version</TableHead>
            <TableHead className="w-[15%] text-right">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((resource) => {
            const isDeleted = Boolean(resource.deleted_at);
            const isSelected = selectedId === resource.id;
            const project = resource.project_id ? projectById.get(resource.project_id) : undefined;
            const versionNum = resource.current_version?.version_number;

            return (
              <TableRow
                key={resource.id}
                onClick={() => onSelect(resource)}
                className={cn(
                  "group cursor-pointer transition-colors duration-150 hover:bg-muted/50",
                  isSelected && "bg-muted/60",
                  isDeleted && DELETED_ROW_TEXT
                )}
              >
                <TableCell className="font-medium">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(resource);
                    }}
                    className={cn(
                      "flex items-center gap-2.5 text-left w-full focus:outline-none",
                      isDeleted && DELETED_CARD_TEXT
                    )}
                  >
                    {getResourceIcon(resource.type)}
                    <span
                      className={cn(
                        "truncate font-medium text-sm text-foreground group-hover:text-brand",
                        isDeleted && "text-muted-foreground"
                      )}
                    >
                      {resource.title}
                    </span>
                    {isDeleted && (
                      <Badge variant="neutral" className="text-[10px] px-1.5 py-0 h-4">
                        Deleted
                      </Badge>
                    )}
                  </button>
                </TableCell>

                <TableCell>
                  <Badge variant="outline" className="font-normal text-xs">
                    {resource.type}
                  </Badge>
                </TableCell>

                <TableCell className="text-xs text-muted-foreground truncate">
                  {project?.name ?? "—"}
                </TableCell>

                <TableCell>
                  {versionNum !== undefined ? (
                    <Badge variant="secondary" className="font-mono text-[11px] px-1.5 py-0 h-5">
                      v{versionNum}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground font-mono">v1</span>
                  )}
                </TableCell>

                <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                  <div className="flex items-center justify-end gap-2">
                    <span>
                      {resource.updated_at
                        ? new Date(resource.updated_at).toLocaleDateString()
                        : "—"}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default ResourceFileTable;
