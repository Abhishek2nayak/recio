/**
 * Dashboard data: fetches recordings and/or screenshots per the active filter,
 * merges them under the chosen sort, and exposes cursor-based "load more". The
 * type filter (recordings vs screenshots) picks which endpoints to hit; the
 * provider filter (Drive vs Vyooom) is passed through to the server.
 */
import { useCallback, useEffect, useState } from "react";
import { type MediaDTO } from "@flowcap/shared";
import { api } from "../lib/api.js";

export type Filter = "ALL" | "RECORDINGS" | "SCREENSHOTS" | "DRIVE" | "FLOWCAP";
export type Sort = "NEWEST" | "OLDEST" | "NAME" | "SIZE";

const PAGE = 24;

function wantsRecordings(f: Filter): boolean {
  return f !== "SCREENSHOTS";
}
function wantsScreenshots(f: Filter): boolean {
  return f !== "RECORDINGS";
}
function providerFilter(f: Filter): "ALL" | "DRIVE" | "FLOWCAP" {
  return f === "DRIVE" || f === "FLOWCAP" ? f : "ALL";
}

function comparator(sort: Sort): (a: MediaDTO, b: MediaDTO) => number {
  switch (sort) {
    case "OLDEST":
      return (a, b) => a.createdAt.localeCompare(b.createdAt);
    case "NAME":
      return (a, b) => a.title.localeCompare(b.title);
    case "SIZE":
      return (a, b) => b.size - a.size;
    case "NEWEST":
    default:
      return (a, b) => b.createdAt.localeCompare(a.createdAt);
  }
}

interface State {
  items: MediaDTO[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}

export function useMediaLibrary(filter: Filter, sort: Sort, search: string) {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null, hasMore: false });
  const [recCursor, setRecCursor] = useState<string | null>(null);
  const [shotCursor, setShotCursor] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (reset: boolean, cursors: { rec: string | null; shot: string | null }) => {
      const provider = providerFilter(filter);
      const baseQuery = { filter: provider, sort, search: search || undefined, limit: PAGE };

      const [recPage, shotPage] = await Promise.all([
        wantsRecordings(filter) && (reset || cursors.rec !== null)
          ? api.listRecordings({ ...baseQuery, cursor: cursors.rec ?? undefined })
          : Promise.resolve({ items: [], nextCursor: null }),
        wantsScreenshots(filter) && (reset || cursors.shot !== null)
          ? api.listScreenshots({ ...baseQuery, cursor: cursors.shot ?? undefined })
          : Promise.resolve({ items: [], nextCursor: null }),
      ]);

      setRecCursor(recPage.nextCursor);
      setShotCursor(shotPage.nextCursor);

      setState((prev) => {
        const merged = [...(reset ? [] : prev.items), ...recPage.items, ...shotPage.items].sort(
          comparator(sort),
        );
        return {
          items: merged,
          loading: false,
          error: null,
          hasMore: Boolean(recPage.nextCursor || shotPage.nextCursor),
        };
      });
    },
    [filter, sort, search],
  );

  // Reset + load whenever the query changes.
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchPage(true, { rec: null, shot: null }).catch((err: unknown) => {
      if (!cancelled)
        setState({
          items: [],
          loading: false,
          hasMore: false,
          error: err instanceof Error ? err.message : "Couldn't load your library.",
        });
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    void fetchPage(false, { rec: recCursor, shot: shotCursor });
  }, [fetchPage, recCursor, shotCursor]);

  /** Drop one item locally (after a successful delete) without refetching. */
  const remove = useCallback((id: string) => {
    setState((prev) => ({ ...prev, items: prev.items.filter((m) => m.id !== id) }));
  }, []);

  return { ...state, loadMore, remove };
}
