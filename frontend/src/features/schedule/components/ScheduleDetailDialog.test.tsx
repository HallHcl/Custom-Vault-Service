import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ScheduleDetailDialog from "./ScheduleDetailDialog";
import type { Schedule } from "@/types";

const getMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: {
      GET: (...args: unknown[]) => getMock(...args),
      POST: vi.fn(),
      PATCH: vi.fn(),
      DELETE: vi.fn(),
    },
  };
});

vi.mock("@/features/auth/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

function ok<T>(data: T) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

const SCHEDULE: Schedule = {
  id: "s1",
  project_id: "p1",
  server_id: "sv1",
  title: "Monthly Backup Verification",
  type: "PM",
  scheduled_date: "2026-10-05",
  started_at: "2026-10-05T09:00:00.000Z",
  completed_at: "2026-10-05T10:30:00.000Z",
  assigned_to: "person-1",
  status: "done",
  notes: "Verified all snapshot backups. Everything is intact.",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-10-05T10:30:00.000Z",
  deleted_at: null,
};

const SCHEDULE_DETAIL = {
  ...SCHEDULE,
  is_overdue: false,
  assigned_to_person: { id: "person-1", name: "Alex Engineer" },
  project: { id: "p1", name: "Alpha Project" },
  server: { id: "sv1", name: "db-primary-01" },
};

function renderDialog(props: Partial<Parameters<typeof ScheduleDetailDialog>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ScheduleDetailDialog
        schedule={SCHEDULE}
        open={true}
        onOpenChange={vi.fn()}
        onEdit={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  );
}

describe("ScheduleDetailDialog", () => {
  beforeEach(() => {
    getMock.mockReset();
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({ roles: ["member"], isLoading: false });
    getMock.mockResolvedValue(ok(SCHEDULE_DETAIL));
  });

  it("renders full schedule details including project, server, assignee, and notes", async () => {
    renderDialog();

    expect(await screen.findByText("Monthly Backup Verification")).toBeInTheDocument();
    expect(await screen.findByText("Alex Engineer")).toBeInTheDocument();
    expect(screen.getByText("Alpha Project")).toBeInTheDocument();
    expect(screen.getByText("db-primary-01")).toBeInTheDocument();
    expect(screen.getByText("Verified all snapshot backups. Everything is intact.")).toBeInTheDocument();
  });

  it("shows fallback text when notes are empty", async () => {
    getMock.mockResolvedValue(ok({ ...SCHEDULE_DETAIL, notes: null }));
    renderDialog({ schedule: { ...SCHEDULE, notes: null } });

    expect(await screen.findByText("No notes recorded for this schedule.")).toBeInTheDocument();
  });

  it("shows Edit schedule button for non-terminal status and triggers onEdit", async () => {
    const onEdit = vi.fn();
    const activeSchedule = { ...SCHEDULE, status: "pending" as const };
    getMock.mockResolvedValue(ok({ ...SCHEDULE_DETAIL, status: "pending" as const }));

    renderDialog({ schedule: activeSchedule, onEdit });

    const editBtn = await screen.findByRole("button", { name: /edit schedule/i });
    expect(editBtn).toBeInTheDocument();

    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
  });

  it("hides Edit schedule button when schedule is in a terminal status (done/cancelled)", async () => {
    renderDialog({ schedule: { ...SCHEDULE, status: "done" } });

    await screen.findByText("Monthly Backup Verification");
    expect(screen.queryByRole("button", { name: /edit schedule/i })).not.toBeInTheDocument();
  });

  it("triggers onOpenChange(false) when Close is clicked", async () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    await screen.findByText("Monthly Backup Verification");
    const closeButtons = screen.getAllByRole("button", { name: /close/i });
    fireEvent.click(closeButtons[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
