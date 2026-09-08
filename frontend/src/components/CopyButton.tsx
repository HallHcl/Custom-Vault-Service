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
 * Copies text to clipboard.
 * Tries the modern Clipboard API first (works in HTTPS / localhost).
 * Falls back to document.execCommand('copy') for non-secure HTTP contexts
 * (e.g. accessing a server directly via LAN IP like http://192.168.1.85:5173).
 */
export async function writeTextToClipboard(text: string): Promise<boolean> {
  // 1. Try modern Async Clipboard API first (secure contexts)
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Failed (e.g. permission denied or insecure context in some browser versions).
      // Fall through to execCommand fallback.
    }
  }

  // 2. Fallback: document.execCommand('copy') via temporary textarea
  if (typeof document !== "undefined") {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * A small icon button that copies `value` to the clipboard and flips to a
 * check for ~1.5s. Supports both secure (HTTPS/localhost) and HTTP LAN contexts.
 * Falls back to a toast if clipboard copying is completely unavailable.
 */
export function CopyButton({ value, label = "value", className }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleCopy() {
    const ok = await writeTextToClipboard(value);
    if (ok) {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } else {
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
