# Security Specification — Night Stadium Super Over

## Data Invariants
1. A `PlayerProfile` at `/users/{userId}` can only be read, created, updated, or deleted by the authenticated owner whose verified `request.auth.uid == userId`, with `uid` immutable and zero PII fields stored.
2. A `LeaderboardScore` at `/leaderboard/{scoreId}` must belong to the authenticated creator (`data.uid == request.auth.uid`), have server-assigned `createdAt == request.time`, valid integer ranges (`0 <= runs <= 200`, `0 <= ballsFaced <= 12`, `0 <= sixesHit <= 12`, `0 <= wicketsLost <= 3`), and is immutable after creation (`update` denied).

## Dirty Dozen Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated write to `/users/uid1`.
2. Creating `/users/uid1` while signed in as `uid2`.
3. Creating `/users/uid1` with `uid: "uid2"` (UID spoofing).
4. Creating `/users/uid1` with an extra shadow field `isAdmin: true`.
5. Creating `/users/uid1` with an oversized `playerName` (> 12 chars) or invalid `jerseyNumber` (`"abc"`).
6. Updating `/users/uid1` to mutate `uid`.
7. Client-forged timestamp on `/users/uid1` (`updatedAt != request.time`).
8. Unauthenticated `create` on `/leaderboard/score1`.
9. Creating `/leaderboard/score1` with `uid` != `request.auth.uid`.
10. Creating `/leaderboard/score1` with negative or absurd `runs` (`-5` or `9999`) or `ballsFaced: 50`.
11. Updating an existing `/leaderboard/score1` document to inflate `runs`.
12. Deleting another user's `/leaderboard/score1` document.
