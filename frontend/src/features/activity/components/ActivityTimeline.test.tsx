import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ActivityTimeline from "./ActivityTimeline";
import type { ActivityLog } from "@/types";

describe("ActivityTimeline", () => {
  it("renders 'No activity recorded.' when logs list is empty", () => {
    render(<ActivityTimeline logs={[]} />);
    expect(screen.getByText("No activity recorded.")).toBeInTheDocument();
  });

  it("renders activity logs including the 'access' action and access details", () => {
    const logs: ActivityLog[] = [
      {
        id: "l1",
        entity_type: "server",
        entity_id: "s1",
        action: "access",
        changed_by: "p1",
        created_at: "2026-01-01T12:00:00.000Z",
        changed_by_person: { id: "p1", name: "Alice Admin" },
        new_value: {
          action_type: "copy_password",
          server_name: "prod-web-01",
        },
      },
      {
        id: "l2",
        entity_type: "server",
        entity_id: "s1",
        action: "create",
        changed_by: "p1",
        created_at: "2026-01-01T11:00:00.000Z",
        changed_by_person: { id: "p1", name: "Alice Admin" },
      },
    ];

    render(<ActivityTimeline logs={logs} />);

    expect(screen.getByText("access")).toBeInTheDocument();
    expect(screen.getByText("create")).toBeInTheDocument();
    expect(screen.getByText(/copy password \(prod-web-01\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/by Alice Admin/i)).toHaveLength(2);
  });
});
