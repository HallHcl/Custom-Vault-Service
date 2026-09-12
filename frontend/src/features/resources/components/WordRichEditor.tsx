import React, { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough as StrikeIcon,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo2,
  Redo2,
  RemoveFormatting,
  Code,
  Table,
  FileText,
  Code2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { htmlToMarkdown, markdownToHtml } from "../utils/markdownUtils";

export interface WordRichEditorProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  error?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  disabled?: boolean;
}

export type TextSizeOption = "14px" | "12px" | "18px" | "24px" | "32px";

export const TEXT_SIZE_CONFIG: Record<
  TextSizeOption,
  { label: string; size: string; thaiLabel: string }
> = {
  "14px": { label: "Normal (14px)", size: "14px", thaiLabel: "ปกติ" },
  "12px": { label: "Small (12px)", size: "12px", thaiLabel: "เล็ก" },
  "18px": { label: "Large (18px)", size: "18px", thaiLabel: "ใหญ่" },
  "24px": { label: "XL (24px)", size: "24px", thaiLabel: "ใหญ่มาก" },
  "32px": { label: "XXL (32px)", size: "32px", thaiLabel: "หัวข้อใหญ่" },
};

export const WordRichEditor: React.FC<WordRichEditorProps> = ({
  id = "content",
  name = "content",
  value,
  onChange,
  placeholder = "Write your document content here...",
  rows = 10,
  className,
  error,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  disabled = false,
}) => {
  const [mode, setMode] = useState<"visual" | "markdown">("visual");
  const [currentSize, setCurrentSize] = useState<TextSizeOption>("14px");
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [tableDropdownOpen, setTableDropdownOpen] = useState(false);
  const [hoverGrid, setHoverGrid] = useState<{ cols: number; rows: number }>({ cols: 0, rows: 0 });
  const [customCols, setCustomCols] = useState<number>(2);
  const [customRows, setCustomRows] = useState<number>(4);

  const visualRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tableDropdownRef = useRef<HTMLDivElement>(null);

  const isInternalUpdate = useRef(false);
  const savedSelectionRange = useRef<Range | null>(null);

  // Undo / Redo History stack
  const historyRef = useRef<string[]>([value || ""]);
  const historyIndexRef = useRef<number>(0);

  const pushHistory = (newVal: string) => {
    const history = historyRef.current;
    const currentIndex = historyIndexRef.current;

    if (history[currentIndex] === newVal) return;

    const updated = history.slice(0, currentIndex + 1);
    updated.push(newVal);
    if (updated.length > 50) updated.shift();

    historyRef.current = updated;
    historyIndexRef.current = updated.length - 1;
  };

  // Close style and table dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStyleDropdownOpen(false);
      }
      if (tableDropdownRef.current && !tableDropdownRef.current.contains(e.target as Node)) {
        setTableDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Sync external markdown value to visual editor when prop changes externally
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (visualRef.current) {
      const currentMd = htmlToMarkdown(visualRef.current.innerHTML);
      if (currentMd !== value) {
        visualRef.current.innerHTML = markdownToHtml(value);
      }
    }
  }, [value]);

  // Save selection range strictly within the visual editor canvas
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && visualRef.current) {
      const range = sel.getRangeAt(0);
      if (visualRef.current.contains(range.commonAncestorContainer)) {
        savedSelectionRange.current = range.cloneRange();
      }
    }
  };

  const restoreSelection = () => {
    if (!visualRef.current) return;
    const sel = window.getSelection();
    if (!sel) return;

    if (
      savedSelectionRange.current &&
      visualRef.current.contains(savedSelectionRange.current.commonAncestorContainer)
    ) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRange.current);
    } else {
      const range = document.createRange();
      range.selectNodeContents(visualRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      savedSelectionRange.current = range.cloneRange();
    }
  };

  // Helper to ensure all DOM insertions/modifications are strictly confined within visualRef.current
  const getValidEditorRange = (): { sel: Selection; range: Range } | null => {
    if (!visualRef.current) return null;
    visualRef.current.focus();

    const sel = window.getSelection();
    if (!sel) return null;

    if (
      savedSelectionRange.current &&
      visualRef.current.contains(savedSelectionRange.current.commonAncestorContainer)
    ) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRange.current);
      return { sel, range: savedSelectionRange.current };
    }

    if (sel.rangeCount > 0) {
      const currentRange = sel.getRangeAt(0);
      if (visualRef.current.contains(currentRange.commonAncestorContainer)) {
        savedSelectionRange.current = currentRange.cloneRange();
        return { sel, range: currentRange };
      }
    }

    const fallbackRange = document.createRange();
    fallbackRange.selectNodeContents(visualRef.current);
    fallbackRange.collapse(false);
    sel.removeAllRanges();
    sel.addRange(fallbackRange);
    savedSelectionRange.current = fallbackRange.cloneRange();
    return { sel, range: fallbackRange };
  };

  // Update current size based on cursor or selection position
  const updateActiveFormatting = () => {
    saveSelection();
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !visualRef.current) return;

    let node: Node | null = sel.anchorNode;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

    while (node && node !== visualRef.current) {
      if ((node as HTMLElement).tagName?.toLowerCase() === "span") {
        const fs = (node as HTMLElement).style.fontSize;
        if (fs && (fs === "12px" || fs === "14px" || fs === "18px" || fs === "24px" || fs === "32px")) {
          setCurrentSize(fs as TextSizeOption);
          return;
        }
      }
      const tag = (node as HTMLElement).tagName?.toLowerCase();
      if (tag === "h1") {
        setCurrentSize("32px");
        return;
      }
      if (tag === "h2") {
        setCurrentSize("24px");
        return;
      }
      if (tag === "h3") {
        setCurrentSize("18px");
        return;
      }
      if (tag === "p") {
        setCurrentSize("14px");
        return;
      }
      node = node.parentNode;
    }
    setCurrentSize("14px");
  };

  // Handle changes from visual editor
  const handleVisualInput = () => {
    if (!visualRef.current) return;
    isInternalUpdate.current = true;
    const html = visualRef.current.innerHTML;
    const md = htmlToMarkdown(html);
    pushHistory(md);
    onChange(md);
    updateActiveFormatting();
  };

  // Helper to execute document commands for visual mode without losing focus
  const execVisualCmd = (cmd: string, val: string | undefined = undefined) => {
    if (mode !== "visual" || !visualRef.current) return;
    visualRef.current.focus();
    restoreSelection();
    document.execCommand(cmd, false, val);
    handleVisualInput();
  };

  // Helper to wrap/insert text in markdown mode
  const execMarkdownCmd = (before: string, after: string = "", defaultText = "text") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;
    const selected = currentVal.substring(start, end) || defaultText;

    const updated =
      currentVal.substring(0, start) + before + selected + after + currentVal.substring(end);

    pushHistory(updated);
    onChange(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  // Format Handlers
  const handleBold = () => {
    if (mode === "visual") {
      execVisualCmd("bold");
    } else {
      execMarkdownCmd("**", "**", "bold text");
    }
  };

  const handleItalic = () => {
    if (mode === "visual") {
      execVisualCmd("italic");
    } else {
      execMarkdownCmd("*", "*", "italic text");
    }
  };

  const handleUnderline = () => {
    if (mode === "visual") {
      execVisualCmd("underline");
    } else {
      execMarkdownCmd("<u>", "</u>", "underlined text");
    }
  };

  const handleStrikethrough = () => {
    if (mode === "visual") {
      execVisualCmd("strikeThrough");
    } else {
      execMarkdownCmd("~~", "~~", "strikethrough text");
    }
  };

  // Inline Size Handler: Applies ONLY to highlighted text when text is selected!
  const handleSize = (sizeKey: TextSizeOption) => {
    setCurrentSize(sizeKey);
    setStyleDropdownOpen(false);

    if (mode === "visual") {
      const editorSel = getValidEditorRange();
      if (!editorSel) return;
      const { sel, range } = editorSel;

      // Case 1: User has highlighted specific text ("คลุมดำเฉพาะคำ")
      if (!range.collapsed) {
        if (sizeKey === "14px") {
          // Revert highlighted text to normal font size
          const fragment = range.extractContents();
          const temp = document.createElement("div");
          temp.appendChild(fragment);

          temp.querySelectorAll("span").forEach((s) => {
            s.style.fontSize = "";
            if (!s.getAttribute("style")) {
              const parent = s.parentNode;
              while (s.firstChild) parent?.insertBefore(s.firstChild, s);
              parent?.removeChild(s);
            }
          });

          const span = document.createElement("span");
          span.style.fontSize = "14px";
          while (temp.firstChild) {
            span.appendChild(temp.firstChild);
          }
          range.insertNode(span);

          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          sel.removeAllRanges();
          sel.addRange(newRange);
        } else {
          // Wrap only the selected text in a styled span
          const fragment = range.extractContents();
          const span = document.createElement("span");
          span.style.fontSize = sizeKey;
          span.style.lineHeight = "1.3";
          span.appendChild(fragment);
          range.insertNode(span);

          const newRange = document.createRange();
          newRange.selectNodeContents(span);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
        handleVisualInput();
        return;
      }

      // Case 2: No text highlighted (collapsed cursor) -> format whole block line
      const blockTag = sizeKey === "32px" ? "h1" : sizeKey === "24px" ? "h2" : sizeKey === "18px" ? "h3" : "p";
      document.execCommand("formatBlock", false, `<${blockTag}>`);
      handleVisualInput();
    } else {
      // In Markdown Mode
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      if (start !== end) {
        // Specific text highlighted -> wrap only the highlighted text
        const selected = val.substring(start, end);
        let wrapped = selected;
        if (sizeKey === "14px") {
          wrapped = selected.replace(/<span style="font-size:\s*[^"]*">([\s\S]*?)<\/span>/gi, "$1");
        } else {
          wrapped = `<span style="font-size: ${sizeKey};">${selected}</span>`;
        }
        const updated = val.substring(0, start) + wrapped + val.substring(end);
        pushHistory(updated);
        onChange(updated);

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start, start + wrapped.length);
        }, 0);
      } else {
        // Collapsed cursor -> prefix whole line
        const prefix = sizeKey === "32px" ? "# " : sizeKey === "24px" ? "## " : sizeKey === "18px" ? "### " : "";
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = val.indexOf("\n", end);
        const effectiveLineEnd = lineEnd === -1 ? val.length : lineEnd;
        const line = val.substring(lineStart, effectiveLineEnd);

        const cleanLine = line.replace(/^#{1,6}\s*/, "");
        const newLine = prefix + cleanLine;

        const updated = val.substring(0, lineStart) + newLine + val.substring(effectiveLineEnd);
        pushHistory(updated);
        onChange(updated);

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(lineStart + prefix.length, lineStart + newLine.length);
        }, 0);
      }
    }
  };

  const handleBulletList = () => {
    if (mode === "visual") {
      execVisualCmd("insertUnorderedList");
    } else {
      execMarkdownCmd("- ", "", "List item");
    }
  };

  const handleOrderedList = () => {
    if (mode === "visual") {
      execVisualCmd("insertOrderedList");
    } else {
      execMarkdownCmd("1. ", "", "Numbered item");
    }
  };

  const handleBlockquote = () => {
    if (mode === "visual") {
      execVisualCmd("formatBlock", "<blockquote>");
    } else {
      execMarkdownCmd("> ", "", "Quote");
    }
  };

  const handleCode = () => {
    if (mode === "visual") {
      const editorSel = getValidEditorRange();
      if (!editorSel) return;
      const { sel, range } = editorSel;

      // Check if already inside a <code> tag -> toggle it off
      let parent: Node | null = range.commonAncestorContainer;
      if (parent.nodeType === Node.TEXT_NODE) parent = parent.parentNode;
      if (parent && (parent as HTMLElement).tagName === "CODE") {
        const text = document.createTextNode((parent as HTMLElement).textContent || "");
        parent.parentNode?.replaceChild(text, parent);
        handleVisualInput();
        return;
      }

      const selectedText = range.toString();
      const codeEl = document.createElement("code");
      codeEl.textContent = selectedText || "code";

      range.deleteContents();
      range.insertNode(codeEl);

      const newRange = document.createRange();
      newRange.selectNodeContents(codeEl);
      sel.removeAllRanges();
      sel.addRange(newRange);

      handleVisualInput();
    } else {
      execMarkdownCmd("`", "`", "code");
    }
  };

  const handleHorizontalRule = () => {
    if (mode === "visual") {
      const editorSel = getValidEditorRange();
      if (!editorSel) return;
      const { sel, range } = editorSel;

      const hr = document.createElement("hr");
      const p = document.createElement("p");
      p.innerHTML = "<br>";

      range.collapse(false);
      range.insertNode(p);
      range.insertNode(hr);

      const newRange = document.createRange();
      newRange.setStart(p, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      handleVisualInput();
    } else {
      execMarkdownCmd("\n\n---\n\n", "");
    }
  };

  const createTableHtml = (cols: number, rows: number, initialValues?: string[][]) => {
    const colCount = Math.max(1, cols);
    const rowCount = Math.max(1, rows);
    const bodyRowCount = rowCount > 1 ? rowCount - 1 : 1;

    let html = '<table class="w-full border-collapse border border-border my-3 text-xs">';
    html += '<thead class="bg-muted/60 border-b border-border"><tr>';

    for (let c = 0; c < colCount; c++) {
      const val = initialValues?.[0]?.[c] || `Header ${c + 1}`;
      html += `<th class="border border-border px-3 py-1.5 font-semibold text-left">${val}</th>`;
    }
    html += "</tr></thead><tbody>";

    for (let r = 0; r < bodyRowCount; r++) {
      html += '<tr class="border-b border-border/60">';
      for (let c = 0; c < colCount; c++) {
        const val = initialValues?.[r + 1]?.[c] || `Cell ${r + 1},${c + 1}`;
        html += `<td class="border border-border px-3 py-1.5">${val}</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table><p><br></p>";
    return html;
  };

  const createTableMarkdown = (cols: number, rows: number, initialValues?: string[][]) => {
    const colCount = Math.max(1, cols);
    const rowCount = Math.max(1, rows);
    const bodyRowCount = rowCount > 1 ? rowCount - 1 : 1;

    const headerRow: string[] = [];
    for (let c = 0; c < colCount; c++) {
      headerRow.push(initialValues?.[0]?.[c] || `Header ${c + 1}`);
    }

    let md = `\n| ${headerRow.join(" | ")} |\n`;
    md += `| ${new Array(colCount).fill("---").join(" | ")} |\n`;

    for (let r = 0; r < bodyRowCount; r++) {
      const rowCells: string[] = [];
      for (let c = 0; c < colCount; c++) {
        rowCells.push(initialValues?.[r + 1]?.[c] || `Cell ${r + 1},${c + 1}`);
      }
      md += `| ${rowCells.join(" | ")} |\n`;
    }
    md += "\n";
    return md;
  };

  const parseSelectedTextToGrid = (
    text: string,
    desiredCols?: number
  ): { rows: string[][]; cols: number; count: number } => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      return { rows: [], cols: desiredCols || 2, count: 0 };
    }

    const firstLine = lines[0];
    let delimiter: string | RegExp = ",";
    if (firstLine.includes("\t")) {
      delimiter = "\t";
    } else if (firstLine.includes("|")) {
      delimiter = "|";
    } else if (firstLine.includes(";")) {
      delimiter = ";";
    } else if (firstLine.includes(",")) {
      delimiter = ",";
    } else {
      delimiter = /\s{2,}|\t/;
    }

    let parsed: string[][] = lines.map((l) => {
      if (typeof delimiter === "string" && delimiter === "|") {
        return l
          .split("|")
          .filter((_, idx, arr) => (idx > 0 && idx < arr.length - 1) || arr.length <= 2)
          .map((c) => c.trim());
      }
      return l.split(delimiter).map((c) => c.trim());
    });

    if (desiredCols && desiredCols > 0) {
      parsed = parsed.map((row) => {
        const copy = [...row];
        while (copy.length < desiredCols) copy.push("");
        return copy.slice(0, desiredCols);
      });
    }

    const maxCols = desiredCols || Math.max(1, ...parsed.map((r) => r.length));
    return { rows: parsed, cols: maxCols, count: parsed.length };
  };

  const handleInsertTable = (cols: number, rows: number) => {
    setTableDropdownOpen(false);

    if (mode === "visual") {
      const editorSel = getValidEditorRange();
      if (!editorSel) return;
      const { range } = editorSel;

      const selectedText = !range.collapsed ? range.toString().trim() : "";
      let initialValues: string[][] | undefined = undefined;

      if (selectedText) {
        const parsed = parseSelectedTextToGrid(selectedText, cols);
        if (parsed.rows.length > 0) {
          initialValues = parsed.rows;
        }
      }

      const tableHtml = createTableHtml(cols, rows, initialValues);
      const temp = document.createElement("div");
      temp.innerHTML = tableHtml;

      range.deleteContents();
      const frag = document.createDocumentFragment();
      while (temp.firstChild) {
        frag.appendChild(temp.firstChild);
      }
      range.insertNode(frag);

      handleVisualInput();
    } else {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const selectedText = start !== end ? val.substring(start, end).trim() : "";
      let initialValues: string[][] | undefined = undefined;

      if (selectedText) {
        const parsed = parseSelectedTextToGrid(selectedText, cols);
        if (parsed.rows.length > 0) {
          initialValues = parsed.rows;
        }
      }

      const tableMd = createTableMarkdown(cols, rows, initialValues);
      const updated = val.substring(0, start) + tableMd + val.substring(end);
      pushHistory(updated);
      onChange(updated);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + tableMd.length);
      }, 0);
    }
  };

  const handleAutoConvertSelectedText = () => {
    setTableDropdownOpen(false);

    if (mode === "visual") {
      const editorSel = getValidEditorRange();
      if (!editorSel) return;
      const { range } = editorSel;

      const selectedText = !range.collapsed ? range.toString().trim() : "";
      const parsed = parseSelectedTextToGrid(selectedText || "Col1, Col2\nVal1, Val2");
      const cols = parsed.cols;
      const rows = Math.max(2, parsed.count);

      const tableHtml = createTableHtml(cols, rows, parsed.rows);
      const temp = document.createElement("div");
      temp.innerHTML = tableHtml;

      range.deleteContents();
      const frag = document.createDocumentFragment();
      while (temp.firstChild) {
        frag.appendChild(temp.firstChild);
      }
      range.insertNode(frag);

      handleVisualInput();
    } else {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const selectedText = start !== end ? val.substring(start, end).trim() : "";
      const parsed = parseSelectedTextToGrid(selectedText || "Col1, Col2\nVal1, Val2");
      const cols = parsed.cols;
      const rows = Math.max(2, parsed.count);

      const tableMd = createTableMarkdown(cols, rows, parsed.rows);
      const updated = val.substring(0, start) + tableMd + val.substring(end);
      pushHistory(updated);
      onChange(updated);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + tableMd.length);
      }, 0);
    }
  };

  const handleClearFormatting = () => {
    if (mode === "visual") {
      execVisualCmd("removeFormat");
      handleSize("14px");
    }
  };

  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const prevVal = historyRef.current[historyIndexRef.current];
      onChange(prevVal);
      if (mode === "visual" && visualRef.current) {
        visualRef.current.innerHTML = markdownToHtml(prevVal);
      }
    } else {
      if (mode === "visual") {
        document.execCommand("undo");
        handleVisualInput();
      }
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const nextVal = historyRef.current[historyIndexRef.current];
      onChange(nextVal);
      if (mode === "visual" && visualRef.current) {
        visualRef.current.innerHTML = markdownToHtml(nextVal);
      }
    } else {
      if (mode === "visual") {
        document.execCommand("redo");
        handleVisualInput();
      }
    }
  };

  // Keyboard shortcut listener inside visual editor
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        handleBold();
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        handleItalic();
      } else if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        handleUnderline();
      } else if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "s" || e.key === "S") {
        if (e.shiftKey) {
          e.preventDefault();
          handleStrikethrough();
        }
      }
    }
  };

  // Toggle mode with content sync
  const switchMode = (newMode: "visual" | "markdown") => {
    if (newMode === mode) return;
    if (newMode === "markdown") {
      if (visualRef.current) {
        const md = htmlToMarkdown(visualRef.current.innerHTML);
        onChange(md);
      }
    } else {
      if (visualRef.current) {
        visualRef.current.innerHTML = markdownToHtml(value);
      }
    }
    setMode(newMode);
  };

  // Stats calculation
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;

  // Debounced dropdown toggles to prevent double-firing between mousedown and click
  const lastStyleToggleRef = useRef(0);
  const handleStyleToggle = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    const now = Date.now();
    if (now - lastStyleToggleRef.current < 250) {
      return;
    }
    lastStyleToggleRef.current = now;
    saveSelection();
    setStyleDropdownOpen((prev) => !prev);
  };

  const lastTableToggleRef = useRef(0);
  const handleTableToggle = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    const now = Date.now();
    if (now - lastTableToggleRef.current < 250) {
      return;
    }
    lastTableToggleRef.current = now;
    saveSelection();
    setTableDropdownOpen((prev) => !prev);
  };

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-card shadow-sm transition-all focus-within:ring-1 focus-within:ring-ring",
        error && "border-destructive ring-destructive",
        className
      )}
    >
      {/* Word Toolbar / Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border bg-muted/40 px-2 py-1.5 text-foreground">
        <div className="flex flex-wrap items-center gap-1">
          {/* Size / Style Custom Dropdown (preserves text selection on click) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={styleDropdownOpen}
              aria-label="Text size"
              onMouseDown={handleStyleToggle}
              onClick={handleStyleToggle}
              className="flex h-7 items-center justify-between gap-1.5 rounded-sm border border-border/80 bg-background px-2.5 text-xs text-foreground hover:bg-muted focus:outline-none min-w-[125px]"
              title="Font size / ขนาดตัวอักษร (ปรับเฉพาะคำที่คลุมดำได้)"
            >
              <span className="truncate">{TEXT_SIZE_CONFIG[currentSize].label}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>

            {styleDropdownOpen && (
              <div className="absolute left-0 top-8 z-50 min-w-[170px] rounded-md border border-border bg-popover p-1 shadow-md animate-in fade-in-80">
                {(["14px", "12px", "18px", "24px", "32px"] as TextSizeOption[]).map((sizeKey) => {
                  const cfg = TEXT_SIZE_CONFIG[sizeKey];
                  return (
                    <button
                      key={sizeKey}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSize(sizeKey);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-2.5 py-1.5 text-xs rounded-sm hover:bg-muted text-foreground text-left",
                        currentSize === sizeKey && "bg-muted font-bold text-primary",
                        sizeKey === "32px" && "font-bold text-sm",
                        sizeKey === "24px" && "font-semibold text-xs",
                        sizeKey === "18px" && "font-medium text-xs",
                        sizeKey === "12px" && "text-[11px]"
                      )}
                    >
                      <span>{cfg.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{cfg.thaiLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-border/60 mx-0.5" />

          {/* Bold */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              handleBold();
            }}
            className="h-7 w-7 p-0 text-foreground hover:bg-muted font-bold"
            title="Bold (Ctrl+B) / ตัวหนา"
            aria-label="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>

          {/* Italic */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              handleItalic();
            }}
            className="h-7 w-7 p-0 text-foreground hover:bg-muted"
            title="Italic (Ctrl+I) / ตัวเอียง"
            aria-label="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>

          {/* Underline */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              handleUnderline();
            }}
            className="h-7 w-7 p-0 text-foreground hover:bg-muted"
            title="Underline (Ctrl+U) / ขีดเส้นใต้"
            aria-label="Underline"
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </Button>

          {/* Strikethrough (ขีดค่า) */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              handleStrikethrough();
            }}
            className="h-7 w-7 p-0 text-foreground hover:bg-muted"
            title="Strikethrough (Ctrl+Shift+S) / ขีดค่า"
            aria-label="Strikethrough"
          >
            <StrikeIcon className="h-3.5 w-3.5" />
          </Button>

          <div className="h-4 w-px bg-border/60 mx-0.5" />

          {/* Bullet List */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              handleBulletList();
            }}
            className="h-7 w-7 p-0 text-foreground hover:bg-muted"
            title="Bullet list / รายการสัญลักษณ์"
            aria-label="Bullet list"
          >
            <List className="h-3.5 w-3.5" />
          </Button>

          {/* Numbered List */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              handleOrderedList();
            }}
            className="h-7 w-7 p-0 text-foreground hover:bg-muted"
            title="Numbered list / รายการตัวเลข"
            aria-label="Numbered list"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>

          {/* Blockquote */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              handleBlockquote();
            }}
            className="h-7 w-7 p-0 text-foreground hover:bg-muted"
            title="Quote block"
            aria-label="Quote"
          >
            <Quote className="h-3.5 w-3.5" />
          </Button>

          {/* Inline Code */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              handleCode();
            }}
            className="h-7 w-7 p-0 text-foreground hover:bg-muted"
            title="Inline code / โค้ด"
            aria-label="Code"
          >
            <Code className="h-3.5 w-3.5" />
          </Button>

          {/* Divider */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              handleHorizontalRule();
            }}
            className="h-7 w-7 p-0 text-foreground hover:bg-muted"
            title="Divider line / เส้นคั่น"
            aria-label="Divider"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>

          {/* Table Dropdown */}
          <div className="relative" ref={tableDropdownRef}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onMouseDown={handleTableToggle}
              onClick={handleTableToggle}
              className={cn(
                "h-7 px-1.5 gap-0.5 text-foreground hover:bg-muted text-xs font-normal",
                tableDropdownOpen && "bg-muted text-primary"
              )}
              title="Table / ตาราง (เลือกขนาด 2x2, 2x4, 4x2 ฯลฯ)"
              aria-label="Table"
            >
              <Table className="h-3.5 w-3.5" />
              <ChevronDown className="h-2.5 w-2.5 opacity-60" />
            </Button>

            {tableDropdownOpen && (
              <div
                onMouseDown={(e) => {
                  const targetTag = (e.target as HTMLElement).tagName?.toLowerCase();
                  if (targetTag !== "input") {
                    e.preventDefault();
                  }
                }}
                className="absolute top-full left-0 mt-1 z-50 w-64 p-3 bg-popover text-popover-foreground rounded-md border border-border shadow-xl space-y-3"
              >
                {/* Header title */}
                <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                  <span className="text-xs font-semibold text-foreground">
                    {hoverGrid.cols > 0 && hoverGrid.rows > 0 ? (
                      <span className="text-primary font-bold">
                        {hoverGrid.cols} คอลัมน์ × {hoverGrid.rows} แถว ({hoverGrid.cols}×{hoverGrid.rows})
                      </span>
                    ) : (
                      "สร้างตาราง (Table)"
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Word Style</span>
                </div>

                {/* 8x8 Interactive Grid */}
                <div className="space-y-1">
                  <div className="text-[11px] text-muted-foreground">เลื่อนเมาส์เพื่อเลือกขนาด:</div>
                  <div
                    className="grid grid-cols-8 gap-1 p-1.5 bg-muted/30 rounded border border-border/40 w-fit mx-auto"
                    onMouseLeave={() => setHoverGrid({ cols: 0, rows: 0 })}
                  >
                    {Array.from({ length: 8 }, (_, rIndex) => {
                      const rowNum = rIndex + 1;
                      return Array.from({ length: 8 }, (_, cIndex) => {
                        const colNum = cIndex + 1;
                        const isHighlighted =
                          colNum <= hoverGrid.cols && rowNum <= hoverGrid.rows;
                        return (
                          <div
                            key={`grid-${rowNum}-${colNum}`}
                            onMouseEnter={() => setHoverGrid({ cols: colNum, rows: rowNum })}
                            onClick={() => handleInsertTable(colNum, rowNum)}
                            className={cn(
                              "w-4 h-4 rounded-sm border cursor-pointer transition-all",
                              isHighlighted
                                ? "bg-primary/30 border-primary scale-105"
                                : "bg-background border-border/60 hover:border-primary/50"
                            )}
                            title={`${colNum} คอลัมน์ × ${rowNum} แถว`}
                          />
                        );
                      });
                    })}
                  </div>
                </div>

                {/* Quick Dimension Presets */}
                <div className="space-y-1">
                  <div className="text-[11px] text-muted-foreground">ขนาดด่วน (Quick Presets):</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { cols: 2, rows: 2, label: "2 × 2" },
                      { cols: 2, rows: 4, label: "2 × 4 (2 คอลัมน์)" },
                      { cols: 4, rows: 2, label: "4 × 2 (4 คอลัมน์)" },
                      { cols: 3, rows: 3, label: "3 × 3" },
                      { cols: 4, rows: 4, label: "4 × 4" },
                      { cols: 5, rows: 3, label: "5 × 3" },
                    ].map((preset) => (
                      <button
                        key={`preset-${preset.cols}-${preset.rows}`}
                        type="button"
                        onClick={() => handleInsertTable(preset.cols, preset.rows)}
                        className="text-[11px] font-medium py-1 px-1.5 rounded border border-border bg-card hover:bg-primary/10 hover:border-primary text-foreground text-center transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Row/Col input */}
                <div className="border-t border-border/60 pt-2 space-y-1.5">
                  <div className="text-[11px] text-muted-foreground">กำหนดแถวและคอลัมน์เอง:</div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      คอลัมน์:
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={customCols}
                        onChange={(e) => setCustomCols(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-11 h-6 px-1 rounded border border-border bg-background text-foreground text-center"
                      />
                    </label>
                    <span className="text-muted-foreground">×</span>
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      แถว:
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={customRows}
                        onChange={(e) => setCustomRows(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-11 h-6 px-1 rounded border border-border bg-background text-foreground text-center"
                      />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleInsertTable(customCols, customRows)}
                      className="h-6 px-2 text-[11px] ml-auto"
                    >
                      แทรก
                    </Button>
                  </div>
                </div>

                {/* Auto-convert selected text option */}
                <div className="border-t border-border/60 pt-1.5">
                  <button
                    type="button"
                    onClick={() => handleAutoConvertSelectedText()}
                    className="w-full text-left text-[11px] px-2 py-1.5 rounded hover:bg-muted text-primary font-medium flex items-center justify-between"
                  >
                    <span>✨ แปลงข้อความที่คลุมดำเป็นตาราง</span>
                    <span className="text-[9px] text-muted-foreground">Auto</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-border/60 mx-0.5" />

          {/* Undo */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              handleUndo();
            }}
            className="h-7 w-7 p-0 text-foreground hover:bg-muted"
            title="Undo (Ctrl+Z) / ย้อนกลับ"
            aria-label="Undo"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>

          {/* Redo */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              handleRedo();
            }}
            className="h-7 w-7 p-0 text-foreground hover:bg-muted"
            title="Redo (Ctrl+Y) / ทำซ้ำ"
            aria-label="Redo"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>

          {/* Clear format */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              handleClearFormatting();
            }}
            className="h-7 w-7 p-0 text-foreground hover:bg-muted"
            title="Clear formatting / ล้างรูปแบบ"
            aria-label="Clear formatting"
          >
            <RemoveFormatting className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* View Mode Switcher: Visual (Word) vs Markdown */}
        <div className="flex items-center rounded-md border border-border/80 bg-background/80 p-0.5">
          <Button
            type="button"
            variant={mode === "visual" ? "secondary" : "ghost"}
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              "h-6 px-2 text-[11px] font-medium gap-1 rounded-sm",
              mode === "visual" && "bg-primary/10 text-primary hover:bg-primary/15 font-semibold"
            )}
            onClick={() => switchMode("visual")}
            title="Word Visual Mode (WYSIWYG)"
          >
            <FileText className="h-3 w-3" />
            Word
          </Button>
          <Button
            type="button"
            variant={mode === "markdown" ? "secondary" : "ghost"}
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              "h-6 px-2 text-[11px] font-medium gap-1 rounded-sm",
              mode === "markdown" && "bg-primary/10 text-primary hover:bg-primary/15 font-semibold"
            )}
            onClick={() => switchMode("markdown")}
            title="Markdown Source Mode"
          >
            <Code2 className="h-3 w-3" />
            Markdown
          </Button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="relative">
        {/* Visual Word Mode Canvas */}
        <div
          ref={visualRef}
          contentEditable={!disabled && mode === "visual"}
          onInput={handleVisualInput}
          onKeyDown={handleKeyDown}
          onKeyUp={updateActiveFormatting}
          onMouseUp={updateActiveFormatting}
          data-testid="word-rich-visual-editor"
          className={cn(
            "word-canvas min-h-[220px] max-h-[500px] overflow-y-auto px-4 py-3 text-sm text-foreground focus:outline-none leading-relaxed",
            mode !== "visual" && "hidden"
          )}
          style={{ minHeight: `${rows * 22}px` }}
        />

        {/* Markdown Source Mode Textarea */}
        <textarea
          ref={textareaRef}
          id={id}
          name={name}
          rows={rows}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            pushHistory(e.target.value);
            if (visualRef.current) {
              visualRef.current.innerHTML = markdownToHtml(e.target.value);
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={cn(
            "w-full resize-y bg-transparent px-4 py-3 font-mono text-xs text-foreground focus:outline-none",
            mode === "visual" && "sr-only"
          )}
        />
      </div>

      {/* Word-like Status Bar */}
      <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-3 py-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{wordCount} words</span>
          <span>•</span>
          <span>{charCount} characters</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{mode === "visual" ? "Word Visual Mode" : "Markdown Mode"}</span>
          <span className="hidden sm:inline text-muted-foreground/60">
            {mode === "visual" ? "(คลุมดำเพื่อปรับขนาดเฉพาะคำได้)" : "(Direct Markdown edit)"}
          </span>
        </div>
      </div>
    </div>
  );
};
