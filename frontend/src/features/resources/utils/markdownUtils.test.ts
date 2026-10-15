import { describe, expect, it } from "vitest";
import {
  convertSheetRowsToMarkdown,
  formatInline,
  htmlToMarkdown,
  markdownToHtml,
} from "./markdownUtils";

describe("markdownUtils", () => {
  it("formats inline bold, strikethrough, underline, and italic", () => {
    expect(formatInline("**bold text**")).toContain("<strong>bold text</strong>");
    expect(formatInline("~~strike text~~")).toContain("<del class=\"line-through text-muted-foreground\">strike text</del>");
    expect(formatInline("<u>underlined</u>")).toContain("<u>underlined</u>");
    expect(formatInline("*italic text*")).toContain("<em>italic text</em>");
    expect(formatInline("`code inline`")).toContain("<code");
  });

  it("converts headings, lists, and paragraphs from markdown to HTML", () => {
    const md = `# Title 1\n## Title 2\n### Title 3\n\n- Bullet item 1\n- Bullet item 2\n\n1. Numbered 1\n2. Numbered 2\n\nNormal paragraph with **bold** and ~~strike~~.`;
    const html = markdownToHtml(md);

    expect(html).toContain("<h1");
    expect(html).toContain("Title 1");
    expect(html).toContain("<h2");
    expect(html).toContain("<h3");
    expect(html).toContain("<ul");
    expect(html).toContain("Bullet item 1");
    expect(html).toContain("<ol");
    expect(html).toContain("Numbered 1");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<del");
  });

  it("converts HTML back to Markdown", () => {
    const html = `<h1>Header 1</h1><p>This is <strong>bold</strong> and <del>strikethrough</del> and <u>underline</u>.</p><ul><li>Item A</li><li>Item B</li></ul>`;
    const md = htmlToMarkdown(html);

    expect(md).toContain("# Header 1");
    expect(md).toContain("**bold**");
    expect(md).toContain("~~strikethrough~~");
    expect(md).toContain("<u>underline</u>");
    expect(md).toContain("- Item A");
    expect(md).toContain("- Item B");
  });

  it("converts tables between Markdown and HTML", () => {
    const md = `| Col 1 | Col 2 |\n| --- | --- |\n| A | B |\n| C | D |`;
    const html = markdownToHtml(md);

    expect(html).toContain("<table");
    expect(html).toContain("Col 1");
    expect(html).toContain("Col 2");
    expect(html).toContain("A");
    expect(html).toContain("B");

    const backToMd = htmlToMarkdown(html);
    expect(backToMd).toContain("| Col 1 | Col 2 |");
    expect(backToMd).toContain("| A | B |");
  });

  it("intelligently parses complex spreadsheet rows with title, tables, and notes", () => {
    const sheetData = [
      ["As part of the Customs CCTV project requirements..."],
      ["If you encounter any issues..."],
      [],
      ["Full Name", "User", "Password", "Required form", "Create Date."],
      ["Chanachol Kamolprapa", "chanachol.kam", ".k177W3*8:IZ", "Zabbix Team", "9/9/2029"],
      [],
      ["Password-mariadb = s,;ddyooHv8"],
      ["VIP 10.220.5.119", "", ".k177W3*8:IZ"],
    ];

    const md = convertSheetRowsToMarkdown(sheetData);

    // Pre-table notes should be plain text paragraphs, not mangled table headers
    expect(md).toContain("As part of the Customs CCTV project requirements...");
    expect(md).toContain("If you encounter any issues...");

    // The actual table should be a clean markdown table
    expect(md).toContain("| Full Name | User | Password | Required form | Create Date. |");
    expect(md).toContain("| --- | --- | --- | --- | --- |");
    expect(md).toContain("| Chanachol Kamolprapa | chanachol.kam | .k177W3*8:IZ | Zabbix Team | 9/9/2029 |");

    // Footnotes and key-values
    expect(md).toContain("Password-mariadb = s,;ddyooHv8");
    expect(md).toContain("VIP 10.220.5.119: .k177W3*8:IZ");
  });
});
