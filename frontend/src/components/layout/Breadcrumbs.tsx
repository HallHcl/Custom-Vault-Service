import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useBreadcrumbsTrail } from "./BreadcrumbsContext";

/**
 * Renders whatever trail the current page published via `useBreadcrumbs`.
 * Mounted once in AppLayout, above <Outlet />, so it covers every
 * authenticated route without per-page wiring — a page that hasn't
 * published a trail yet (e.g. mid-navigation) renders nothing rather than
 * an empty bar.
 */
export default function Breadcrumbs() {
  const trail = useBreadcrumbsTrail();

  if (trail.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-caption text-muted-foreground">
        {trail.map((segment, index) => {
          const isLast = index === trail.length - 1;
          return (
            <Fragment key={`${segment.label}-${index}`}>
              {index > 0 && (
                <ChevronRight
                  className="h-3 w-3 shrink-0 text-muted-foreground/60"
                  aria-hidden="true"
                />
              )}
              <li className="flex items-center">
                {!isLast && segment.href ? (
                  <Link to={segment.href} className="hover:text-foreground hover:underline">
                    {segment.label}
                  </Link>
                ) : (
                  <span
                    className={isLast ? "font-medium text-foreground" : undefined}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {segment.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
