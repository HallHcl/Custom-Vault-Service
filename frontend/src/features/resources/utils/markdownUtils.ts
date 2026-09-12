/**
 * Markdown <-> HTML conversion utilities for Word-like rich text editor.
 */

export function markdownToHtml(markdown: string): string {
  if (!markdown) return "";

  // Split into lines
  const lines = markdown.split(/\r?\n/);
  const result: string[] = [];

  let inList: "ul" | "ol" | null = null;
  let inBlockquote = false;
  let blockquoteLines: string[] = [];

  const flushBlockquote = () => {
    if (inBlockquote && blockquoteLines.length > 0) {
      const inner = blockquoteLines.map((l) => formatInline(l)).join("<br />");
      result.push(
        `<blockquote class="border-l-4 border-primary/60 bg-muted/20 pl-3 py-1 my-2 italic text-muted-foreground">${inner}</blockquote>`
      );
      blockquoteLines = [];
      inBlockquote = false;
    }
  };

  const closeList = () => {
    if (inList === "ul") {
      result.push("</ul>");
      inList = null;
    } else if (inList === "ol") {
      result.push("</ol>");
      inList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Blockquote
    if (line.startsWith("> ")) {
      closeList();
      inBlockquote = true;
      blockquoteLines.push(line.slice(2));
      continue;
    } else {
      flushBlockquote();
    }

    // Horizontal rule
    if (/^(---|___|\*\*\*)$/.test(line.trim())) {
      closeList();
      result.push('<hr class="my-3 border-border" />');
      continue;
    }

    // Markdown Table
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      closeList();
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      i--;

      if (tableLines.length >= 1) {
        const rows = tableLines.map((row) =>
          row
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim())
        );

        let headerRow: string[] | null = null;
        let bodyRows: string[][] = [];

        if (rows.length >= 2 && rows[1].every((c) => /^:?-+:?$/.test(c))) {
          headerRow = rows[0];
          bodyRows = rows.slice(2);
        } else {
          headerRow = rows[0];
          bodyRows = rows.slice(1);
        }

        let tableHtml = '<table class="w-full border-collapse border border-border my-3 text-xs">';
        if (headerRow) {
          tableHtml += '<thead class="bg-muted/60 border-b border-border"><tr>';
          for (const th of headerRow) {
            tableHtml += `<th class="border border-border px-3 py-1.5 font-semibold text-left">${formatInline(th)}</th>`;
          }
          tableHtml += "</tr></thead>";
        }
        tableHtml += "<tbody>";
        for (const row of bodyRows) {
          tableHtml += '<tr class="border-b border-border/60 hover:bg-muted/20">';
          for (const td of row) {
            tableHtml += `<td class="border border-border px-3 py-1.5">${formatInline(td)}</td>`;
          }
          tableHtml += "</tr>";
        }
        tableHtml += "</tbody></table>";
        result.push(tableHtml);
        continue;
      }
    }

    // Headings
    if (line.startsWith("### ")) {
      closeList();
      result.push(
        `<h3 class="text-base font-semibold mt-3 mb-1 text-foreground">${formatInline(line.slice(4))}</h3>`
      );
      continue;
    }
    if (line.startsWith("## ")) {
      closeList();
      result.push(
        `<h2 class="text-lg font-bold mt-4 mb-1.5 text-foreground">${formatInline(line.slice(3))}</h2>`
      );
      continue;
    }
    if (line.startsWith("# ")) {
      closeList();
      result.push(
        `<h1 class="text-xl font-extrabold mt-5 mb-2 text-foreground">${formatInline(line.slice(2))}</h1>`
      );
      continue;
    }

    // Unordered list item
    const ulMatch = line.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (inList !== "ul") {
        closeList();
        result.push('<ul class="list-disc list-inside space-y-0.5 my-1.5 ml-2">');
        inList = "ul";
      }
      result.push(`<li>${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list item
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inList !== "ol") {
        closeList();
        result.push('<ol class="list-decimal list-inside space-y-0.5 my-1.5 ml-2">');
        inList = "ol";
      }
      result.push(`<li>${formatInline(olMatch[1])}</li>`);
      continue;
    }

    // Regular line
    closeList();

    if (!line.trim()) {
      // Empty paragraph / break
      result.push("<p><br /></p>");
    } else {
      result.push(`<p class="my-1 text-foreground leading-relaxed">${formatInline(line)}</p>`);
    }
  }

  flushBlockquote();
  closeList();

  return result.join("");
}

/**
 * Parses inline formatting: Bold, Strikethrough, Underline, Italic, Code, Link
 */
export function formatInline(text: string): string {
  let out = text;

  // Escape HTML entities to prevent injection
  out = out
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Restore allowed underline tags: &lt;u&gt; ... &lt;/u&gt;
  out = out.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, "<u>$1</u>");

  // Restore allowed span style tags: &lt;span style="..."&gt;...&lt;/span&gt;
  out = out.replace(/&lt;span style="(.*?)"&gt;(.*?)&lt;\/span&gt;/gi, '<span style="$1">$2</span>');

  // Inline Code: `code`
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted/60 font-mono text-[11px] text-brand">$1</code>');

  // Strikethrough: ~~text~~
  out = out.replace(/~~(.*?)~~/g, "<del class=\"line-through text-muted-foreground\">$1</del>");

  // Bold: **text** or __text__
  out = out.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__(.*?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Links: [text](url)
  out = out.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-brand underline underline-offset-2">$1</a>');

  return out;
}

/**
 * Converts HTML from contenteditable / DOM back into Markdown.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";

  // If in browser or jsdom environment, use DOMParser
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      return nodeToMarkdown(doc.body).trim();
    } catch {
      // Fallback
    }
  }

  // Basic regex fallback if DOMParser is unavailable
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<del[^>]*>(.*?)<\/del>/gi, "~~$1~~")
    .replace(/<s[^>]*>(.*?)<\/s>/gi, "~~$1~~")
    .replace(/<strike[^>]*>(.*?)<\/strike>/gi, "~~$1~~")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function nodeToMarkdown(node: Node): string {
  let result = "";

  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];

    if (child.nodeType === Node.TEXT_NODE) {
      result += child.textContent ?? "";
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const inner = nodeToMarkdown(el);

      switch (tag) {
        case "h1":
          result += `\n\n# ${inner.trim()}\n\n`;
          break;
        case "h2":
          result += `\n\n## ${inner.trim()}\n\n`;
          break;
        case "h3":
          result += `\n\n### ${inner.trim()}\n\n`;
          break;
        case "strong":
        case "b":
          result += `**${inner}**`;
          break;
        case "em":
        case "i":
          result += `*${inner}*`;
          break;
        case "del":
        case "s":
        case "strike":
          result += `~~${inner}~~`;
          break;
        case "u":
          result += `<u>${inner}</u>`;
          break;
        case "code":
          result += `\`${inner}\``;
          break;
        case "blockquote":
          result += `\n\n> ${inner.trim().replace(/\n/g, "\n> ")}\n\n`;
          break;
        case "ul":
          result += `\n${processList(el, "ul")}\n`;
          break;
        case "ol":
          result += `\n${processList(el, "ol")}\n`;
          break;
        case "p":
        case "div":
          if (inner.trim().length === 0) {
            result += "\n\n";
          } else {
            result += `\n\n${inner.trim()}\n\n`;
          }
          break;
        case "br":
          result += "\n";
          break;
        case "hr":
          result += "\n\n---\n\n";
          break;
        case "span": {
          const style = el.getAttribute("style");
          if (style && (style.includes("font-size") || style.includes("color"))) {
            result += `<span style="${style}">${inner}</span>`;
          } else {
            result += inner;
          }
          break;
        }
        case "table":
          result += `\n\n${processTable(el)}\n\n`;
          break;
        case "a": {
          const href = el.getAttribute("href") || "";
          result += `[${inner}](${href})`;
          break;
        }
        default:
          result += inner;
          break;
      }
    }
  }

  // Clean up redundant blank lines
  return result.replace(/\n{3,}/g, "\n\n");
}

function processTable(tableEl: HTMLElement): string {
  const rows: string[][] = [];
  const trList = tableEl.querySelectorAll("tr");

  trList.forEach((tr) => {
    const cells: string[] = [];
    const cellElements = tr.querySelectorAll("th, td");
    cellElements.forEach((cell) => {
      cells.push(nodeToMarkdown(cell).replace(/\r?\n/g, " ").trim());
    });
    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  if (rows.length === 0) return "";

  const colCount = Math.max(...rows.map((r) => r.length));
  const normalizedRows = rows.map((r) => {
    const copy = [...r];
    while (copy.length < colCount) copy.push("");
    return copy;
  });

  const lines: string[] = [];
  lines.push(`| ${normalizedRows[0].join(" | ")} |`);
  lines.push(`| ${new Array(colCount).fill("---").join(" | ")} |`);
  for (let i = 1; i < normalizedRows.length; i++) {
    lines.push(`| ${normalizedRows[i].join(" | ")} |`);
  }

  return lines.join("\n");
}

function processList(listEl: HTMLElement, type: "ul" | "ol"): string {
  const items: string[] = [];
  let index = 1;
  for (let i = 0; i < listEl.children.length; i++) {
    const li = listEl.children[i];
    if (li.tagName.toLowerCase() === "li") {
      const content = nodeToMarkdown(li).trim();
      if (type === "ul") {
        items.push(`- ${content}`);
      } else {
        items.push(`${index}. ${content}`);
        index++;
      }
    }
  }
  return items.join("\n");
}
