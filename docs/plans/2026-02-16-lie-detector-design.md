# Lie Detector — Game Design Document

## Overview

A web-based party game based on "Two Truths and a Lie." Players join a room on their own devices, take turns writing statements, and vote to identify each other's lies. Points are awarded for both correct guesses and successful deception.

## Core Gameplay Loop

1. **Create/Join Room** — Host creates a room, gets a 4-letter code (e.g. "XKBR"). Players join by entering the code on their phone/device.
2. **Lobby** — Host sees the player roster, selects the number of rounds (cycles), and starts the game. Minimum 3 players required. Room locks on game start — no new joins after.
3. **Round Loop** — One round = every player gets one turn. The host selects how many rounds to play before starting. Player order reshuffles each cycle.
4. **Game Over** — Final scoreboard with stats.

### Turn Flow

Each turn follows this sequence:

```
LOBBY → SUBMITTING → TRANSITION → VOTING → TRANSITION → REVEAL → SCOREBOARD → (next player) → SUBMITTING → ... → GAME_OVER
```

| Phase | What happens |
|-------|-------------|
| **SUBMITTING** | Current player writes 2 truths + 1 lie. Others see a waiting screen showing who is writing. |
| **TRANSITION** | Brief animated screen on all devices to build anticipation before voting. |
| **VOTING** | All 3 statements shown in randomized order as tappable cards. Voters pick the lie and hit submit. Live indicator shows who is still voting. |
| **TRANSITION** | Brief animated screen on all devices once all votes are in, before revealing. |
| **REVEAL** | Correct answer highlighted. Shows who guessed right and who was fooled. |
| **SCOREBOARD** | Running totals for all players sorted by score. Host hits "Next" to advance to the next turn. |
| **GAME_OVER** | Final scoreboard with breakdown of correct guesses vs. players fooled. Host can start a new game. |

### Scoring

- **+1 point** for each player who correctly identifies the lie
- **+1 point** to the submitter for each player they fooled

## Architecture

```
┌─────────────────┐       WebSocket (Socket.IO)       ┌─────────────────┐
│   React Client  │ ◄───────────────────────────────► │   Node Server   │
│   (Vite + TS)   │                                    │  (Express + IO) │
│                 │  Events: join, submit, vote, etc.  │                 │
│  State driven   │ ◄─── room state broadcasts ─────  │  State machine  │
│  by server msgs │                                    │  per room       │
└─────────────────┘                                    └─────────────────┘
```

- **Server is the single source of truth** — clients render server state, no client-side game logic
- **In-memory state** — game rooms live in server memory, no database
- **Rooms auto-cleanup** after 30 minutes of inactivity

### Project Structure

```
wao/
├── client/              # React app (Vite + TypeScript)
│   └── src/
│       ├── components/  # UI components per game phase
│       ├── hooks/       # useSocket, useGameState
│       └── types/       # Client-side types
├── server/              # Node.js server
│   └── src/
│       ├── GameRoom.ts    # State machine + game logic
│       ├── RoomManager.ts # Room creation, lookup, cleanup
│       └── index.ts       # Express + Socket.IO setup
└── shared/              # Shared types between client/server
    └── types.ts
```

## Data Model

```typescript
type GamePhase =
  | "LOBBY"
  | "SUBMITTING"
  | "PRE_VOTE_TRANSITION"
  | "VOTING"
  | "PRE_REVEAL_TRANSITION"
  | "REVEAL"
  | "SCOREBOARD"
  | "GAME_OVER";

interface Player {
  id: string;         // socket ID
  name: string;
  score: number;
  connected: boolean;
}

interface GameRoom {
  code: string;                // 4-letter room code
  hostId: string;              // socket ID of the host
  phase: GamePhase;
  players: Player[];
  totalRounds: number;         // number of full cycles
  currentRound: number;        // current cycle (1-indexed)
  currentPlayerIndex: number;  // whose turn within the cycle
  turnOrder: string[];         // player IDs in shuffled order
  statements: string[];        // shuffled [truth, lie, truth]
  lieIndex: number;            // index of the lie (post-shuffle)
  votes: Map<string, number>;  // playerId → index they voted for
}
```

## Socket Events

### Client → Server

| Event | Payload | When |
|-------|---------|------|
| `create-room` | `{ playerName }` | Host creates a game |
| `join-room` | `{ roomCode, playerName }` | Player joins via code |
| `start-game` | `{ totalRounds }` | Host starts from lobby |
| `submit-statements` | `{ truths: [str, str], lie: str }` | Current player submits |
| `cast-vote` | `{ voteIndex: number }` | Voter picks the lie |
| `next-round` | — | Host advances after scoreboard |
| `play-again` | — | Host restarts from game over |

### Server → Client

| Event | Payload | When |
|-------|---------|------|
| `room-created` | `{ roomCode }` | Room ready |
| `player-joined` | `{ players[] }` | Roster update |
| `phase-changed` | `{ phase, ...phaseData }` | Any phase transition |
| `vote-update` | `{ voted: string[], pending: string[] }` | Someone voted (no spoilers) |
| `error` | `{ message }` | Invalid action |

## Client Views

| Screen | Content |
|--------|---------|
| **Home** | "Create Game" / "Join Game" buttons. Name input field. |
| **Lobby** | Room code (large, easy to read aloud), player list, round count selector, host sees "Start Game" button (disabled until 3+ players). |
| **Submitting (your turn)** | Three text inputs: Truth 1, Truth 2, Your Lie. Submit button. |
| **Submitting (waiting)** | "{Name} is writing their statements..." |
| **Transition** | Brief animated screen syncing all players visually. |
| **Voting** | "Which one is the lie?" header. 3 statements as tappable cards. Submit button. Live indicator of who's still voting. |
| **Reveal** | Lie highlighted. Who guessed right/wrong. Points earned this turn. |
| **Scoreboard** | Running totals sorted by score. Host sees "Next" button. |
| **Game Over** | Final scoreboard with stats. Host sees "Play Again" button. |

Navigation is phase-driven — no router. The server's current phase determines which screen renders.

All views are mobile-first: tap-friendly, phone-keyboard-sized inputs, large readable text.

## Error Handling

- Duplicate player names rejected on join
- Room not found → clear error message
- Room locked after game start → "Game already in progress" error
- Disconnected player marked as `connected: false`, their votes are skipped
- If the current submitter disconnects, skip to next player
- Rooms auto-cleanup after 30 min inactivity

## Tech Stack

- **Client:** React, Vite, TypeScript, Socket.IO client
- **Server:** Node.js, Express, Socket.IO, TypeScript
- **State:** In-memory (no database)
- **Monorepo:** Shared types between client and server
