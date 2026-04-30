import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type WatchlistContextType = {
  ids: string[];
  notes: Record<string, string>;
  toggle: (id: string) => void;
  isWatched: (id: string) => boolean;
  setNote: (id: string, note: string) => void;
  remove: (id: string) => void;
};

const WatchlistContext = createContext<WatchlistContextType | null>(null);

const KEY = "dealsignal:watchlist";
const NOTES_KEY = "dealsignal:notes";

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  });
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}"); } catch { return {}; }
  });

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(ids)); }, [ids]);
  useEffect(() => { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); }, [notes]);

  // Seed with a couple of deals on first run for the demo
  useEffect(() => {
    if (ids.length === 0 && !localStorage.getItem("dealsignal:seeded")) {
      setIds(["ds-001", "ds-002", "ds-010"]);
      localStorage.setItem("dealsignal:seeded", "1");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) => setIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const isWatched = (id: string) => ids.includes(id);
  const setNote = (id: string, note: string) => setNotes((p) => ({ ...p, [id]: note }));
  const remove = (id: string) => setIds((p) => p.filter(x => x !== id));

  return <WatchlistContext.Provider value={{ ids, notes, toggle, isWatched, setNote, remove }}>{children}</WatchlistContext.Provider>;
}

export const useWatchlist = () => {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlist must be used within WatchlistProvider");
  return ctx;
};
