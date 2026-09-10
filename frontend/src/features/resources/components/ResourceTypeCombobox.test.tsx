import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResourceTypeCombobox } from "./ResourceTypeCombobox";

describe("ResourceTypeCombobox", () => {
  it("renders with placeholder 'All types' by default", () => {
    render(<ResourceTypeCombobox onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("All types");
  });

  it("renders with selected resource type label", () => {
    render(<ResourceTypeCombobox value="runbook" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Runbook");
  });

  it("converts Thai Kedmanee typing to English and filters predefined types", () => {
    const onChange = vi.fn();
    render(<ResourceTypeCombobox onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    const input = screen.getByPlaceholderText("Search or type...");

    // Type Thai for runbook: พีืินนา
    fireEvent.change(input, { target: { value: "พีืินนา" } });

    // The search input formats to Runbook
    expect(input).toHaveValue("Runbook");

    // Runbook item should be present in the filtered list
    const runbookItem = screen.getByText("Runbook");
    expect(runbookItem).toBeInTheDocument();

    fireEvent.click(runbookItem);
    expect(onChange).toHaveBeenCalledWith("runbook");
  });

  it("allows custom filter with Thai Kedmanee typing (ผฟิิรป -> Zabbix)", () => {
    const onChange = vi.fn();
    render(<ResourceTypeCombobox onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    const input = screen.getByPlaceholderText("Search or type...");

    // Type Thai for zabbix: ผฟิิรป
    fireEvent.change(input, { target: { value: "ผฟิิรป" } });
    expect(input).toHaveValue("Zabbix");

    // "Filter by \"Zabbix\"" should appear
    const filterOption = screen.getByText('Filter by "Zabbix"');
    expect(filterOption).toBeInTheDocument();

    fireEvent.click(filterOption);
    expect(onChange).toHaveBeenCalledWith("zabbix");
  });

  it("allows clearing selected type", () => {
    const onChange = vi.fn();
    render(<ResourceTypeCombobox value="runbook" onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    const clearItem = screen.getByText("All types (Clear)");
    fireEvent.click(clearItem);

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
