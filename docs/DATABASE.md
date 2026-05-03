# GameNet Database Structure

Currently, the application uses an in-memory **RoomManager** for real-time performance. However, below is the logical schema which can be mapped to a database like Supabase or Firebase.

## 1. Players (In-Memory / Sessions)
Tracks active connections.

| Field | Type | Description |
|---|---|---|
| id | String (UUID/SocketID) | Unique identifier for the player. |
| nickname | String | Display name chosen by the user. |
| roomId | String (Optional) | The ID of the room the player is currently in. |

## 2. Rooms
Active game sessions.

| Field | Type | Description |
|---|---|---|
| id | String (UUID) | Unique room identifier. |
| name | String | Room name. |
| hostId | String | ID of the player who created the room. |
| gameType | Enum | `tictactoe` or `rps` (Rock Paper Scissors). |
| status | Enum | `waiting`, `playing`, `finished`. |
| maxPlayers | Integer | Maximum participants (Default: 2). |
| state | JSON | Dynamic data (Board positions, scores, round info). |

## 3. Game States (Dynamic JSON)

### Tic Tac Toe
- `board`: `Array(9)` (X, O, or null)
- `turn`: Player ID
- `winner`: Player ID or null

### Rock Paper Scissors
- `moves`: Object `{ playerId: move }`
- `scores`: Object `{ playerId: score }`
- `round`: Integer
- `results`: Last round's winner and moves.
