import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConflictResolution } from "./useConflictResolution";
import {
  useCreateExpiration,
  useDeleteExpiration,
  useExpiration,
  useExpirations,
  useExpirationsSummary,
  useRestoreExpiration,
  useUpdateExpiration,
} from "./useExpirations";

const getMock = vi.fn();
const postMock = vi.fn();
const patchMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/api/client")>("@/api/client");
  return {
    ...actual,
    apiClient: {
      GET: (...args: unknown[]) => getMock(...args),
      POST: (...args: unknown[]) => postMock(...args),
      PATCH: (...args: unknown[]) => patchMock(...args),
      DELETE: (...args: unknown[]) => deleteMock(...args),
    },
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const SAMPLE_EXPIRATION = {
  id: "exp-1",
  client_id: "c-1",
  project_id: "p-1",
  server_id: "srv-1",
  type: "ssl_certificate",
  name: "Wildcard SSL",
  provider_or_vendor: "Let's Encrypt",
  identifier: "*.example.com",
  expiry_date: "2026-10-01",
  alert_threshold_days: 30,
  status: "active",
  notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  days_until_expiry: 25,
  is_expired: false,
  is_critical: false,
  is_expiring_soon: true,
};

const SAMPLE_EXPIRATION_DETAIL = {
  ...SAMPLE_EXPIRATION,
  client: { id: "c-1", name: "Acme Corp" },
  project: { id: "p-1", name: "Alpha Project" },
  server: { id: "srv-1", display_name: "Web 01", hostname: "web-01" },
};

const SAMPLE_SUMMARY = {
  expired_count: 1,
  critical_count: 2,
  warning_count: 3,
  upcoming_count: 4,
};

function okResponse<T>(data: T, status = 200) {
  return { data, error: undefined, response: new Response(null, { status }) };
}

describe("useExpirations", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("fetches expirations list with query parameters", async () => {
    getMock.mockResolvedValueOnce(
      okResponse({
        data: [SAMPLE_EXPIRATION],
        pagination: { page: 1, per_page: 20, total: 1, total_pages: 1 },
      })
    );

    const { result } = renderHook(
      () =>
        useExpirations({
          clientId: "c-1",
          type: "ssl_certificate",
          daysAhead: 30,
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual([SAMPLE_EXPIRATION]);
    expect(result.current.pagination?.total).toBe(1);
    expect(getMock).toHaveBeenCalledWith(
      "/api/expirations",
      expect.objectContaining({
        params: {
          query: expect.objectContaining({
            client_id: "c-1",
            type: "ssl_certificate",
            days_ahead: 30,
            deleted: "false",
          }),
        },
      })
    );
  });
});

describe("useExpirationsSummary", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("fetches global summary when clientId is not provided", async () => {
    getMock.mockResolvedValueOnce(okResponse(SAMPLE_SUMMARY));

    const { result } = renderHook(() => useExpirationsSummary(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(SAMPLE_SUMMARY);
    expect(getMock).toHaveBeenCalledWith(
      "/api/expirations/summary",
      expect.objectContaining({
        params: { query: { client_id: undefined } },
      })
    );
  });

  it("fetches client-scoped summary when clientId is provided", async () => {
    getMock.mockResolvedValueOnce(okResponse(SAMPLE_SUMMARY));

    const { result } = renderHook(() => useExpirationsSummary("client-99"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(SAMPLE_SUMMARY);
    expect(getMock).toHaveBeenCalledWith(
      "/api/expirations/summary",
      expect.objectContaining({
        params: { query: { client_id: "client-99" } },
      })
    );
  });
});

describe("useExpiration", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("fetches single expiration detail when id is provided", async () => {
    getMock.mockResolvedValueOnce(okResponse(SAMPLE_EXPIRATION_DETAIL));

    const { result } = renderHook(() => useExpiration("exp-1"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toEqual(SAMPLE_EXPIRATION_DETAIL);
    expect(getMock).toHaveBeenCalledWith("/api/expirations/{id}", {
      params: { path: { id: "exp-1" } },
    });
  });

  it("does not fetch when id is undefined", () => {
    const { result } = renderHook(() => useExpiration(undefined), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(getMock).not.toHaveBeenCalled();
  });
});

describe("useCreateExpiration", () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it("posts creation payload to /api/expirations", async () => {
    postMock.mockResolvedValueOnce(okResponse(SAMPLE_EXPIRATION));

    const { result } = renderHook(() => useCreateExpiration(), { wrapper });

    await result.current.mutateAsync({
      client_id: "c-1",
      type: "ssl_certificate",
      name: "Wildcard SSL",
      expiry_date: "2026-10-01",
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith("/api/expirations", {
      body: {
        client_id: "c-1",
        type: "ssl_certificate",
        name: "Wildcard SSL",
        expiry_date: "2026-10-01",
      },
    });
  });
});

describe("useUpdateExpiration", () => {
  beforeEach(() => {
    patchMock.mockReset();
  });

  it("sends PATCH request with id and update body including updated_at", async () => {
    patchMock.mockResolvedValueOnce(okResponse(SAMPLE_EXPIRATION));

    const { result } = renderHook(() => useUpdateExpiration(), { wrapper });

    await result.current.mutateAsync({
      id: "exp-1",
      data: {
        status: "renewed",
        expiry_date: "2027-10-01",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(patchMock).toHaveBeenCalledTimes(1);
    expect(patchMock).toHaveBeenCalledWith("/api/expirations/{id}", {
      params: { path: { id: "exp-1" } },
      body: {
        status: "renewed",
        expiry_date: "2027-10-01",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("surfaces 409 conflict error that useConflictResolution captures", async () => {
    patchMock.mockResolvedValueOnce({
      data: undefined,
      error: { message: "This expiration was modified by someone else", code: "CONFLICT" },
      response: new Response(null, { status: 409 }),
    });

    const { result } = renderHook(() => useUpdateExpiration(), { wrapper });
    const conflictHook = renderHook(() => useConflictResolution());

    let caughtError: unknown;
    try {
      await result.current.mutateAsync({
        id: "exp-1",
        data: {
          status: "renewed",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    let captured = false;
    act(() => {
      captured = conflictHook.result.current.captureConflict(caughtError);
    });
    expect(captured).toBe(true);
    expect(conflictHook.result.current.isConflict).toBe(true);
    expect(conflictHook.result.current.conflict?.message).toBe(
      "This record was changed by someone else since you loaded it."
    );
  });
});

describe("useDeleteExpiration", () => {
  beforeEach(() => {
    deleteMock.mockReset();
  });

  it("sends DELETE request to /api/expirations/{id}", async () => {
    deleteMock.mockResolvedValueOnce(okResponse(SAMPLE_EXPIRATION));

    const { result } = renderHook(() => useDeleteExpiration(), { wrapper });

    await result.current.mutateAsync("exp-1");

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith("/api/expirations/{id}", {
      params: { path: { id: "exp-1" } },
    });
  });
});

describe("useRestoreExpiration", () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it("sends POST request to /api/expirations/{id}/restore", async () => {
    postMock.mockResolvedValueOnce(okResponse(SAMPLE_EXPIRATION));

    const { result } = renderHook(() => useRestoreExpiration(), { wrapper });

    await result.current.mutateAsync("exp-1");

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith("/api/expirations/{id}/restore", {
      params: { path: { id: "exp-1" } },
    });
  });
});
