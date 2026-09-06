import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { BreadcrumbsProvider } from "@/components/layout/BreadcrumbsContext";
import ScheduleFormPage, { SCHEDULE_NOTES_MAX_LENGTH } from "./ScheduleFormPage";
import type { Schedule } from "@/types";

// Same scoped timeout rationale as ScheduleFormSheet.test.tsx — multiple
// Radix Select interactions and react-query fetches across many tests.
vi.setConfig({ testTimeout: 15000 });

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: {
      GET: (...args: unknown[]) => getMock(...args),
      POST: (...args: unknown[]) => postMock(...args),
      PATCH: (...args: unknown[]) => patchMock(...args),
    },
  };
});

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

function ok<T>(data: T) {
  return { data, error: undefined, response: new Response(null, { status: 200 }) };
}

function apiError(status: number, code: string, message: string, details?: unknown) {
  return {
    data: undefined,
    error: { error: { code, message, details } },
    response: new Response(null, { status }),
  };
}

const PEOPLE = [{ id: "person-1", name: "Alex Rivera" }];
const PROJECTS = [{ id: "p1", name: "Migration" }];
const ENVIRONMENTS = [{ id: "e1", project_id: "p1", name: "PROD" }];
const SERVERS = [
  { id: "srv-1", environment_id: "e1", display_name: "web-01" },
  { id: "srv-9", environment_id: "e9", display_name: "unrelated-server" },
];

const SAMPLE_SCHEDULE: Schedule = {
  id: "s1",
  project_id: "p1",
  server_id: null,
  title: "Quarterly PM",
  type: "PM",
  scheduled_date: "2026-09-01",
  started_at: null,
  completed_at: null,
  assigned_to: "person-1",
  status: "pending",
  notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

// GET /schedules/{id} ScheduleDetail shape — inlines display names.
function scheduleDetail(overrides: Partial<Schedule> = {}) {
  const merged = { ...SAMPLE_SCHEDULE, ...overrides };
  return {
    ...merged,
    is_overdue: false,
    assigned_to_person: { id: merged.assigned_to, name: "Alex Rivera" },
    project: merged.project_id ? { id: merged.project_id, name: "Migration" } : null,
    server: merged.server_id ? { id: merged.server_id, name: "db-01" } : null,
  };
}

function paginated<T>(data: T[]) {
  return { data, pagination: { page: 1, per_page: 20, total: data.length, total_pages: 1 } };
}

function mockGetByPath(
  overrides: {
    people?: unknown;
    projects?: unknown;
    schedule?: unknown;
    environments?: unknown;
    servers?: unknown;
  } = {}
) {
  getMock.mockImplementation((path: string) => {
    if (path === "/api/people") return Promise.resolve(overrides.people ?? ok(paginated(PEOPLE)));
    if (path === "/api/projects") return Promise.resolve(overrides.projects ?? ok(paginated(PROJECTS)));
    if (path === "/api/environments")
      return Promise.resolve(overrides.environments ?? ok(paginated(ENVIRONMENTS)));
    if (path === "/api/servers") return Promise.resolve(overrides.servers ?? ok(paginated(SERVERS)));
    if (path === "/api/schedules/{id}") return Promise.resolve(overrides.schedule ?? ok(scheduleDetail()));
    throw new Error(`Unexpected path: ${path}`);
  });
}

function renderCreatePage(initialEntry = "/schedule/new") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <BreadcrumbsProvider>
          <Breadcrumbs />
          <Routes>
            <Route path="/schedule/new" element={<ScheduleFormPage mode="create" />} />
            <Route path="/schedule" element={<div>Schedule list page</div>} />
          </Routes>
        </BreadcrumbsProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderEditPage(initialEntry = "/schedule/s1/edit") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <BreadcrumbsProvider>
          <Breadcrumbs />
          <Routes>
            <Route path="/schedule/:id/edit" element={<ScheduleFormPage mode="edit" />} />
            <Route path="/schedule" element={<div>Schedule list page</div>} />
          </Routes>
        </BreadcrumbsProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ScheduleFormPage — Create mode", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    toastMock.mockClear();
    mockGetByPath();
  });

  it("renders empty form with breadcrumbs and back link", async () => {
    renderCreatePage();

    expect(screen.getByRole("heading", { name: "New schedule", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to schedule/i })).toHaveAttribute("href", "/schedule");

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toBeInTheDocument();
    expect(nav.textContent).toContain("New schedule");
  });

  it("still offers title/type/date/assignee/project/server as editable inputs, with no status/started/completed fields", async () => {
    renderCreatePage();

    expect(screen.getByLabelText("Title")).not.toBeDisabled();
    expect(screen.getByLabelText("Date")).not.toBeDisabled();
    expect(screen.queryByText("Started")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
  });

  const assigneeCombobox = () => screen.getByRole("combobox", { name: "Assigned to" });
  const projectCombobox = () => screen.getByRole("combobox", { name: "Project" });
  const serverCombobox = () => screen.getByRole("combobox", { name: "Server" });

  async function pick(combobox: HTMLElement, optionName: string) {
    fireEvent.click(combobox);
    fireEvent.click(await screen.findByRole("option", { name: optionName }));
    await waitFor(() => expect(combobox).toHaveFocus());
  }

  function fillRequiredFields() {
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New PM visit" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-01" } });
  }

  it("POSTs the create payload and navigates to /schedule on success", async () => {
    postMock.mockResolvedValue(ok({ ...SAMPLE_SCHEDULE, id: "s2" }));
    renderCreatePage();

    fillRequiredFields();
    await pick(assigneeCombobox(), "Alex Rivera");

    fireEvent.click(projectCombobox());
    fireEvent.click(await screen.findByRole("option", { name: "Migration" }));

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const [path, options] = postMock.mock.calls[0];
    expect(path).toBe("/api/schedules");
    expect(options.body).toEqual({
      title: "New PM visit",
      type: "PM",
      scheduled_date: "2026-10-01",
      assigned_to: "person-1",
      project_id: "p1",
      server_id: undefined,
      notes: undefined,
    });
    expect(options.body.status).toBeUndefined();
    expect(toastMock).toHaveBeenCalledWith({ title: "Schedule created" });
    expect(await screen.findByText("Schedule list page")).toBeInTheDocument();
  });

  it("navigates to /schedule on cancel without mutation", async () => {
    renderCreatePage();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(postMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Schedule list page")).toBeInTheDocument();
  });

  it("submits with a server selected and no project (server-only linkage)", async () => {
    postMock.mockResolvedValue(ok({ ...SAMPLE_SCHEDULE, id: "s3" }));
    renderCreatePage();

    fillRequiredFields();
    await pick(assigneeCombobox(), "Alex Rivera");

    fireEvent.click(serverCombobox());
    fireEvent.click(await screen.findByRole("option", { name: "web-01" }));

    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));

    expect(postMock.mock.calls[0][1].body).toMatchObject({ project_id: undefined, server_id: "srv-1" });
  });

  it("blocks submit with a clear validation message when neither project nor server is selected", async () => {
    renderCreatePage();

    fillRequiredFields();
    await pick(assigneeCombobox(), "Alex Rivera");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Select a Project, a Server, or both.")).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it("marks BOTH pickers invalid and points both at the single message under the Server picker", async () => {
    renderCreatePage();
    await screen.findByLabelText("Title");

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Select a Project, a Server, or both.");
    expect(alert).toHaveAttribute("id", "server-error");
    expect(projectCombobox()).toHaveAttribute("aria-invalid", "true");
    expect(projectCombobox()).toHaveAttribute("aria-describedby", "server-error");
    expect(serverCombobox()).toHaveAttribute("aria-invalid", "true");
    expect(serverCombobox()).toHaveAttribute("aria-describedby", "server-error");
    expect(screen.getAllByText("Select a Project, a Server, or both.")).toHaveLength(1);
  });

  it("scopes the Server picker to the selected Project's servers", async () => {
    renderCreatePage();

    fireEvent.click(projectCombobox());
    fireEvent.click(await screen.findByRole("option", { name: "Migration" }));

    fireEvent.click(serverCombobox());

    expect(await screen.findByRole("option", { name: "web-01" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "unrelated-server" })).not.toBeInTheDocument();
  });

  it("clears an already-selected Server when the Project changes", async () => {
    renderCreatePage();

    fireEvent.click(serverCombobox());
    fireEvent.click(await screen.findByRole("option", { name: "unrelated-server" }));
    await waitFor(() => expect(serverCombobox().textContent).toBe("unrelated-server"));

    fireEvent.click(projectCombobox());
    fireEvent.click(await screen.findByRole("option", { name: "Migration" }));

    await waitFor(() => expect(serverCombobox().textContent).not.toBe("unrelated-server"));
  });

  describe("validation — create mode", () => {
    it("blocks submit and shows 'Title is required.' on an empty title", async () => {
      renderCreatePage();
      await screen.findByLabelText("Title");

      fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-01" } });
      await pick(assigneeCombobox(), "Alex Rivera");
      await pick(projectCombobox(), "Migration");

      fireEvent.click(screen.getByRole("button", { name: /save/i }));

      expect(await screen.findByText("Title is required.")).toBeInTheDocument();
      expect(postMock).not.toHaveBeenCalled();
    });

    it("blocks submit and shows 'Date is required.' on an empty date", async () => {
      renderCreatePage();
      await screen.findByLabelText("Title");

      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New PM visit" } });
      await pick(assigneeCombobox(), "Alex Rivera");
      await pick(projectCombobox(), "Migration");

      fireEvent.click(screen.getByRole("button", { name: /save/i }));

      expect(await screen.findByText("Date is required.")).toBeInTheDocument();
      expect(postMock).not.toHaveBeenCalled();
    });

    it("blocks submit and shows 'Assignee is required.' when no assignee is chosen", async () => {
      renderCreatePage();
      await screen.findByLabelText("Title");

      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New PM visit" } });
      fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-01" } });
      await pick(projectCombobox(), "Migration");

      expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: /save/i }));

      expect(await screen.findByText("Assignee is required.")).toBeInTheDocument();
      expect(postMock).not.toHaveBeenCalled();
    });

    it("blocks submit on over-length notes and leaves an at-the-limit value alone", async () => {
      const TOO_LONG_NOTES = "n".repeat(SCHEDULE_NOTES_MAX_LENGTH + 1);
      const NOTES_ERROR = `Notes must be ${SCHEDULE_NOTES_MAX_LENGTH} characters or less.`;
      postMock.mockResolvedValue(ok({ ...SAMPLE_SCHEDULE, id: "s5" }));
      renderCreatePage();
      await screen.findByLabelText("Title");

      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New PM visit" } });
      fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-01" } });
      await pick(assigneeCombobox(), "Alex Rivera");
      await pick(projectCombobox(), "Migration");

      const notes = screen.getByLabelText(/Notes/i);
      fireEvent.change(notes, { target: { value: TOO_LONG_NOTES } });
      fireEvent.click(screen.getByRole("button", { name: /save/i }));

      expect(await screen.findByText(NOTES_ERROR)).toBeInTheDocument();
      expect(postMock).not.toHaveBeenCalled();

      // Exactly at the limit is valid.
      const atLimit = "n".repeat(SCHEDULE_NOTES_MAX_LENGTH);
      fireEvent.change(notes, { target: { value: atLimit } });
      fireEvent.click(screen.getByRole("button", { name: /save/i }));

      expect(await screen.findByText("Schedule list page")).toBeInTheDocument();
      expect(postMock).toHaveBeenCalledTimes(1);
      expect(postMock.mock.calls[0][1].body.notes).toBe(atLimit);
    });

    it("focuses the first invalid field in FIELD_DOM_ORDER_CREATE", async () => {
      renderCreatePage();
      await screen.findByLabelText("Title");

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await screen.findByText("Title is required.");
      expect(screen.getByLabelText("Title")).toHaveFocus();
    });

    it("focuses Assigned to once title and date are filled", async () => {
      renderCreatePage();
      await screen.findByLabelText("Title");

      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New PM visit" } });
      fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-01" } });

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await screen.findByText("Assignee is required.");
      expect(assigneeCombobox()).toHaveFocus();
    });

    it("focuses Notes last — only once every field above it is valid", async () => {
      const TOO_LONG_NOTES = "n".repeat(SCHEDULE_NOTES_MAX_LENGTH + 1);
      const NOTES_ERROR = `Notes must be ${SCHEDULE_NOTES_MAX_LENGTH} characters or less.`;
      renderCreatePage();
      await screen.findByLabelText("Title");

      fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New PM visit" } });
      fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-10-01" } });
      await pick(assigneeCombobox(), "Alex Rivera");
      await pick(projectCombobox(), "Migration");
      fireEvent.change(screen.getByLabelText(/Notes/i), { target: { value: TOO_LONG_NOTES } });

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await screen.findByText(NOTES_ERROR);
      expect(screen.getByLabelText(/Notes/i)).toHaveFocus();
    });
  });
});

describe("ScheduleFormPage — Edit mode", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    toastMock.mockClear();
    mockGetByPath();
  });

  it("shows loading state while schedule data is in flight", () => {
    getMock.mockImplementation(() => new Promise(() => {}));
    renderEditPage();

    expect(screen.getByText(/loading schedule/i)).toBeInTheDocument();
  });

  it("shows error state when schedule fetch fails", async () => {
    getMock.mockResolvedValue(apiError(404, "NOT_FOUND", "Schedule not found"));
    renderEditPage();

    expect(await screen.findByText("This schedule could not be found.")).toBeInTheDocument();
  });

  it("pre-fills read-only fields and renders edit breadcrumbs", async () => {
    renderEditPage();

    expect(await screen.findByRole("heading", { name: "Edit schedule", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to quarterly pm/i })).toHaveAttribute("href", "/schedule");

    // All create-mode fields are disabled read-only in edit mode
    expect(await screen.findByDisplayValue("Quarterly PM")).toBeDisabled();
    expect(screen.getByDisplayValue("PM")).toBeDisabled();
    expect(screen.getByDisplayValue("Sep 1, 2026")).toBeDisabled();
    expect(await screen.findByDisplayValue("Alex Rivera")).toBeDisabled();
    expect(await screen.findByDisplayValue("Migration")).toBeDisabled();
    expect(screen.getByLabelText(/Notes/i)).not.toBeDisabled();
  });

  it("shows no server field when the schedule has no server_id", async () => {
    renderEditPage();
    await screen.findByDisplayValue("Quarterly PM");
    expect(screen.queryByText("Server")).not.toBeInTheDocument();
  });

  it("shows the linked server's name read-only when server_id is set", async () => {
    mockGetByPath({ schedule: ok(scheduleDetail({ server_id: "srv-1" })) });
    renderEditPage();

    expect(await screen.findByText("Server")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("db-01")).toBeDisabled();
  });

  it("shows status as a read-only badge with no status dropdown", async () => {
    renderEditPage();
    await screen.findByDisplayValue("Quarterly PM");

    expect(screen.getByText("pending")).toBeInTheDocument();
    // No comboboxes in edit mode: all select fields are plain disabled inputs
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("renders 'Not started yet' / 'Not completed yet' when those fields are null", async () => {
    renderEditPage();
    expect(await screen.findByDisplayValue("Not started yet")).toBeDisabled();
    expect(await screen.findByDisplayValue("Not completed yet")).toBeDisabled();
  });

  it("shows 'Cancelled after starting' only for cancelled + a non-null started_at", async () => {
    mockGetByPath({
      schedule: ok(scheduleDetail({ status: "cancelled", started_at: "2026-08-01T10:30:00.000Z" })),
    });
    renderEditPage();
    await screen.findByDisplayValue("Quarterly PM");
    expect(screen.getByText("Cancelled after starting")).toBeInTheDocument();
  });

  it("PATCHes only notes/updated_at and navigates to /schedule on success", async () => {
    patchMock.mockResolvedValue(ok({ ...SAMPLE_SCHEDULE, notes: "checked filters" }));
    renderEditPage();

    await screen.findByDisplayValue("Quarterly PM");
    fireEvent.change(screen.getByLabelText(/Notes/i), { target: { value: "checked filters" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(patchMock).toHaveBeenCalledTimes(1));
    const [path, options] = patchMock.mock.calls[0];
    expect(path).toBe("/api/schedules/{id}");
    expect(options.params.path).toEqual({ id: "s1" });
    expect(options.body).toEqual({
      notes: "checked filters",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(toastMock).toHaveBeenCalledWith({ title: "Schedule updated" });
    expect(await screen.findByText("Schedule list page")).toBeInTheDocument();
  });

  it("navigates to /schedule on cancel without mutation", async () => {
    renderEditPage();
    await screen.findByDisplayValue("Quarterly PM");

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(patchMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Schedule list page")).toBeInTheDocument();
  });

  it("shows the conflict UI on a stale-write 409 and does not lose the user's notes edit", async () => {
    patchMock.mockResolvedValueOnce(
      apiError(409, "CONFLICT", "Schedule was modified by someone else; refresh and try again")
    );
    renderEditPage();

    await screen.findByDisplayValue("Quarterly PM");
    fireEvent.change(screen.getByLabelText(/Notes/i), { target: { value: "my in-progress note" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText("This record changed")).toBeInTheDocument();
    expect(
      screen.getByText("Schedule was modified by someone else; refresh and try again")
    ).toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();

    const freshSchedule = { ...SAMPLE_SCHEDULE, updated_at: "2026-01-03T00:00:00.000Z" };
    mockGetByPath({ schedule: ok(scheduleDetail(freshSchedule)) });
    patchMock.mockResolvedValueOnce(ok({ ...freshSchedule, notes: "my in-progress note" }));

    fireEvent.click(screen.getByRole("button", { name: /keep my changes/i }));

    await waitFor(() => expect(patchMock).toHaveBeenCalledTimes(2));
    const [, retryOptions] = patchMock.mock.calls[1];
    expect(retryOptions.body).toEqual({
      notes: "my in-progress note",
      updated_at: freshSchedule.updated_at,
    });
    expect(await screen.findByText("Schedule list page")).toBeInTheDocument();
  });

  it("reload-latest clears the conflict and re-seeds notes/status/started_at/updated_at from the server", async () => {
    patchMock.mockResolvedValueOnce(apiError(409, "CONFLICT", "stale"));
    renderEditPage();

    await screen.findByDisplayValue("Quarterly PM");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText("This record changed")).toBeInTheDocument();

    const freshSchedule = {
      ...SAMPLE_SCHEDULE,
      status: "in_progress" as const,
      started_at: "2026-01-04T00:00:00.000Z",
      notes: "someone else already started this",
      updated_at: "2026-01-05T00:00:00.000Z",
    };
    mockGetByPath({ schedule: ok(scheduleDetail(freshSchedule)) });

    fireEvent.click(screen.getByRole("button", { name: /reload latest/i }));

    await waitFor(() =>
      expect(screen.queryByText("This record changed")).not.toBeInTheDocument()
    );
    expect(await screen.findByDisplayValue("someone else already started this")).toBeInTheDocument();
    expect(screen.getByText("in progress")).toBeInTheDocument();
  });

  describe("validation — edit mode (notes only)", () => {
    const NOTES_ERROR = `Notes must be ${SCHEDULE_NOTES_MAX_LENGTH} characters or less.`;

    it("blocks the PATCH and focuses Notes on an over-length value", async () => {
      const TOO_LONG_NOTES = "n".repeat(SCHEDULE_NOTES_MAX_LENGTH + 1);
      renderEditPage();
      await screen.findByDisplayValue("Quarterly PM");

      const notes = screen.getByLabelText(/Notes/i);
      fireEvent.change(notes, { target: { value: TOO_LONG_NOTES } });
      fireEvent.click(screen.getByRole("button", { name: /save/i }));

      expect(await screen.findByText(NOTES_ERROR)).toBeInTheDocument();
      expect(notes).toHaveAttribute("aria-invalid", "true");
      expect(notes).toHaveFocus();
      expect(patchMock).not.toHaveBeenCalled();
    });

    it("validates notes ONLY — the read-only fields are never marked invalid", async () => {
      const TOO_LONG_NOTES = "n".repeat(SCHEDULE_NOTES_MAX_LENGTH + 1);
      renderEditPage();
      await screen.findByDisplayValue("Quarterly PM");

      fireEvent.change(screen.getByLabelText(/Notes/i), { target: { value: TOO_LONG_NOTES } });
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      await screen.findByText(NOTES_ERROR);

      for (const label of ["Title", "Type", "Date", "Assigned to", "Project"]) {
        expect(screen.getByLabelText(label)).not.toHaveAttribute("aria-invalid", "true");
      }
    });
  });
});
