import * as React from "react";
import { Check, ChevronsUpDown, Filter } from "lucide-react";
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
import type { ResourceType } from "@/hooks/useResources";
import { formatTypeInput, capitalizeFirstLetter } from "@/lib/keyboardUtils";

export interface ResourceTypeComboboxProps {
  id?: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  popoverClassName?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export function ResourceTypeCombobox({
  id,
  value,
  onChange,
  placeholder = "All types",
  disabled = false,
  className,
  popoverClassName,
  "aria-label": ariaLabel = "Resource type",
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}: ResourceTypeComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const trimmedSearch = search.trim();

  // Check if search matches any predefined types
  const matchingTypes = React.useMemo(() => {
    if (!trimmedSearch) return RESOURCE_TYPES;
    const lower = trimmedSearch.toLowerCase();
    return RESOURCE_TYPES.filter(
      (t) =>
        t.toLowerCase().includes(lower) ||
        RESOURCE_TYPE_LABELS[t].toLowerCase().includes(lower)
    );
  }, [trimmedSearch]);

  const hasExactPredefinedMatch = React.useMemo(() => {
    if (!trimmedSearch) return false;
    const lower = trimmedSearch.toLowerCase();
    return RESOURCE_TYPES.some(
      (t) =>
        t.toLowerCase() === lower ||
        RESOURCE_TYPE_LABELS[t].toLowerCase() === lower
    );
  }, [trimmedSearch]);

  function handleSelect(selected: string | undefined) {
    onChange(selected);
    setOpen(false);
    setSearch("");
  }

  // Display label for current value
  const displayLabel = React.useMemo(() => {
    if (!value || value === "all") return placeholder;
    const label = RESOURCE_TYPE_LABELS[value as ResourceType];
    return label || capitalizeFirstLetter(value);
  }, [value, placeholder]);

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
            "w-40 justify-between font-normal h-10 px-3 py-2 text-sm border-border bg-background hover:bg-muted/50 text-left",
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
            placeholder="Search or type..."
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
                    All types (Clear)
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {matchingTypes.length > 0 && (
              <CommandGroup>
                {matchingTypes.map((t) => {
                  const isSelected = value === t;
                  return (
                    <CommandItem
                      key={t}
                      value={t}
                      onSelect={() => handleSelect(t)}
                      className="justify-between"
                    >
                      <span>{RESOURCE_TYPE_LABELS[t]}</span>
                      {isSelected && <Check className="h-4 w-4 text-brand" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {trimmedSearch && !hasExactPredefinedMatch && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => handleSelect(trimmedSearch.toLowerCase())}
                  className="font-medium text-brand"
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Filter by "{trimmedSearch}"
                </CommandItem>
              </CommandGroup>
            )}

            {!matchingTypes.length && !trimmedSearch && (
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                No types found.
              </CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default ResourceTypeCombobox;
