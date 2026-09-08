import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  /** The exact text written to the clipboard. */
  value: string;
  /** For the accessible name / tooltip, e.g. "IP address". Defaults to "value". */
  label?: string;
  className?: string;
}

/**
 * A small icon button that copies `value` to the clipboard and flips to a
 * check for ~1.5s. Falls back to a toast if the Clipboard API is unavailable
 * (insecure context, denied permission).
 */
export function CopyButton({ value, label = "value", className }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Couldn't copy",
        description: `Copy the ${label} manually: ${value}`,
        variant: "destructive",
      });
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-6 w-6 shrink-0 text-muted-foreground", className)}
      onClick={handleCopy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success-text" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}
