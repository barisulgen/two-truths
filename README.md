# Two Truths

A real-time, multiplayer party game based on "Two Truths and a Lie." Players join a room on their own devices, take turns writing statements, and vote to spot each other's lies.

## How to Play

1. One player creates a game and shares the 4-letter room code
2. Others join on their own devices by entering the code (minimum 3 players)
3. The host selects how many rounds to play (1 round = every player gets one turn)
4. Each turn, one player writes 2 truths and 1 lie about themselves
5. Everyone else sees the 3 statements in a randomized order and votes on which one is the lie
6. Points are awarded: +1 for a correct guess, +1 to the submitter for each player they fooled
7. After all rounds, the player with the most points wins

## Setup

```bash
npm install
```

## Development

Start both the server and client with a single command:

```bash
npm run dev
```

This runs the server (port 3001) and client (port 5173) concurrently. Open the client URL in 3+ browser tabs to simulate multiple players.

## Testing

```bash
npm test
```

## Architecture

The game uses a client-server model over WebSockets. The server is the single source of truth — clients are stateless renderers of server-broadcast state.

### Game State Machine

Each room runs a state machine with the following phases:

```
LOBBY → SUBMITTING → TRANSITION → VOTING → TRANSITION → REVEAL → SCOREBOARD → (next turn or GAME_OVER)
```

- **LOBBY** — Players join, host configures rounds
- **SUBMITTING** — Current player writes their statements, others wait
- **TRANSITION** — Brief animated screen to sync players between phases
- **VOTING** — Players pick which statement they think is the lie
- **REVEAL** — Shows the correct answer, who guessed right, and points earned
- **SCOREBOARD** — Running totals after each turn
- **GAME_OVER** — Final standings with option to play again

### Communication

All game events flow through typed Socket.IO events. The server validates every action (whose turn it is, valid phase transitions, duplicate votes, etc.) and broadcasts state changes to the room. Clients render based on the current phase — no client-side routing or game logic.

### State Management

- Game rooms are stored in-memory on the server (no database)
- Rooms auto-cleanup after 30 minutes of inactivity
- Disconnected players are tracked and their turns are skipped
- Room codes use a 24-character alphabet (no I/O to avoid confusion with 1/0)

## Tech Stack

- **Client:** React 19, Vite, TypeScript, Socket.IO client
- **Server:** Node.js, Express, Socket.IO, TypeScript
- **Testing:** Vitest (43 tests covering game logic and room management)
- **Monorepo:** npm workspaces with shared type definitions

## Project Structure

```
two-truths/
├── shared/              # Shared TypeScript types (phases, events, data models)
│   └── types.ts
├── server/              # Node.js backend
│   └── src/
│       ├── GameRoom.ts      # State machine — phases, voting, scoring, rounds
│       ├── RoomManager.ts   # Room creation, lookup, cleanup
│       └── index.ts         # Express + Socket.IO event handlers
├── client/              # React frontend
│   └── src/
│       ├── context/         # Socket.IO connection provider
│       ├── hooks/           # useGameState — central state from server events
│       └── components/      # One component per game phase
└── package.json         # npm workspaces root
```
