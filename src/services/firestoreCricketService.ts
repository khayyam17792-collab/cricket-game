import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  TEAM_KITS,
  type LeaderboardEntry,
  type PlayerCustomization,
  type TeamKitId,
} from '../types/game';

const VALID_KITS = new Set<string>(Object.keys(TEAM_KITS));

function sanitizePlayerName(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9 .'-]/g, '')
    .trim()
    .slice(0, 12);
  return cleaned || 'STRIKER';
}

function sanitizeJerseyNumber(raw: string): string {
  const cleaned = raw.replace(/[^0-9]/g, '').slice(0, 3);
  return cleaned || '56';
}

function sanitizeKitId(raw: string): TeamKitId {
  return VALID_KITS.has(raw) ? (raw as TeamKitId) : 'green-gold';
}

function clampInt(val: number, min: number, max: number): number {
  const n = Math.round(Number(val) || 0);
  return Math.min(max, Math.max(min, n));
}

export async function loadCloudPlayerProfile(
  uid: string,
): Promise<PlayerCustomization | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      playerName: sanitizePlayerName(String(data.playerName ?? 'STRIKER')),
      jerseyNumber: sanitizeJerseyNumber(String(data.jerseyNumber ?? '56')),
      kitId: sanitizeKitId(String(data.kitId ?? 'green-gold')),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveCloudPlayerProfile(
  uid: string,
  profile: PlayerCustomization,
): Promise<void> {
  const path = `users/${uid}`;
  const payload = {
    uid,
    playerName: sanitizePlayerName(profile.playerName),
    jerseyNumber: sanitizeJerseyNumber(profile.jerseyNumber),
    kitId: sanitizeKitId(profile.kitId),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveCloudLeaderboardEntry(
  uid: string,
  entry: Omit<LeaderboardEntry, 'id' | 'timestamp'>,
): Promise<void> {
  const scoreId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `leaderboard/${scoreId}`;

  const payload = {
    uid,
    playerName: sanitizePlayerName(entry.playerName),
    jerseyNumber: sanitizeJerseyNumber(entry.jerseyNumber),
    kitId: sanitizeKitId(entry.kitId),
    runs: clampInt(entry.runs, 0, 200),
    ballsFaced: clampInt(entry.ballsFaced, 0, 12),
    sixesHit: clampInt(entry.sixesHit, 0, 12),
    wicketsLost: clampInt(entry.wicketsLost, 0, 3),
    inningsRole: entry.inningsRole === 'bowling' ? 'bowling' : 'batting',
    won: Boolean(entry.won),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'leaderboard', scoreId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCloudLeaderboardEntry(
  scoreId: string,
): Promise<void> {
  const path = `leaderboard/${scoreId}`;
  try {
    await deleteDoc(doc(db, 'leaderboard', scoreId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeCloudLeaderboard(
  onUpdate: (entries: LeaderboardEntry[]) => void,
): Unsubscribe {
  const path = 'leaderboard';
  const q = query(
    collection(db, path),
    where('runs', '>=', 0),
    orderBy('runs', 'desc'),
    limit(20),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: LeaderboardEntry[] = snapshot.docs.map((d) => {
        const data = d.data();
        const ts = data.createdAt as Timestamp | null | undefined;
        return {
          id: d.id,
          uid: typeof data.uid === 'string' ? data.uid : undefined,
          playerName: String(data.playerName ?? 'STRIKER'),
          jerseyNumber: String(data.jerseyNumber ?? '56'),
          kitId: sanitizeKitId(String(data.kitId ?? 'green-gold')),
          runs: Number(data.runs ?? 0),
          ballsFaced: Number(data.ballsFaced ?? 0),
          sixesHit: Number(data.sixesHit ?? 0),
          wicketsLost: Number(data.wicketsLost ?? 0),
          inningsRole: data.inningsRole === 'bowling' ? 'bowling' : 'batting',
          won: Boolean(data.won),
          timestamp: ts ? ts.toMillis() : Date.now(),
        };
      });

      items.sort((a, b) => {
        if (b.runs !== a.runs) return b.runs - a.runs;
        if (b.sixesHit !== a.sixesHit) return b.sixesHit - a.sixesHit;
        if (a.ballsFaced !== b.ballsFaced) return a.ballsFaced - b.ballsFaced;
        return a.timestamp - b.timestamp;
      });

      onUpdate(items.slice(0, 15));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}
