import type { LeaderboardEntry } from '../types/game';

const STORAGE_KEY = 'devfest_cricket_leaderboard_v1';
const MAX_ENTRIES = 15;

export function getLeaderboard(): LeaderboardEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as LeaderboardEntry[];
  } catch {
    return [];
  }
}

export function saveLeaderboardEntry(
  entry: Omit<LeaderboardEntry, 'id' | 'timestamp'>,
): LeaderboardEntry[] {
  const existing = getLeaderboard();
  const nextEntry: LeaderboardEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };

  const sorted = [...existing, nextEntry]
    .sort((a, b) => {
      if (b.runs !== a.runs) return b.runs - a.runs;
      if (b.sixesHit !== a.sixesHit) return b.sixesHit - a.sixesHit;
      if (a.ballsFaced !== b.ballsFaced) return a.ballsFaced - b.ballsFaced;
      return b.timestamp - a.timestamp;
    })
    .slice(0, MAX_ENTRIES);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  } catch {
    // Ignore storage quota errors gracefully
  }
  return sorted;
}

export function clearLeaderboard(): LeaderboardEntry[] {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  return [];
}
