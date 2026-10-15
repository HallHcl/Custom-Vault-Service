import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";

describe("DatePicker", () => {
  it("renders placeholder when no value is provided", () => {
    render(<DatePicker value="" onChange={vi.fn()} placeholder="Pick date" />);
    expect(screen.getByText("Pick date")).toBeInTheDocument();
  });

  it("renders formatted date string when value is provided", () => {
    render(<DatePicker value="2026-10-15" onChange={vi.fn()} />);
    expect(screen.getByText("15 Oct 2026")).toBeInTheDocument();
  });

  it("calls onChange when hidden input receives change event", () => {
    const handleChange = vi.fn();
    render(
      <div>
        <label htmlFor="test-date">Date</label>
        <DatePicker id="test-date" value="" onChange={handleChange} />
      </div>
    );

    const input = screen.getByLabelText("Date");
    fireEvent.change(input, { target: { value: "2026-11-20" } });

    expect(handleChange).toHaveBeenCalledWith("2026-11-20");
  });

  it("opens popover on click and shows calendar", async () => {
    render(<DatePicker value="2026-10-15" onChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /15 Oct 2026/i });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
