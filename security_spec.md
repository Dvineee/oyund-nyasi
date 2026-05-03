# Security Specification - GameNet

## 1. Data Invariants
- A `Room` must have exactly 2 players to start.
- `state` field must follow the game schema.
- `turn` must be the ID of one of the current players.
- `messages` must be linked to a valid `roomId`.

## 2. The "Dirty Dozen" Payloads (Deny Cases)
1. Creating a room with a fake `hostId`.
2. Joining a room that is already full (2 players).
3. Making a move when it's not your turn.
4. Updating the game board with invalid indices (e.g., cell 15 in TicTacToe).
5. Changing the `gameType` after creation.
6. Deleting a room if you are not the host.
7. Spoofing `senderName` in chat messages.
8. Writing to `rooms` without authentication.
9. Overwriting someone else's move.
10. Modifying `createdAt` timestamp.
11. Setting yourself as the winner without winning.
12. Listing all messages from all rooms at once (security leakage).

## 3. Test Runner
(Tests will be implemented in firestore.rules.test.ts if environment permits, otherwise logical validation is performed).
