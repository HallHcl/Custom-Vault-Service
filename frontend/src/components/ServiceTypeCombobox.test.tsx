import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ServiceTypeCombobox } from "./ServiceTypeCombobox";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/useServers", () => ({
  useServiceTypes: () => ({
    data: ["Application", "Database", "Monitoring"],
    isLoading: false,
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("ServiceTypeCombobox", () => {
  it("renders trigger with placeholder", () => {
    renderWithClient(
      <ServiceTypeCombobox onChange={vi.fn()} placeholder="Select type..." />
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Select type...");
  });

  it("renders trigger with selected value", () => {
    renderWithClient(
      <ServiceTypeCombobox value="Database" onChange={vi.fn()} />
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Database");
  });

  it("converts Thai Kedmanee typing to English and capitalizes first letter", () => {
    const onChange = vi.fn();
    renderWithClient(<ServiceTypeCombobox onChange={onChange} />);

    // Open popover
    fireEvent.click(screen.getByRole("combobox"));

    // Find search input
    const input = screen.getByPlaceholderText("Search or type new...");
    
    // Type Thai Kedmanee typo: ผฟิิรป
    fireEvent.change(input, { target: { value: "ผฟิิรป" } });

    // The input value should automatically format to Zabbix
    expect(input).toHaveValue("Zabbix");

    // "Add \"Zabbix\"" should appear
    const addOption = screen.getByText('Add "Zabbix"');
    expect(addOption).toBeInTheDocument();

    // Clicking it should call onChange with "Zabbix"
    fireEvent.click(addOption);
    expect(onChange).toHaveBeenCalledWith("Zabbix");
  });

  it("capitalizes lowercase English input", () => {
    const onChange = vi.fn();
    renderWithClient(<ServiceTypeCombobox onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox"));
    const input = screen.getByPlaceholderText("Search or type new...");

    fireEvent.change(input, { target: { value: "redis" } });
    expect(input).toHaveValue("Redis");

    const addOption = screen.getByText('Add "Redis"');
    fireEvent.click(addOption);
    expect(onChange).toHaveBeenCalledWith("Redis");
  });
});
