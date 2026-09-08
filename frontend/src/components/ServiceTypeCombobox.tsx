import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
import { useServiceTypes } from "@/hooks/useServers";

export interface ServiceTypeComboboxProps {
  id?: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export function ServiceTypeCombobox({
  id,
  value,
  onChange,
  placeholder = "Select or type...",
  disabled = false,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedby,
}: ServiceTypeComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const { data: fetchedTypes = [] } = useServiceTypes();

  // Combine fetched types with current value if not already in the list
  const allTypes = React.useMemo(() => {
    const list = [...fetchedTypes];
    if (value && !list.some((t) => t.toLowerCase() === value.toLowerCase())) {
      list.push(value);
    }
    return list;
  }, [fetchedTypes, value]);

  const trimmedSearch = search.trim();
  const hasExactMatch = React.useMemo(() => {
    if (!trimmedSearch) return true;
    return allTypes.some((t) => t.toLowerCase() === trimmedSearch.toLowerCase());
  }, [allTypes, trimmedSearch]);

  const filteredTypes = React.useMemo(() => {
    if (!trimmedSearch) return allTypes;
    return allTypes.filter((t) =>
      t.toLowerCase().includes(trimmedSearch.toLowerCase())
    );
  }, [allTypes, trimmedSearch]);

  function handleSelect(selected: string | undefined) {
    onChange(selected);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel ?? "Service type"}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedby}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-10 px-3 py-2 text-sm border-border bg-background hover:bg-muted/50 text-left",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0 shadow-elev-2"
      >
        <Command shouldFilter={false} className="w-full">
          <CommandInput
            placeholder="Search or type new..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-60 overflow-y-auto">
            {value && (
              <>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => handleSelect(undefined)}
                    className="text-muted-foreground italic"
                  >
                    None (Clear)
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {trimmedSearch && !hasExactMatch && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => handleSelect(trimmedSearch)}
                  className="font-medium text-brand"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add "{trimmedSearch}"
                </CommandItem>
              </CommandGroup>
            )}

            {filteredTypes.length > 0 ? (
              <CommandGroup>
                {filteredTypes.map((type) => (
                  <CommandItem
                    key={type}
                    value={type}
                    onSelect={() => handleSelect(type)}
                    className="justify-between"
                  >
                    <span>{type}</span>
                    {value === type && <Check className="h-4 w-4 text-brand" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              !trimmedSearch && (
                <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                  No service types found. Type to add one.
                </CommandEmpty>
              )
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default ServiceTypeCombobox;
