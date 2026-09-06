import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CriticalExpirationsCard from "./CriticalExpirationsCard";
import * as expirationsHooks from "@/hooks/useExpirations";

const mockedNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CriticalExpirationsCard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CriticalExpirationsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders critical/red banner when expired_count + critical_count > 0", () => {
    vi.spyOn(expirationsHooks, "useExpirationsSummary").mockReturnValue({
      data: { expired_count: 3, critical_count: 2, warning_count: 5, upcoming_count: 1 },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof expirationsHooks.useExpirationsSummary>);

    renderCard();

    expect(
      screen.getByText("3 expired, 2 critical (≤7 days)")
    ).toBeInTheDocument();
  });

  it("renders warning/amber banner when warning_count > 0 and no expired or critical", () => {
    vi.spyOn(expirationsHooks, "useExpirationsSummary").mockReturnValue({
      data: { expired_count: 0, critical_count: 0, warning_count: 5, upcoming_count: 2 },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof expirationsHooks.useExpirationsSummary>);

    renderCard();

    expect(screen.getByText("5 expiring within 30 days")).toBeInTheDocument();
  });

  it("renders compliant/green banner when all expirations are clear (0 expired, critical, warning)", () => {
    vi.spyOn(expirationsHooks, "useExpirationsSummary").mockReturnValue({
      data: { expired_count: 0, critical_count: 0, warning_count: 0, upcoming_count: 4 },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof expirationsHooks.useExpirationsSummary>);

    renderCard();

    expect(
      screen.getByText("All expirations active & compliant")
    ).toBeInTheDocument();
  });

  it("navigates to /expirations?days_ahead=30 on card click", () => {
    vi.spyOn(expirationsHooks, "useExpirationsSummary").mockReturnValue({
      data: { expired_count: 1, critical_count: 0, warning_count: 0, upcoming_count: 0 },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof expirationsHooks.useExpirationsSummary>);

    renderCard();

    const button = screen.getByRole("button", { name: /critical expirations/i });
    fireEvent.click(button);

    expect(mockedNavigate).toHaveBeenCalledWith("/expirations?days_ahead=30");
  });

  it("displays loading and error states properly", () => {
    vi.spyOn(expirationsHooks, "useExpirationsSummary").mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof expirationsHooks.useExpirationsSummary>);

    const { unmount } = renderCard();
    expect(screen.getByText("Loading expiration status...")).toBeInTheDocument();
    unmount();

    vi.spyOn(expirationsHooks, "useExpirationsSummary").mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof expirationsHooks.useExpirationsSummary>);

    renderCard();
    expect(screen.getByText(/couldn.*t load expiration status/i)).toBeInTheDocument();
  });
});
