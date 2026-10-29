import * as React from "react";
import { Check, ChevronsUpDown, Filter, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
} from "@/lib/resourceTypes";
import { useResourceTypes } from "@/hooks/useResources";
import { formatTypeInput, capitalizeFirstLetter } from "@/lib/keyboardUtils";

export interface ResourceTypeComboboxProps {
  id?: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  popoverClassName?: string;
  extraOptions?: string[];
  mode?: "form" | "filter";
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export function ResourceTypeCombobox({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  popoverClassName,
  extraOptions,
  mode = "filter",
  "aria-label": ariaLabel = "Resource type",
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}: ResourceTypeComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  let fetchedTypes: string[] = [];
  try {
    const { data } = useResourceTypes();
    if (Array.isArray(data)) {
      fetchedTypes = data;
    }
  } catch {
    // Graceful fallback if rendered outside of QueryClientProvider
  }

  // Combine predefined types with fetched types, extraOptions, and current value
  const allTypes = React.useMemo(() => {
    const map = new Map<string, string>(); // lowercase key -> display label
    // 1. Add standard presets
    RESOURCE_TYPES.forEach((t) => {
      map.set(t.toLowerCase(), RESOURCE_TYPE_LABELS[t] || capitalizeFirstLetter(t));
    });
    // 2. Add fetched types from backend
    fetchedTypes.forEach((t) => {
      if (t?.trim() && !map.has(t.trim().toLowerCase())) {
        map.set(t.trim().toLowerCase(), capitalizeFirstLetter(t.trim()));
      }
    });
    // 3. Add extraOptions
    if (Array.isArray(extraOptions)) {
      extraOptions.forEach((t) => {
        if (t?.trim() && !map.has(t.trim().toLowerCase())) {
          map.set(t.trim().toLowerCase(), capitalizeFirstLetter(t.trim()));
        }
      });
    }
    // 4. Add current value if present
    if (value?.trim() && !map.has(value.trim().toLowerCase())) {
      map.set(value.trim().toLowerCase(), capitalizeFirstLetter(value.trim()));
    }

    return Array.from(map.entries()).map(([raw, label]) => ({
      value: raw,
      label,
    }));
  }, [fetchedTypes, extraOptions, value]);

  const trimmedSearch = search.trim();
  const lowerSearch = trimmedSearch.toLowerCase();

  const hasExactMatch = React.useMemo(() => {
    if (!trimmedSearch) return true;
    return allTypes.some(
      (t) => t.value === lowerSearch || t.label.toLowerCase() === lowerSearch
    );
  }, [allTypes, lowerSearch, trimmedSearch]);

  const filteredTypes = React.useMemo(() => {
    if (!trimmedSearch) return allTypes;
    return allTypes.filter(
      (t) =>
        t.value.includes(lowerSearch) ||
        t.label.toLowerCase().includes(lowerSearch)
    );
  }, [allTypes, lowerSearch, trimmedSearch]);

  function handleSelect(selected: string | undefined) {
    if (!selected) {
      onChange(undefined);
    } else if (mode === "filter") {
      onChange(selected.toLowerCase());
    } else {
      const lower = selected.toLowerCase();
      const isPredefined = RESOURCE_TYPES.some((t) => t.toLowerCase() === lower);
      onChange(isPredefined ? lower : formatTypeInput(selected));
    }
    setOpen(false);
    setSearch("");
  }

  const defaultPlaceholder = mode === "filter" ? "All types" : "Select or type...";
  const effectivePlaceholder = placeholder ?? defaultPlaceholder;

  // Display label for current value
  const displayLabel = React.useMemo(() => {
    if (!value || value === "all") return effectivePlaceholder;
    const match = allTypes.find(
      (t) => t.value === value.toLowerCase() || t.label.toLowerCase() === value.toLowerCase()
    );
    if (match) return match.label;
    return RESOURCE_TYPE_LABELS[value] || capitalizeFirstLetter(value);
  }, [value, effectivePlaceholder, allTypes]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedby}
          disabled={disabled}
          className={cn(
            mode === "filter" ? "w-40" : "w-full",
            "justify-between font-normal h-10 px-3 py-2 text-sm border-border bg-background hover:bg-muted/50 text-left",
            (!value || value === "all") && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "w-[--radix-popover-trigger-width] min-w-[200px] p-0 shadow-elev-2",
          popoverClassName
        )}
      >
        <Command shouldFilter={false} className="w-full">
          <CommandInput
            placeholder={mode === "form" ? "Search or type new..." : "Search or type..."}
            value={search}
            onValueChange={(val) => setSearch(formatTypeInput(val))}
          />
          <CommandList className="max-h-60 overflow-y-auto">
            {value && value !== "all" && (
              <>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => handleSelect(undefined)}
                    className="text-muted-foreground italic"
                  >
                    {mode === "filter" ? "All types (Clear)" : "None (Clear)"}
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {trimmedSearch && !hasExactMatch && (
              <CommandGroup>
                {mode === "form" ? (
                  <CommandItem
                    onSelect={() => handleSelect(trimmedSearch)}
                    className="font-medium text-brand"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add "{trimmedSearch}"
                  </CommandItem>
                ) : (
                  <CommandItem
                    onSelect={() => handleSelect(trimmedSearch.toLowerCase())}
                    className="font-medium text-brand"
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Filter by "{trimmedSearch}"
                  </CommandItem>
                )}
              </CommandGroup>
            )}

            {filteredTypes.length > 0 ? (
              <CommandGroup>
                {filteredTypes.map((t) => {
                  const isSelected =
                    value?.toLowerCase() === t.value ||
                    value?.toLowerCase() === t.label.toLowerCase();
                  return (
                    <CommandItem
                      key={t.value}
                      value={t.value}
                      onSelect={() => handleSelect(t.value)}
                      className="justify-between"
                    >
                      <span>{t.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-brand" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : (
              !trimmedSearch && (
                <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                  No types found.
                </CommandEmpty>
              )
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default ResourceTypeCombobox;
