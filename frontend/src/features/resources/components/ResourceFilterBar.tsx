import { FilterBar } from "@/components/FilterBar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectPicker } from "@/components/ProjectPicker";
import { ResourceTypeCombobox } from "./ResourceTypeCombobox";
import type { DeletedFilter, SortOrder } from "@/hooks/usePagination";

interface Props {
  search: string;
  onSearchChange: (search: string) => void;
  type: string | undefined;
  onTypeChange: (type: string | undefined) => void;
  projectId: string | undefined;
  onProjectIdChange: (projectId: string | undefined) => void;
  sort: string | undefined;
  onSortChange: (sort: string | undefined) => void;
  sortOptions: { value: string; label: string }[];
  order: SortOrder | undefined;
  onOrderChange: (order: SortOrder | undefined) => void;
  deleted?: DeletedFilter;
  onDeletedChange?: (deleted: DeletedFilter) => void;
}

export default function ResourceFilterBar({
  search,
  onSearchChange,
  type,
  onTypeChange,
  projectId,
  onProjectIdChange,
  sort,
  onSortChange,
  sortOptions,
  order,
  onOrderChange,
}: Props) {
  return (
    <FilterBar>
      <Input
        placeholder="Search resources..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-56"
      />

      <ResourceTypeCombobox
        value={type}
        onChange={onTypeChange}
        className="w-40"
      />

      <ProjectPicker
        value={projectId}
        onChange={onProjectIdChange}
        includeAllOption
        allOptionLabel="All projects"
        placeholder="Project"
        className="w-48"
        aria-label="Project"
      />

      <Select value={sort} onValueChange={onSortChange}>
        <SelectTrigger className="w-40" aria-label="Sort by">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={order} onValueChange={(v) => onOrderChange(v as SortOrder)}>
        <SelectTrigger className="w-32" aria-label="Sort order">
          <SelectValue placeholder="Order" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="asc">Ascending</SelectItem>
          <SelectItem value="desc">Descending</SelectItem>
        </SelectContent>
      </Select>
    </FilterBar>
  );
}
