import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WordRichEditor } from "./WordRichEditor";

describe("WordRichEditor", () => {
  it("renders toolbar with Bold, Strikethrough, Underline, and Size selector", () => {
    const onChange = vi.fn();
    render(
      <WordRichEditor
        id="content"
        value="# Heading\n\nSome **bold** and ~~strikethrough~~ text"
        onChange={onChange}
      />
    );

    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Strikethrough" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Text size" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Table" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Word/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Markdown/i })).toBeInTheDocument();
  });

  it("calculates words and characters in the status bar", () => {
    const onChange = vi.fn();
    render(<WordRichEditor id="content" value="Hello world test" onChange={onChange} />);

    expect(screen.getByText(/3 words/i)).toBeInTheDocument();
    expect(screen.getByText(/16 characters/i)).toBeInTheDocument();
  });

  it("can switch between Word Visual and Markdown modes", () => {
    const onChange = vi.fn();
    render(<WordRichEditor id="content" value="Hello world" onChange={onChange} />);

    const markdownBtn = screen.getByRole("button", { name: /Markdown/i });
    fireEvent.click(markdownBtn);

    const wordBtn = screen.getByRole("button", { name: /Word/i });
    fireEvent.click(wordBtn);
  });

  it("allows typing directly in textarea when in markdown mode or tested via form", () => {
    const onChange = vi.fn();
    render(<WordRichEditor id="content" value="Initial text" onChange={onChange} />);

    const textarea = screen.getByRole("textbox", { hidden: true });
    fireEvent.change(textarea, { target: { value: "Updated markdown text" } });

    expect(onChange).toHaveBeenCalledWith("Updated markdown text");
  });

  describe("Table Dimension Selector (Word-Style Popover)", () => {
    it("opens Table popover showing 8x8 grid, dimension presets (2x2, 2x4, 4x2, etc.) and custom inputs", () => {
      const onChange = vi.fn();
      render(<WordRichEditor id="content" value="" onChange={onChange} />);

      const tableBtn = screen.getByRole("button", { name: "Table" });
      fireEvent.click(tableBtn);

      expect(screen.getByText("สร้างตาราง (Table)")).toBeInTheDocument();
      expect(screen.getByText(/เลื่อนเมาส์เพื่อเลือกขนาด:/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "2 × 2" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "2 × 4 (2 คอลัมน์)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "4 × 2 (4 คอลัมน์)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "3 × 3" })).toBeInTheDocument();
      expect(screen.getByText(/กำหนดแถวและคอลัมน์เอง:/i)).toBeInTheDocument();
      expect(screen.getByText(/แปลงข้อความที่คลุมดำเป็นตาราง/i)).toBeInTheDocument();
    });

    it("inserts a 2x4 table (2 columns, 4 rows) when clicking the 2x4 preset", () => {
      const onChange = vi.fn();
      render(<WordRichEditor id="content" value="" onChange={onChange} />);

      // Switch to markdown mode for deterministic insertion verification
      fireEvent.click(screen.getByRole("button", { name: /Markdown/i }));

      // Open Table dropdown
      fireEvent.click(screen.getByRole("button", { name: "Table" }));

      // Click 2x4 preset
      fireEvent.click(screen.getByRole("button", { name: "2 × 4 (2 คอลัมน์)" }));

      expect(onChange).toHaveBeenCalled();
      const lastCallArg = onChange.mock.calls[onChange.mock.calls.length - 1][0];

      // Must have 2 columns: Header 1, Header 2
      expect(lastCallArg).toContain("| Header 1 | Header 2 |");
      expect(lastCallArg).toContain("| --- | --- |");
      // And 3 data rows (total 4 rows)
      expect(lastCallArg).toContain("| Cell 1,1 | Cell 1,2 |");
      expect(lastCallArg).toContain("| Cell 2,1 | Cell 2,2 |");
      expect(lastCallArg).toContain("| Cell 3,1 | Cell 3,2 |");
    });

    it("inserts a 4x2 table (4 columns, 2 rows) when clicking the 4x2 preset", () => {
      const onChange = vi.fn();
      render(<WordRichEditor id="content" value="" onChange={onChange} />);

      fireEvent.click(screen.getByRole("button", { name: /Markdown/i }));
      fireEvent.click(screen.getByRole("button", { name: "Table" }));
      fireEvent.click(screen.getByRole("button", { name: "4 × 2 (4 คอลัมน์)" }));

      expect(onChange).toHaveBeenCalled();
      const lastCallArg = onChange.mock.calls[onChange.mock.calls.length - 1][0];

      // Must have 4 columns: Header 1 through Header 4
      expect(lastCallArg).toContain("| Header 1 | Header 2 | Header 3 | Header 4 |");
      expect(lastCallArg).toContain("| --- | --- | --- | --- |");
      // And 1 data row (total 2 rows)
      expect(lastCallArg).toContain("| Cell 1,1 | Cell 1,2 | Cell 1,3 | Cell 1,4 |");
    });

    it("inserts a 2x2 table when clicking the 2x2 preset", () => {
      const onChange = vi.fn();
      render(<WordRichEditor id="content" value="" onChange={onChange} />);

      fireEvent.click(screen.getByRole("button", { name: /Markdown/i }));
      fireEvent.click(screen.getByRole("button", { name: "Table" }));
      fireEvent.click(screen.getByRole("button", { name: "2 × 2" }));

      expect(onChange).toHaveBeenCalled();
      const lastCallArg = onChange.mock.calls[onChange.mock.calls.length - 1][0];

      expect(lastCallArg).toContain("| Header 1 | Header 2 |");
      expect(lastCallArg).toContain("| Cell 1,1 | Cell 1,2 |");
    });

    it("inserts custom dimension table using column and row inputs", () => {
      const onChange = vi.fn();
      render(<WordRichEditor id="content" value="" onChange={onChange} />);

      fireEvent.click(screen.getByRole("button", { name: /Markdown/i }));
      fireEvent.click(screen.getByRole("button", { name: "Table" }));

      const colInput = screen.getByRole("spinbutton", { name: /คอลัมน์:/i });
      const rowInput = screen.getByRole("spinbutton", { name: /แถว:/i });

      fireEvent.change(colInput, { target: { value: "3" } });
      fireEvent.change(rowInput, { target: { value: "3" } });

      const insertBtn = screen.getByRole("button", { name: "แทรก" });
      fireEvent.click(insertBtn);

      expect(onChange).toHaveBeenCalled();
      const lastCallArg = onChange.mock.calls[onChange.mock.calls.length - 1][0];

      expect(lastCallArg).toContain("| Header 1 | Header 2 | Header 3 |");
      expect(lastCallArg).toContain("| Cell 1,1 | Cell 1,2 | Cell 1,3 |");
      expect(lastCallArg).toContain("| Cell 2,1 | Cell 2,2 | Cell 2,3 |");
    });

    it("automatically converts highlighted text into a table with detected dimensions", () => {
      const initialText = "Product, Price, Stock\nKeyboard, $50, 100\nMouse, $25, 200";
      const onChange = vi.fn();
      render(<WordRichEditor id="content" value={initialText} onChange={onChange} />);

      fireEvent.click(screen.getByRole("button", { name: /Markdown/i }));

      const textarea = screen.getByRole("textbox", { hidden: false });
      // Simulate highlighting all text in the textarea
      fireEvent.select(textarea, { target: { selectionStart: 0, selectionEnd: initialText.length } });

      fireEvent.click(screen.getByRole("button", { name: "Table" }));
      fireEvent.click(screen.getByRole("button", { name: /แปลงข้อความที่คลุมดำเป็นตาราง/i }));

      expect(onChange).toHaveBeenCalled();
      const lastCallArg = onChange.mock.calls[onChange.mock.calls.length - 1][0];

      expect(lastCallArg).toContain("| Product | Price | Stock |");
      expect(lastCallArg).toContain("| Keyboard | $50 | 100 |");
      expect(lastCallArg).toContain("| Mouse | $25 | 200 |");
    });
  });
});
