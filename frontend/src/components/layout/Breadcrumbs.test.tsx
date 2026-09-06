import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Breadcrumbs from "./Breadcrumbs";
import { BreadcrumbsProvider, useBreadcrumbs } from "./BreadcrumbsContext";

function Publisher({ trail }: { trail: { label: string; href?: string }[] }) {
  useBreadcrumbs(trail);
  return null;
}

function renderWithTrail(trail: { label: string; href?: string }[]) {
  return render(
    <MemoryRouter>
      <BreadcrumbsProvider>
        <Publisher trail={trail} />
        <Breadcrumbs />
      </BreadcrumbsProvider>
    </MemoryRouter>
  );
}

describe("Breadcrumbs", () => {
  it("renders nothing when no page has published a trail", () => {
    const { container } = render(
      <MemoryRouter>
        <BreadcrumbsProvider>
          <Breadcrumbs />
        </BreadcrumbsProvider>
      </MemoryRouter>
    );
    expect(container.querySelector("nav")).not.toBeInTheDocument();
  });

  it("renders every segment as a link except the last", async () => {
    renderWithTrail([
      { label: "Home", href: "/overview" },
      { label: "Projects", href: "/projects" },
      { label: "Migration" },
    ]);

    expect(await screen.findByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/overview"
    );
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/projects"
    );
    expect(screen.getByText("Migration")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Migration" })).not.toBeInTheDocument();
  });

  it("marks the last segment as the current page", async () => {
    renderWithTrail([{ label: "Home", href: "/overview" }, { label: "Servers" }]);

    const current = await screen.findByText("Servers");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("does not render a link for a segment with no href even if not last", async () => {
    renderWithTrail([
      { label: "Home", href: "/overview" },
      { label: "Environments" },
      { label: "Production" },
    ]);

    expect(await screen.findByText("Environments")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Environments" })).not.toBeInTheDocument();
  });
});
