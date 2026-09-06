import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface BreadcrumbSegment {
  label: string;
  /** Omitted (or undefined) for the current/last segment — rendered as plain text, not a link. */
  href?: string;
}

/** Every trail starts here — links back to the landing page. */
export const HOME_SEGMENT: BreadcrumbSegment = { label: "Home", href: "/overview" };

interface BreadcrumbsContextValue {
  trail: BreadcrumbSegment[];
  setTrail: (trail: BreadcrumbSegment[]) => void;
}

// Defaults to a real (no-op) value rather than `undefined` so a page can call
// `useBreadcrumbs` in isolation (e.g. a unit test rendering the page with no
// AppLayout ancestor) without throwing — it just publishes to nobody.
const BreadcrumbsContext = createContext<BreadcrumbsContextValue>({
  trail: [],
  setTrail: () => {},
});

export function BreadcrumbsProvider({ children }: { children: ReactNode }) {
  const [trail, setTrail] = useState<BreadcrumbSegment[]>([]);
  return (
    <BreadcrumbsContext.Provider value={{ trail, setTrail }}>
      {children}
    </BreadcrumbsContext.Provider>
  );
}

export function useBreadcrumbsTrail() {
  return useContext(BreadcrumbsContext).trail;
}

/**
 * Lets a page publish its own breadcrumb trail up to the shared AppLayout,
 * the single place that actually renders <Breadcrumbs>. `trail` is a fresh
 * array/objects on every render, so the effect keys off its serialized
 * content rather than reference identity — otherwise it would re-fire (and
 * re-render the provider) every render.
 */
export function useBreadcrumbs(trail: BreadcrumbSegment[]) {
  const { setTrail } = useContext(BreadcrumbsContext);
  const key = JSON.stringify(trail);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setTrail(trail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Clears the trail when this page unmounts, so a route with no breadcrumb
  // of its own never inherits a stale one left behind by whatever preceded it.
  useEffect(() => {
    return () => setTrail([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
