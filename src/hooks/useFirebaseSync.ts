import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  deleteCloudLeaderboardEntry,
  loadCloudPlayerProfile,
  saveCloudLeaderboardEntry,
  saveCloudPlayerProfile,
  subscribeCloudLeaderboard,
} from '../services/firestoreCricketService';
import {
  clearLeaderboard,
  getLeaderboard,
  saveLeaderboardEntry,
} from '../services/leaderboardService';
import type {
  InningsRole,
  LeaderboardEntry,
  PlayerCustomization,
} from '../types/game';

interface UseFirebaseSyncOptions {
  defaultProfile: PlayerCustomization;
  onApplyCloudProfile: (profile: PlayerCustomization) => void;
}

export type MatchScorePayload = {
  playerName: string;
  jerseyNumber: string;
  kitId: PlayerCustomization['kitId'];
  runs: number;
  ballsFaced: number;
  sixesHit: number;
  wicketsLost: number;
  inningsRole: InningsRole;
  won: boolean;
};

export function useFirebaseSync({
  defaultProfile,
  onApplyCloudProfile,
}: UseFirebaseSyncOptions) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [playerProfile, setPlayerProfile] =
    useState<PlayerCustomization>(defaultProfile);
  const [leaderboardEntries, setLeaderboardEntries] = useState<
    LeaderboardEntry[]
  >(() => getLeaderboard());

  const onApplyCloudProfileRef = useRef(onApplyCloudProfile);
  onApplyCloudProfileRef.current = onApplyCloudProfile;

  // Firebase Auth state + cloud profile sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        try {
          const cloudProfile = await loadCloudPlayerProfile(nextUser.uid);
          if (cloudProfile) {
            setPlayerProfile(cloudProfile);
            onApplyCloudProfileRef.current(cloudProfile);
          }
        } catch (err) {
          console.error('Failed to load saved player profile:', err);
        }
      } else {
        setLeaderboardEntries(getLeaderboard());
      }
    });
    return () => unsub();
  }, []);

  // Attach Firestore real-time leaderboard listener only when auth is ready and user is authenticated
  useEffect(() => {
    if (!authReady || !user) return;
    const unsub = subscribeCloudLeaderboard((entries) => {
      setLeaderboardEntries(entries);
    });
    return () => unsub();
  }, [authReady, user]);

  const signIn = useCallback(async () => {
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      console.error('Sign-in cancelled or failed:', err);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthBusy(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign-out failed:', err);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const syncProfileToCloud = useCallback(
    async (finalProfile: PlayerCustomization) => {
      if (!user) return;
      try {
        await saveCloudPlayerProfile(user.uid, finalProfile);
      } catch (err) {
        console.error('Failed to sync player kit:', err);
      }
    },
    [user],
  );

  const recordMatchScore = useCallback(
    (payload: MatchScorePayload) => {
      const updatedLocal = saveLeaderboardEntry(payload);
      if (!user) {
        setLeaderboardEntries(updatedLocal);
      } else if (user.emailVerified) {
        void saveCloudLeaderboardEntry(user.uid, payload).catch((err) => {
          console.error('Failed to save cloud leaderboard score:', err);
        });
      }
    },
    [user],
  );

  const clearLocalBoard = useCallback(() => {
    setLeaderboardEntries(clearLeaderboard());
  }, []);

  const removeCloudEntry = useCallback(async (entryId: string) => {
    try {
      await deleteCloudLeaderboardEntry(entryId);
    } catch (err) {
      console.error('Failed to delete cloud entry:', err);
    }
  }, []);

  return {
    user,
    authBusy,
    playerProfile,
    setPlayerProfile,
    leaderboardEntries,
    signIn,
    signOutUser,
    syncProfileToCloud,
    recordMatchScore,
    clearLocalBoard,
    removeCloudEntry,
  };
}
