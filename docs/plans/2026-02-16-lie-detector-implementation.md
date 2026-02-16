# Lie Detector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real-time "Two Truths and a Lie" party game where players join via room code on their own devices, take turns writing statements, and vote to spot lies.

**Architecture:** React client (Vite + TS) communicates with a Node.js/Express server via Socket.IO. The server owns all game state in memory using a state machine per room. Clients are dumb renderers of server-broadcast state. Monorepo with npm workspaces and a shared types package.

**Tech Stack:** React 18, Vite, TypeScript, Node.js, Express, Socket.IO, Vitest (testing), npm workspaces

**Design doc:** `docs/plans/2026-02-16-lie-detector-design.md`

---

### Task 1: Project Scaffolding

Set up the monorepo with npm workspaces: root, shared, server, and client packages.

**Step 1: Create root package.json**

Create `package.json`:

```json
{
  "name": "lie-detector",
  "private": true,
  "workspaces": ["shared", "server", "client"]
}
```

**Step 2: Create shared package**

Create `shared/package.json`:

```json
{
  "name": "@lie-detector/shared",
  "version": "1.0.0",
  "main": "types.ts"
}
```

Create `shared/types.ts` as an empty file for now (populated in Task 2).

**Step 3: Scaffold server package**

Create `server/package.json`:

```json
{
  "name": "@lie-detector/server",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@lie-detector/shared": "*",
    "express": "^4.21.0",
    "socket.io": "^4.8.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

Create `server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

Create empty `server/src/index.ts`.

**Step 4: Scaffold client with Vite**

Run: `cd client && npm create vite@latest . -- --template react-ts`

Then add to client's `package.json` dependencies:

```json
{
  "dependencies": {
    "@lie-detector/shared": "*",
    "socket.io-client": "^4.8.0"
  }
}
```

**Step 5: Install all dependencies**

Run: `npm install` (from root)

**Step 6: Verify setup**

Run: `cd server && npx tsc --noEmit` — should pass with no errors.
Run: `cd client && npm run build` — should pass.

**Step 7: Commit**

```bash
git add -A
git commit -m "scaffold monorepo with client, server, shared packages"
```

---

### Task 2: Shared Types

Define all shared TypeScript types used by both client and server.

**Step 1: Write shared types**

Create `shared/types.ts`:

```typescript
export type GamePhase =
  | "LOBBY"
  | "SUBMITTING"
  | "PRE_VOTE_TRANSITION"
  | "VOTING"
  | "PRE_REVEAL_TRANSITION"
  | "REVEAL"
  | "SCOREBOARD"
  | "GAME_OVER";

export interface Player {
  id: string;
  name: string;
  score: number;
  connected: boolean;
}

export interface RoomState {
  code: string;
  phase: GamePhase;
  players: Player[];
  hostId: string;
  totalRounds: number;
  currentRound: number;
  currentPlayerIndex: number;
  currentPlayerName: string;
  turnOrder: string[];
}

export interface PhaseData {
  phase: GamePhase;
  statements?: string[];
  currentPlayerName?: string;
  voted?: string[];
  pending?: string[];
  lieIndex?: number;
  results?: VoteResult[];
  scores?: Player[];
  pointsThisTurn?: TurnPoints;
}

export interface VoteResult {
  playerName: string;
  votedIndex: number;
  correct: boolean;
}

export interface TurnPoints {
  submitterName: string;
  submitterPoints: number;
  guessers: { name: string; points: number }[];
}

// Client → Server events
export interface ClientEvents {
  "create-room": (data: { playerName: string }) => void;
  "join-room": (data: { roomCode: string; playerName: string }) => void;
  "start-game": (data: { totalRounds: number }) => void;
  "submit-statements": (data: { truths: [string, string]; lie: string }) => void;
  "cast-vote": (data: { voteIndex: number }) => void;
  "next-round": () => void;
  "play-again": () => void;
}

// Server → Client events
export interface ServerEvents {
  "room-created": (data: { roomCode: string }) => void;
  "player-joined": (data: { players: Player[] }) => void;
  "phase-changed": (data: PhaseData) => void;
  "vote-update": (data: { voted: string[]; pending: string[] }) => void;
  "room-state": (data: RoomState) => void;
  error: (data: { message: string }) => void;
}
```

**Step 2: Verify types compile**

Run: `cd server && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add shared/types.ts
git commit -m "define shared types for game phases, events, and data"
```

---

### Task 3: GameRoom — Core State Machine

Build the GameRoom class that manages all game logic: players, phase transitions, statements, voting, and scoring. Test-driven.

**Files:**
- Create: `server/src/GameRoom.ts`
- Test: `server/src/GameRoom.test.ts`

**Step 1: Write tests for room creation and player management**

Create `server/src/GameRoom.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { GameRoom } from "./GameRoom.js";

describe("GameRoom", () => {
  describe("creation and players", () => {
    it("creates a room with a code and host", () => {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      expect(room.code).toBe("ABCD");
      expect(room.hostId).toBe("host-1");
      expect(room.phase).toBe("LOBBY");
      expect(room.players).toHaveLength(1);
      expect(room.players[0]).toMatchObject({
        id: "host-1",
        name: "Alice",
        score: 0,
        connected: true,
      });
    });

    it("adds players", () => {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      expect(room.players).toHaveLength(3);
      expect(room.players[1].name).toBe("Bob");
    });

    it("rejects duplicate names", () => {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      expect(() => room.addPlayer("p2", "Alice")).toThrow("Name already taken");
    });

    it("rejects joins after game started", () => {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);
      expect(() => room.addPlayer("p4", "Dave")).toThrow("Game already in progress");
    });
  });

  describe("start game", () => {
    it("starts with 3+ players", () => {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(2);
      expect(room.phase).toBe("SUBMITTING");
      expect(room.totalRounds).toBe(2);
      expect(room.currentRound).toBe(1);
      expect(room.turnOrder).toHaveLength(3);
    });

    it("rejects start with fewer than 3 players", () => {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      room.addPlayer("p2", "Bob");
      expect(() => room.startGame(1)).toThrow("Need at least 3 players");
    });

    it("only host can start", () => {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      expect(() => room.startGame(1, "p2")).toThrow("Only the host can start");
    });
  });

  describe("submit statements", () => {
    function createStartedRoom() {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);
      return room;
    }

    it("accepts statements from current player and transitions to PRE_VOTE_TRANSITION", () => {
      const room = createStartedRoom();
      const currentId = room.turnOrder[room.currentPlayerIndex];
      room.submitStatements(currentId, ["truth1", "truth2"], "the lie");
      expect(room.phase).toBe("PRE_VOTE_TRANSITION");
      expect(room.statements).toHaveLength(3);
      // lie should be among the statements
      expect(room.statements).toContain("the lie");
    });

    it("rejects statements from non-current player", () => {
      const room = createStartedRoom();
      const otherId = room.turnOrder[room.currentPlayerIndex === 0 ? 1 : 0];
      expect(() =>
        room.submitStatements(otherId, ["a", "b"], "c")
      ).toThrow("Not your turn");
    });
  });

  describe("voting", () => {
    function createVotingRoom() {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);
      const currentId = room.turnOrder[room.currentPlayerIndex];
      room.submitStatements(currentId, ["truth1", "truth2"], "the lie");
      room.advanceFromTransition(); // move to VOTING
      return room;
    }

    it("moves to VOTING after transition advance", () => {
      const room = createVotingRoom();
      expect(room.phase).toBe("VOTING");
    });

    it("accepts votes from non-submitter players", () => {
      const room = createVotingRoom();
      const currentId = room.turnOrder[room.currentPlayerIndex];
      const voters = room.turnOrder.filter((id) => id !== currentId);
      room.castVote(voters[0], 1);
      expect(room.getVoteStatus().voted).toContain(
        room.players.find((p) => p.id === voters[0])!.name
      );
    });

    it("rejects vote from the submitter", () => {
      const room = createVotingRoom();
      const currentId = room.turnOrder[room.currentPlayerIndex];
      expect(() => room.castVote(currentId, 0)).toThrow("Submitter cannot vote");
    });

    it("transitions to PRE_REVEAL_TRANSITION when all votes are in", () => {
      const room = createVotingRoom();
      const currentId = room.turnOrder[room.currentPlayerIndex];
      const voters = room.turnOrder.filter((id) => id !== currentId);
      voters.forEach((id) => room.castVote(id, 0));
      expect(room.phase).toBe("PRE_REVEAL_TRANSITION");
    });
  });

  describe("reveal and scoring", () => {
    function createRevealRoom() {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);
      const currentId = room.turnOrder[room.currentPlayerIndex];
      room.submitStatements(currentId, ["truth1", "truth2"], "the lie");
      room.advanceFromTransition(); // → VOTING
      const voters = room.turnOrder.filter((id) => id !== currentId);
      // First voter picks the lie correctly, second voter picks wrong
      voters.forEach((id, i) => room.castVote(id, i === 0 ? room.lieIndex : (room.lieIndex + 1) % 3));
      room.advanceFromTransition(); // → REVEAL
      return room;
    }

    it("moves to REVEAL with results", () => {
      const room = createRevealRoom();
      expect(room.phase).toBe("REVEAL");
      const results = room.getRevealResults();
      expect(results.lieIndex).toBe(room.lieIndex);
      expect(results.results).toHaveLength(2);
    });

    it("scores correctly: +1 correct guess, +1 per fooled player", () => {
      const room = createRevealRoom();
      const results = room.getRevealResults();
      // One voter guessed right (+1 for them), one guessed wrong (+1 for submitter)
      const correctGuesser = results.results.find((r) => r.correct);
      const wrongGuesser = results.results.find((r) => !r.correct);
      expect(correctGuesser).toBeDefined();
      expect(wrongGuesser).toBeDefined();

      const submitterId = room.turnOrder[room.currentPlayerIndex];
      const submitter = room.players.find((p) => p.id === submitterId)!;
      const guesser = room.players.find((p) => p.id !== submitterId && p.score > 0);
      // submitter fooled 1 person = 1 point
      expect(submitter.score).toBe(1);
      // correct guesser = 1 point
      expect(guesser).toBeDefined();
    });
  });

  describe("round progression", () => {
    it("advances to next player after scoreboard", () => {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);

      // Complete one full turn
      const firstPlayer = room.turnOrder[0];
      room.submitStatements(firstPlayer, ["t1", "t2"], "lie");
      room.advanceFromTransition(); // → VOTING
      const voters1 = room.turnOrder.filter((id) => id !== firstPlayer);
      voters1.forEach((id) => room.castVote(id, room.lieIndex));
      room.advanceFromTransition(); // → REVEAL
      room.advanceToScoreboard(); // → SCOREBOARD
      room.advanceFromScoreboard(); // → SUBMITTING (next player)

      expect(room.phase).toBe("SUBMITTING");
      expect(room.currentPlayerIndex).toBe(1);
    });

    it("ends game after all rounds complete", () => {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1); // 1 round = 3 turns

      for (let turn = 0; turn < 3; turn++) {
        const currentId = room.turnOrder[room.currentPlayerIndex];
        room.submitStatements(currentId, ["t1", "t2"], "lie");
        room.advanceFromTransition();
        const voters = room.turnOrder.filter((id) => id !== currentId);
        voters.forEach((id) => room.castVote(id, room.lieIndex));
        room.advanceFromTransition();
        room.advanceToScoreboard();
        room.advanceFromScoreboard();
      }

      expect(room.phase).toBe("GAME_OVER");
    });
  });

  describe("disconnect handling", () => {
    it("marks player as disconnected", () => {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      room.addPlayer("p2", "Bob");
      room.disconnectPlayer("p2");
      expect(room.players.find((p) => p.id === "p2")!.connected).toBe(false);
    });

    it("skips disconnected submitter", () => {
      const room = new GameRoom("ABCD", "host-1", "Alice");
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);
      const firstPlayer = room.turnOrder[0];
      room.disconnectPlayer(firstPlayer);
      room.skipDisconnectedSubmitter();
      expect(room.currentPlayerIndex).toBe(1);
    });
  });
});
```

**Step 2: Run tests — verify they fail**

Run: `cd server && npx vitest run`
Expected: FAIL — `GameRoom` does not exist yet.

**Step 3: Implement GameRoom**

Create `server/src/GameRoom.ts`:

```typescript
import type { GamePhase, Player, VoteResult, TurnPoints } from "@lie-detector/shared";

export class GameRoom {
  code: string;
  hostId: string;
  phase: GamePhase = "LOBBY";
  players: Player[] = [];
  totalRounds = 1;
  currentRound = 1;
  currentPlayerIndex = 0;
  turnOrder: string[] = [];
  statements: string[] = [];
  lieIndex = -1;
  private votes = new Map<string, number>();
  private lastActivity = Date.now();

  constructor(code: string, hostId: string, hostName: string) {
    this.code = code;
    this.hostId = hostId;
    this.players.push({
      id: hostId,
      name: hostName,
      score: 0,
      connected: true,
    });
  }

  touch() {
    this.lastActivity = Date.now();
  }

  isStale(timeoutMs: number): boolean {
    return Date.now() - this.lastActivity > timeoutMs;
  }

  addPlayer(id: string, name: string) {
    if (this.phase !== "LOBBY") {
      throw new Error("Game already in progress");
    }
    if (this.players.some((p) => p.name === name)) {
      throw new Error("Name already taken");
    }
    this.players.push({ id, name, score: 0, connected: true });
    this.touch();
  }

  startGame(totalRounds: number, requesterId?: string) {
    if (requesterId && requesterId !== this.hostId) {
      throw new Error("Only the host can start");
    }
    if (this.players.length < 3) {
      throw new Error("Need at least 3 players");
    }
    this.totalRounds = totalRounds;
    this.currentRound = 1;
    this.currentPlayerIndex = 0;
    this.turnOrder = this.shuffleArray(this.players.map((p) => p.id));
    this.phase = "SUBMITTING";
    this.touch();
  }

  submitStatements(playerId: string, truths: [string, string], lie: string) {
    const currentId = this.turnOrder[this.currentPlayerIndex];
    if (playerId !== currentId) {
      throw new Error("Not your turn");
    }
    // Shuffle the 3 statements and track lie position
    const items: { text: string; isLie: boolean }[] = [
      { text: truths[0], isLie: false },
      { text: truths[1], isLie: false },
      { text: lie, isLie: true },
    ];
    const shuffled = this.shuffleArray(items);
    this.statements = shuffled.map((s) => s.text);
    this.lieIndex = shuffled.findIndex((s) => s.isLie);
    this.votes.clear();
    this.phase = "PRE_VOTE_TRANSITION";
    this.touch();
  }

  advanceFromTransition() {
    if (this.phase === "PRE_VOTE_TRANSITION") {
      this.phase = "VOTING";
    } else if (this.phase === "PRE_REVEAL_TRANSITION") {
      this.calculateScores();
      this.phase = "REVEAL";
    }
    this.touch();
  }

  castVote(playerId: string, voteIndex: number) {
    const currentId = this.turnOrder[this.currentPlayerIndex];
    if (playerId === currentId) {
      throw new Error("Submitter cannot vote");
    }
    if (this.votes.has(playerId)) {
      throw new Error("Already voted");
    }
    this.votes.set(playerId, voteIndex);
    this.touch();

    // Check if all connected non-submitter players have voted
    const eligibleVoters = this.players.filter(
      (p) => p.id !== currentId && p.connected
    );
    if (this.votes.size >= eligibleVoters.length) {
      this.phase = "PRE_REVEAL_TRANSITION";
    }
  }

  getVoteStatus(): { voted: string[]; pending: string[] } {
    const currentId = this.turnOrder[this.currentPlayerIndex];
    const voters = this.players.filter(
      (p) => p.id !== currentId && p.connected
    );
    const voted = voters
      .filter((p) => this.votes.has(p.id))
      .map((p) => p.name);
    const pending = voters
      .filter((p) => !this.votes.has(p.id))
      .map((p) => p.name);
    return { voted, pending };
  }

  private calculateScores() {
    const currentId = this.turnOrder[this.currentPlayerIndex];
    const submitter = this.players.find((p) => p.id === currentId)!;
    let fooledCount = 0;

    for (const [voterId, votedIdx] of this.votes.entries()) {
      const voter = this.players.find((p) => p.id === voterId)!;
      if (votedIdx === this.lieIndex) {
        voter.score += 1;
      } else {
        fooledCount++;
      }
    }
    submitter.score += fooledCount;
  }

  getRevealResults(): {
    lieIndex: number;
    statements: string[];
    results: VoteResult[];
    pointsThisTurn: TurnPoints;
  } {
    const currentId = this.turnOrder[this.currentPlayerIndex];
    const submitter = this.players.find((p) => p.id === currentId)!;
    const results: VoteResult[] = [];
    let submitterPoints = 0;
    const guessers: { name: string; points: number }[] = [];

    for (const [voterId, votedIdx] of this.votes.entries()) {
      const voter = this.players.find((p) => p.id === voterId)!;
      const correct = votedIdx === this.lieIndex;
      results.push({
        playerName: voter.name,
        votedIndex: votedIdx,
        correct,
      });
      if (correct) {
        guessers.push({ name: voter.name, points: 1 });
      } else {
        submitterPoints++;
      }
    }

    return {
      lieIndex: this.lieIndex,
      statements: this.statements,
      results,
      pointsThisTurn: {
        submitterName: submitter.name,
        submitterPoints,
        guessers,
      },
    };
  }

  advanceToScoreboard() {
    if (this.phase !== "REVEAL") return;
    this.phase = "SCOREBOARD";
    this.touch();
  }

  advanceFromScoreboard() {
    if (this.phase !== "SCOREBOARD") return;

    this.currentPlayerIndex++;

    // Check if the current round (cycle) is done
    if (this.currentPlayerIndex >= this.turnOrder.length) {
      this.currentRound++;
      if (this.currentRound > this.totalRounds) {
        this.phase = "GAME_OVER";
        return;
      }
      // New cycle: reshuffle turn order
      this.currentPlayerIndex = 0;
      this.turnOrder = this.shuffleArray(this.players.map((p) => p.id));
    }

    this.phase = "SUBMITTING";
    this.statements = [];
    this.lieIndex = -1;
    this.votes.clear();
    this.touch();
  }

  disconnectPlayer(playerId: string) {
    const player = this.players.find((p) => p.id === playerId);
    if (player) {
      player.connected = false;
    }
  }

  reconnectPlayer(oldId: string, newId: string) {
    const player = this.players.find((p) => p.id === oldId);
    if (player) {
      player.id = newId;
      player.connected = true;
      if (this.hostId === oldId) {
        this.hostId = newId;
      }
      const orderIdx = this.turnOrder.indexOf(oldId);
      if (orderIdx !== -1) {
        this.turnOrder[orderIdx] = newId;
      }
    }
  }

  skipDisconnectedSubmitter() {
    const currentId = this.turnOrder[this.currentPlayerIndex];
    const player = this.players.find((p) => p.id === currentId);
    if (player && !player.connected) {
      this.currentPlayerIndex++;
      if (this.currentPlayerIndex >= this.turnOrder.length) {
        this.currentRound++;
        if (this.currentRound > this.totalRounds) {
          this.phase = "GAME_OVER";
          return;
        }
        this.currentPlayerIndex = 0;
        this.turnOrder = this.shuffleArray(this.players.map((p) => p.id));
      }
    }
  }

  resetForNewGame() {
    this.players.forEach((p) => (p.score = 0));
    this.phase = "LOBBY";
    this.currentRound = 1;
    this.currentPlayerIndex = 0;
    this.statements = [];
    this.lieIndex = -1;
    this.votes.clear();
    this.turnOrder = [];
    this.touch();
  }

  getCurrentPlayerName(): string {
    const currentId = this.turnOrder[this.currentPlayerIndex];
    return this.players.find((p) => p.id === currentId)?.name ?? "";
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
```

**Step 4: Run tests — verify they pass**

Run: `cd server && npx vitest run`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add server/src/GameRoom.ts server/src/GameRoom.test.ts
git commit -m "add GameRoom state machine with tests"
```

---

### Task 4: RoomManager

Manages room creation, lookup, joining, and auto-cleanup.

**Files:**
- Create: `server/src/RoomManager.ts`
- Test: `server/src/RoomManager.test.ts`

**Step 1: Write tests**

Create `server/src/RoomManager.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { RoomManager } from "./RoomManager.js";

describe("RoomManager", () => {
  it("creates a room with a 4-letter code", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1", "Alice");
    expect(room.code).toMatch(/^[A-Z]{4}$/);
    expect(room.players).toHaveLength(1);
  });

  it("finds a room by code", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1", "Alice");
    expect(manager.findRoom(room.code)).toBe(room);
  });

  it("returns undefined for unknown code", () => {
    const manager = new RoomManager();
    expect(manager.findRoom("ZZZZ")).toBeUndefined();
  });

  it("finds room by player ID", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1", "Alice");
    expect(manager.findRoomByPlayerId("host-1")).toBe(room);
  });

  it("removes a room", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1", "Alice");
    manager.removeRoom(room.code);
    expect(manager.findRoom(room.code)).toBeUndefined();
  });

  it("generates unique codes", () => {
    const manager = new RoomManager();
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const room = manager.createRoom(`host-${i}`, `Player${i}`);
      codes.add(room.code);
    }
    expect(codes.size).toBe(20);
  });
});
```

**Step 2: Run tests — verify they fail**

Run: `cd server && npx vitest run`
Expected: FAIL — `RoomManager` not found.

**Step 3: Implement RoomManager**

Create `server/src/RoomManager.ts`:

```typescript
import { GameRoom } from "./GameRoom.js";

export class RoomManager {
  private rooms = new Map<string, GameRoom>();

  createRoom(hostId: string, hostName: string): GameRoom {
    const code = this.generateCode();
    const room = new GameRoom(code, hostId, hostName);
    this.rooms.set(code, room);
    return room;
  }

  findRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  findRoomByPlayerId(playerId: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.id === playerId)) {
        return room;
      }
    }
    return undefined;
  }

  removeRoom(code: string) {
    this.rooms.delete(code);
  }

  cleanupStaleRooms(timeoutMs = 30 * 60 * 1000) {
    for (const [code, room] of this.rooms.entries()) {
      if (room.isStale(timeoutMs)) {
        this.rooms.delete(code);
      }
    }
  }

  private generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O to avoid confusion
    let code: string;
    do {
      code = Array.from({ length: 4 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join("");
    } while (this.rooms.has(code));
    return code;
  }
}
```

**Step 4: Run tests — verify they pass**

Run: `cd server && npx vitest run`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add server/src/RoomManager.ts server/src/RoomManager.test.ts
git commit -m "add RoomManager for room lifecycle"
```

---

### Task 5: Server Entry Point — Express + Socket.IO

Wire up Express, Socket.IO, and all event handlers.

**Files:**
- Create: `server/src/index.ts`

**Step 1: Implement server with all event handlers**

Write `server/src/index.ts`:

```typescript
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { RoomManager } from "./RoomManager.js";
import type { ClientEvents, ServerEvents, RoomState } from "@lie-detector/shared";

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server<ClientEvents, ServerEvents>(httpServer, {
  cors: { origin: "*" },
});

const roomManager = new RoomManager();

// Cleanup stale rooms every 5 minutes
setInterval(() => roomManager.cleanupStaleRooms(), 5 * 60 * 1000);

function getRoomState(room: ReturnType<typeof roomManager.createRoom>): RoomState {
  return {
    code: room.code,
    phase: room.phase,
    players: room.players,
    hostId: room.hostId,
    totalRounds: room.totalRounds,
    currentRound: room.currentRound,
    currentPlayerIndex: room.currentPlayerIndex,
    currentPlayerName: room.getCurrentPlayerName(),
    turnOrder: room.turnOrder,
  };
}

io.on("connection", (socket) => {
  socket.on("create-room", ({ playerName }) => {
    try {
      const room = roomManager.createRoom(socket.id, playerName);
      socket.join(room.code);
      socket.emit("room-created", { roomCode: room.code });
      socket.emit("room-state", getRoomState(room));
    } catch (e: any) {
      socket.emit("error", { message: e.message });
    }
  });

  socket.on("join-room", ({ roomCode, playerName }) => {
    try {
      const room = roomManager.findRoom(roomCode);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }
      room.addPlayer(socket.id, playerName);
      socket.join(room.code);
      io.to(room.code).emit("player-joined", { players: room.players });
      socket.emit("room-state", getRoomState(room));
    } catch (e: any) {
      socket.emit("error", { message: e.message });
    }
  });

  socket.on("start-game", ({ totalRounds }) => {
    try {
      const room = roomManager.findRoomByPlayerId(socket.id);
      if (!room) return;
      room.startGame(totalRounds, socket.id);
      io.to(room.code).emit("phase-changed", {
        phase: room.phase,
        currentPlayerName: room.getCurrentPlayerName(),
      });
      io.to(room.code).emit("room-state", getRoomState(room));
    } catch (e: any) {
      socket.emit("error", { message: e.message });
    }
  });

  socket.on("submit-statements", ({ truths, lie }) => {
    try {
      const room = roomManager.findRoomByPlayerId(socket.id);
      if (!room) return;
      room.submitStatements(socket.id, truths, lie);
      io.to(room.code).emit("phase-changed", { phase: room.phase });

      // Auto-advance from transition after a delay
      setTimeout(() => {
        if (room.phase === "PRE_VOTE_TRANSITION") {
          room.advanceFromTransition();
          io.to(room.code).emit("phase-changed", {
            phase: room.phase,
            statements: room.statements,
          });
        }
      }, 3000);
    } catch (e: any) {
      socket.emit("error", { message: e.message });
    }
  });

  socket.on("cast-vote", ({ voteIndex }) => {
    try {
      const room = roomManager.findRoomByPlayerId(socket.id);
      if (!room) return;
      room.castVote(socket.id, voteIndex);

      const voteStatus = room.getVoteStatus();
      io.to(room.code).emit("vote-update", voteStatus);

      if (room.phase === "PRE_REVEAL_TRANSITION") {
        io.to(room.code).emit("phase-changed", { phase: room.phase });

        // Auto-advance from transition after a delay
        setTimeout(() => {
          if (room.phase === "PRE_REVEAL_TRANSITION") {
            room.advanceFromTransition();
            const results = room.getRevealResults();
            io.to(room.code).emit("phase-changed", {
              phase: room.phase,
              lieIndex: results.lieIndex,
              statements: results.statements,
              results: results.results,
              pointsThisTurn: results.pointsThisTurn,
            });
          }
        }, 3000);
      }
    } catch (e: any) {
      socket.emit("error", { message: e.message });
    }
  });

  socket.on("next-round", () => {
    try {
      const room = roomManager.findRoomByPlayerId(socket.id);
      if (!room) return;

      if (room.phase === "REVEAL") {
        room.advanceToScoreboard();
        io.to(room.code).emit("phase-changed", {
          phase: room.phase,
          scores: room.players,
        });
      } else if (room.phase === "SCOREBOARD") {
        room.advanceFromScoreboard();

        if (room.phase === "GAME_OVER") {
          io.to(room.code).emit("phase-changed", {
            phase: room.phase,
            scores: room.players,
          });
        } else {
          io.to(room.code).emit("phase-changed", {
            phase: room.phase,
            currentPlayerName: room.getCurrentPlayerName(),
          });
        }
        io.to(room.code).emit("room-state", getRoomState(room));
      }
    } catch (e: any) {
      socket.emit("error", { message: e.message });
    }
  });

  socket.on("play-again", () => {
    try {
      const room = roomManager.findRoomByPlayerId(socket.id);
      if (!room) return;
      room.resetForNewGame();
      io.to(room.code).emit("phase-changed", { phase: room.phase });
      io.to(room.code).emit("room-state", getRoomState(room));
    } catch (e: any) {
      socket.emit("error", { message: e.message });
    }
  });

  socket.on("disconnect", () => {
    const room = roomManager.findRoomByPlayerId(socket.id);
    if (!room) return;
    room.disconnectPlayer(socket.id);

    if (room.phase === "SUBMITTING") {
      const currentId = room.turnOrder[room.currentPlayerIndex];
      if (currentId === socket.id) {
        room.skipDisconnectedSubmitter();
        io.to(room.code).emit("phase-changed", {
          phase: room.phase,
          currentPlayerName: room.getCurrentPlayerName(),
        });
      }
    }

    if (room.phase === "VOTING") {
      // Recheck if all remaining connected players have voted
      const voteStatus = room.getVoteStatus();
      io.to(room.code).emit("vote-update", voteStatus);
      if (voteStatus.pending.length === 0 && room.phase === "PRE_REVEAL_TRANSITION") {
        io.to(room.code).emit("phase-changed", { phase: room.phase });
      }
    }

    io.to(room.code).emit("player-joined", { players: room.players });

    // Clean up empty rooms
    if (room.players.every((p) => !p.connected)) {
      roomManager.removeRoom(room.code);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Step 2: Verify server compiles**

Run: `cd server && npx tsc --noEmit`
Expected: No errors.

**Step 3: Verify server starts**

Run: `cd server && npx tsx src/index.ts`
Expected: "Server running on port 3001"
Stop the server (Ctrl+C).

**Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "add server entry point with Socket.IO event handlers"
```

---

### Task 6: Client — Socket Context and Game State Hook

Set up Socket.IO connection and game state management on the client.

**Files:**
- Create: `client/src/context/SocketContext.tsx`
- Create: `client/src/hooks/useGameState.ts`

**Step 1: Create Socket context**

Create `client/src/context/SocketContext.tsx`:

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import type { ClientEvents, ServerEvents } from "@lie-detector/shared";

type GameSocket = Socket<ServerEvents, ClientEvents>;

const SocketContext = createContext<GameSocket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket] = useState<GameSocket>(() =>
    io("http://localhost:3001", { autoConnect: false })
  );

  useEffect(() => {
    socket.connect();
    return () => { socket.disconnect(); };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket(): GameSocket {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error("useSocket must be used within SocketProvider");
  return socket;
}
```

**Step 2: Create game state hook**

Create `client/src/hooks/useGameState.ts`:

```typescript
import { useEffect, useState, useCallback } from "react";
import { useSocket } from "../context/SocketContext";
import type { GamePhase, Player, PhaseData, RoomState } from "@lie-detector/shared";

export interface GameState {
  phase: GamePhase | null;
  roomCode: string | null;
  players: Player[];
  hostId: string | null;
  myId: string | null;
  currentPlayerName: string;
  totalRounds: number;
  currentRound: number;
  phaseData: PhaseData | null;
  voteStatus: { voted: string[]; pending: string[] } | null;
  error: string | null;
}

export function useGameState() {
  const socket = useSocket();
  const [state, setState] = useState<GameState>({
    phase: null,
    roomCode: null,
    players: [],
    hostId: null,
    myId: null,
    currentPlayerName: "",
    totalRounds: 1,
    currentRound: 1,
    phaseData: null,
    voteStatus: null,
    error: null,
  });

  useEffect(() => {
    setState((s) => ({ ...s, myId: socket.id ?? null }));

    socket.on("connect", () => {
      setState((s) => ({ ...s, myId: socket.id ?? null }));
    });

    socket.on("room-created", ({ roomCode }) => {
      setState((s) => ({ ...s, roomCode, error: null }));
    });

    socket.on("room-state", (roomState: RoomState) => {
      setState((s) => ({
        ...s,
        phase: roomState.phase,
        roomCode: roomState.code,
        players: roomState.players,
        hostId: roomState.hostId,
        currentPlayerName: roomState.currentPlayerName,
        totalRounds: roomState.totalRounds,
        currentRound: roomState.currentRound,
        error: null,
      }));
    });

    socket.on("player-joined", ({ players }) => {
      setState((s) => ({ ...s, players }));
    });

    socket.on("phase-changed", (data: PhaseData) => {
      setState((s) => ({
        ...s,
        phase: data.phase,
        phaseData: data,
        currentPlayerName: data.currentPlayerName ?? s.currentPlayerName,
        voteStatus: null,
        error: null,
      }));
    });

    socket.on("vote-update", (status) => {
      setState((s) => ({ ...s, voteStatus: status }));
    });

    socket.on("error", ({ message }) => {
      setState((s) => ({ ...s, error: message }));
    });

    return () => {
      socket.off("connect");
      socket.off("room-created");
      socket.off("room-state");
      socket.off("player-joined");
      socket.off("phase-changed");
      socket.off("vote-update");
      socket.off("error");
    };
  }, [socket]);

  const createRoom = useCallback(
    (playerName: string) => socket.emit("create-room", { playerName }),
    [socket]
  );

  const joinRoom = useCallback(
    (roomCode: string, playerName: string) =>
      socket.emit("join-room", { roomCode, playerName }),
    [socket]
  );

  const startGame = useCallback(
    (totalRounds: number) => socket.emit("start-game", { totalRounds }),
    [socket]
  );

  const submitStatements = useCallback(
    (truths: [string, string], lie: string) =>
      socket.emit("submit-statements", { truths, lie }),
    [socket]
  );

  const castVote = useCallback(
    (voteIndex: number) => socket.emit("cast-vote", { voteIndex }),
    [socket]
  );

  const nextRound = useCallback(() => socket.emit("next-round"), [socket]);

  const playAgain = useCallback(() => socket.emit("play-again"), [socket]);

  const clearError = useCallback(
    () => setState((s) => ({ ...s, error: null })),
    []
  );

  return {
    ...state,
    isHost: state.myId === state.hostId,
    isMyTurn:
      state.players.find((p) => p.id === state.myId)?.name ===
      state.currentPlayerName,
    createRoom,
    joinRoom,
    startGame,
    submitStatements,
    castVote,
    nextRound,
    playAgain,
    clearError,
  };
}
```

**Step 3: Verify client compiles**

Run: `cd client && npx tsc --noEmit`
Expected: No errors.

**Step 4: Commit**

```bash
git add client/src/context/SocketContext.tsx client/src/hooks/useGameState.ts
git commit -m "add socket context and game state hook"
```

---

### Task 7: Client — Home Screen

The landing page with Create/Join game options.

**Files:**
- Create: `client/src/components/HomeScreen.tsx`

**Step 1: Implement HomeScreen**

Create `client/src/components/HomeScreen.tsx`:

```tsx
import { useState } from "react";

interface Props {
  onCreateRoom: (name: string) => void;
  onJoinRoom: (code: string, name: string) => void;
  error: string | null;
  onClearError: () => void;
}

export function HomeScreen({ onCreateRoom, onJoinRoom, error, onClearError }: Props) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreateRoom(name.trim());
  };

  const handleJoin = () => {
    if (!name.trim() || !roomCode.trim()) return;
    onJoinRoom(roomCode.trim().toUpperCase(), name.trim());
  };

  if (mode === "menu") {
    return (
      <div className="screen home-screen">
        <h1>Lie Detector</h1>
        <p>Two Truths and a Lie</p>
        <div className="button-group">
          <button onClick={() => { onClearError(); setMode("create"); }}>
            Create Game
          </button>
          <button onClick={() => { onClearError(); setMode("join"); }}>
            Join Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen home-screen">
      <h1>Lie Detector</h1>
      <div className="form">
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus
        />
        {mode === "join" && (
          <input
            type="text"
            placeholder="Room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={4}
          />
        )}
        {error && <p className="error">{error}</p>}
        <button
          onClick={mode === "create" ? handleCreate : handleJoin}
          disabled={!name.trim() || (mode === "join" && roomCode.length < 4)}
        >
          {mode === "create" ? "Create Room" : "Join Room"}
        </button>
        <button className="secondary" onClick={() => setMode("menu")}>
          Back
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add client/src/components/HomeScreen.tsx
git commit -m "add HomeScreen component"
```

---

### Task 8: Client — Lobby Screen

Shows room code, player list, round selector, and start button for host.

**Files:**
- Create: `client/src/components/LobbyScreen.tsx`

**Step 1: Implement LobbyScreen**

Create `client/src/components/LobbyScreen.tsx`:

```tsx
import { useState } from "react";
import type { Player } from "@lie-detector/shared";

interface Props {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  onStartGame: (totalRounds: number) => void;
}

export function LobbyScreen({ roomCode, players, isHost, onStartGame }: Props) {
  const [rounds, setRounds] = useState(1);
  const canStart = players.length >= 3;

  return (
    <div className="screen lobby-screen">
      <div className="room-code">
        <p>Room Code</p>
        <h1>{roomCode}</h1>
      </div>

      <div className="player-list">
        <h3>Players ({players.length})</h3>
        <ul>
          {players.map((p) => (
            <li key={p.id}>
              {p.name} {p.id === players[0]?.id ? "(Host)" : ""}
            </li>
          ))}
        </ul>
      </div>

      {isHost && (
        <div className="host-controls">
          <label>
            Rounds:
            <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "round" : "rounds"} ({n * players.length} turns)
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => onStartGame(rounds)} disabled={!canStart}>
            {canStart ? "Start Game" : `Need ${3 - players.length} more player(s)`}
          </button>
        </div>
      )}

      {!isHost && <p>Waiting for host to start the game...</p>}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add client/src/components/LobbyScreen.tsx
git commit -m "add LobbyScreen component"
```

---

### Task 9: Client — Game Phase Screens

Implement all in-game screens: Submitting, Transition, Voting, Reveal, Scoreboard, GameOver.

**Files:**
- Create: `client/src/components/SubmittingScreen.tsx`
- Create: `client/src/components/TransitionScreen.tsx`
- Create: `client/src/components/VotingScreen.tsx`
- Create: `client/src/components/RevealScreen.tsx`
- Create: `client/src/components/ScoreboardScreen.tsx`
- Create: `client/src/components/GameOverScreen.tsx`

**Step 1: SubmittingScreen**

Create `client/src/components/SubmittingScreen.tsx`:

```tsx
import { useState } from "react";

interface Props {
  isMyTurn: boolean;
  currentPlayerName: string;
  onSubmit: (truths: [string, string], lie: string) => void;
}

export function SubmittingScreen({ isMyTurn, currentPlayerName, onSubmit }: Props) {
  const [truth1, setTruth1] = useState("");
  const [truth2, setTruth2] = useState("");
  const [lie, setLie] = useState("");

  const canSubmit = truth1.trim() && truth2.trim() && lie.trim();

  if (!isMyTurn) {
    return (
      <div className="screen submitting-screen">
        <h2>{currentPlayerName} is writing their statements...</h2>
        <div className="waiting-indicator">
          <span className="dots">...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="screen submitting-screen">
      <h2>Your Turn!</h2>
      <p>Write 2 truths and 1 lie about yourself</p>
      <div className="form">
        <label>
          Truth #1
          <input
            type="text"
            value={truth1}
            onChange={(e) => setTruth1(e.target.value)}
            placeholder="Something true about you"
            maxLength={200}
          />
        </label>
        <label>
          Truth #2
          <input
            type="text"
            value={truth2}
            onChange={(e) => setTruth2(e.target.value)}
            placeholder="Another true thing"
            maxLength={200}
          />
        </label>
        <label>
          Your Lie
          <input
            type="text"
            value={lie}
            onChange={(e) => setLie(e.target.value)}
            placeholder="Make it believable!"
            maxLength={200}
          />
        </label>
        <button
          onClick={() => onSubmit([truth1.trim(), truth2.trim()], lie.trim())}
          disabled={!canSubmit}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
```

**Step 2: TransitionScreen**

Create `client/src/components/TransitionScreen.tsx`:

```tsx
interface Props {
  type: "pre-vote" | "pre-reveal";
}

export function TransitionScreen({ type }: Props) {
  return (
    <div className="screen transition-screen">
      <h2>{type === "pre-vote" ? "Time to Vote!" : "Results are in!"}</h2>
      <div className="transition-animation">
        <span className="pulse">●</span>
      </div>
    </div>
  );
}
```

**Step 3: VotingScreen**

Create `client/src/components/VotingScreen.tsx`:

```tsx
import { useState } from "react";

interface Props {
  statements: string[];
  isSubmitter: boolean;
  voteStatus: { voted: string[]; pending: string[] } | null;
  onVote: (index: number) => void;
}

export function VotingScreen({ statements, isSubmitter, voteStatus, onVote }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (isSubmitter) {
    return (
      <div className="screen voting-screen">
        <h2>Others are voting on your statements...</h2>
        {voteStatus && (
          <div className="vote-status">
            <p>Voted: {voteStatus.voted.join(", ") || "—"}</p>
            <p>Waiting: {voteStatus.pending.join(", ") || "—"}</p>
          </div>
        )}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="screen voting-screen">
        <h2>Vote submitted!</h2>
        {voteStatus && (
          <div className="vote-status">
            <p>Voted: {voteStatus.voted.join(", ") || "—"}</p>
            <p>Waiting: {voteStatus.pending.join(", ") || "—"}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="screen voting-screen">
      <h2>Which one is the lie?</h2>
      <div className="statements">
        {statements.map((s, i) => (
          <button
            key={i}
            className={`statement-card ${selected === i ? "selected" : ""}`}
            onClick={() => setSelected(i)}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>
      <button
        className="submit-vote"
        disabled={selected === null}
        onClick={() => {
          if (selected !== null) {
            onVote(selected);
            setSubmitted(true);
          }
        }}
      >
        Submit Vote
      </button>
    </div>
  );
}
```

**Step 4: RevealScreen**

Create `client/src/components/RevealScreen.tsx`:

```tsx
import type { VoteResult, TurnPoints } from "@lie-detector/shared";

interface Props {
  statements: string[];
  lieIndex: number;
  results: VoteResult[];
  pointsThisTurn: TurnPoints;
  isHost: boolean;
  onNext: () => void;
}

export function RevealScreen({
  statements,
  lieIndex,
  results,
  pointsThisTurn,
  isHost,
  onNext,
}: Props) {
  return (
    <div className="screen reveal-screen">
      <h2>The Lie Was...</h2>
      <div className="statements">
        {statements.map((s, i) => (
          <div
            key={i}
            className={`statement-card ${i === lieIndex ? "is-lie" : "is-truth"}`}
          >
            {i + 1}. {s}
            <span className="label">{i === lieIndex ? "LIE" : "TRUTH"}</span>
          </div>
        ))}
      </div>

      <div className="results">
        <h3>Votes</h3>
        <ul>
          {results.map((r) => (
            <li key={r.playerName} className={r.correct ? "correct" : "wrong"}>
              {r.playerName}: {r.correct ? "Got it!" : "Fooled!"}
            </li>
          ))}
        </ul>
      </div>

      <div className="points">
        <h3>Points This Turn</h3>
        {pointsThisTurn.submitterPoints > 0 && (
          <p>
            {pointsThisTurn.submitterName} fooled {pointsThisTurn.submitterPoints}{" "}
            player(s) (+{pointsThisTurn.submitterPoints})
          </p>
        )}
        {pointsThisTurn.guessers.map((g) => (
          <p key={g.name}>
            {g.name} guessed correctly (+{g.points})
          </p>
        ))}
      </div>

      {isHost && (
        <button onClick={onNext}>Scoreboard →</button>
      )}
      {!isHost && <p>Waiting for host...</p>}
    </div>
  );
}
```

**Step 5: ScoreboardScreen**

Create `client/src/components/ScoreboardScreen.tsx`:

```tsx
import type { Player } from "@lie-detector/shared";

interface Props {
  players: Player[];
  currentRound: number;
  totalRounds: number;
  isHost: boolean;
  onNext: () => void;
}

export function ScoreboardScreen({
  players,
  currentRound,
  totalRounds,
  isHost,
  onNext,
}: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="screen scoreboard-screen">
      <h2>Scoreboard</h2>
      <p>
        Round {currentRound} of {totalRounds}
      </p>
      <div className="scores">
        {sorted.map((p, i) => (
          <div key={p.id} className="score-row">
            <span className="rank">#{i + 1}</span>
            <span className="name">{p.name}</span>
            <span className="score">{p.score} pts</span>
          </div>
        ))}
      </div>
      {isHost && <button onClick={onNext}>Next Turn →</button>}
      {!isHost && <p>Waiting for host...</p>}
    </div>
  );
}
```

**Step 6: GameOverScreen**

Create `client/src/components/GameOverScreen.tsx`:

```tsx
import type { Player } from "@lie-detector/shared";

interface Props {
  players: Player[];
  isHost: boolean;
  onPlayAgain: () => void;
}

export function GameOverScreen({ players, isHost, onPlayAgain }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  return (
    <div className="screen gameover-screen">
      <h2>Game Over!</h2>
      <div className="winner">
        <h3>{winner.name} wins!</h3>
        <p>{winner.score} points</p>
      </div>
      <div className="final-scores">
        {sorted.map((p, i) => (
          <div key={p.id} className="score-row">
            <span className="rank">#{i + 1}</span>
            <span className="name">{p.name}</span>
            <span className="score">{p.score} pts</span>
          </div>
        ))}
      </div>
      {isHost && <button onClick={onPlayAgain}>Play Again</button>}
      {!isHost && <p>Waiting for host...</p>}
    </div>
  );
}
```

**Step 7: Commit**

```bash
git add client/src/components/SubmittingScreen.tsx \
        client/src/components/TransitionScreen.tsx \
        client/src/components/VotingScreen.tsx \
        client/src/components/RevealScreen.tsx \
        client/src/components/ScoreboardScreen.tsx \
        client/src/components/GameOverScreen.tsx
git commit -m "add all game phase screen components"
```

---

### Task 10: Client — App Component and Wiring

Wire all screens together in App.tsx with phase-based rendering.

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/main.tsx`
- Modify: `client/src/App.css` (replace with game styles)

**Step 1: Update main.tsx with SocketProvider**

Replace `client/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SocketProvider } from "./context/SocketContext";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </StrictMode>
);
```

**Step 2: Implement App.tsx with phase routing**

Replace `client/src/App.tsx`:

```tsx
import { useGameState } from "./hooks/useGameState";
import { HomeScreen } from "./components/HomeScreen";
import { LobbyScreen } from "./components/LobbyScreen";
import { SubmittingScreen } from "./components/SubmittingScreen";
import { TransitionScreen } from "./components/TransitionScreen";
import { VotingScreen } from "./components/VotingScreen";
import { RevealScreen } from "./components/RevealScreen";
import { ScoreboardScreen } from "./components/ScoreboardScreen";
import { GameOverScreen } from "./components/GameOverScreen";
import "./App.css";

function App() {
  const game = useGameState();

  if (!game.phase) {
    return (
      <HomeScreen
        onCreateRoom={game.createRoom}
        onJoinRoom={game.joinRoom}
        error={game.error}
        onClearError={game.clearError}
      />
    );
  }

  switch (game.phase) {
    case "LOBBY":
      return (
        <LobbyScreen
          roomCode={game.roomCode!}
          players={game.players}
          isHost={game.isHost}
          onStartGame={game.startGame}
        />
      );

    case "SUBMITTING":
      return (
        <SubmittingScreen
          isMyTurn={game.isMyTurn}
          currentPlayerName={game.currentPlayerName}
          onSubmit={game.submitStatements}
        />
      );

    case "PRE_VOTE_TRANSITION":
      return <TransitionScreen type="pre-vote" />;

    case "VOTING":
      return (
        <VotingScreen
          statements={game.phaseData?.statements ?? []}
          isSubmitter={game.isMyTurn}
          voteStatus={game.voteStatus}
          onVote={game.castVote}
        />
      );

    case "PRE_REVEAL_TRANSITION":
      return <TransitionScreen type="pre-reveal" />;

    case "REVEAL":
      return (
        <RevealScreen
          statements={game.phaseData?.statements ?? []}
          lieIndex={game.phaseData?.lieIndex ?? 0}
          results={game.phaseData?.results ?? []}
          pointsThisTurn={game.phaseData?.pointsThisTurn ?? { submitterName: "", submitterPoints: 0, guessers: [] }}
          isHost={game.isHost}
          onNext={game.nextRound}
        />
      );

    case "SCOREBOARD":
      return (
        <ScoreboardScreen
          players={game.phaseData?.scores ?? game.players}
          currentRound={game.currentRound}
          totalRounds={game.totalRounds}
          isHost={game.isHost}
          onNext={game.nextRound}
        />
      );

    case "GAME_OVER":
      return (
        <GameOverScreen
          players={game.phaseData?.scores ?? game.players}
          isHost={game.isHost}
          onPlayAgain={game.playAgain}
        />
      );

    default:
      return <div>Unknown phase</div>;
  }
}

export default App;
```

**Step 3: Add base styles**

Replace `client/src/App.css` with mobile-first game styles:

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #1a1a2e;
  color: #eee;
  min-height: 100dvh;
}

#root {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.screen {
  width: 100%;
  max-width: 480px;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  text-align: center;
}

h1 {
  font-size: 2.5rem;
  color: #e94560;
}

h2 {
  font-size: 1.5rem;
  color: #e94560;
}

h3 {
  font-size: 1.2rem;
  color: #ccc;
}

button {
  background: #e94560;
  color: white;
  border: none;
  padding: 0.9rem 2rem;
  border-radius: 12px;
  font-size: 1.1rem;
  cursor: pointer;
  width: 100%;
  max-width: 320px;
  transition: opacity 0.2s;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

button:active:not(:disabled) {
  opacity: 0.8;
}

button.secondary {
  background: transparent;
  border: 2px solid #555;
  color: #ccc;
}

input, select {
  width: 100%;
  max-width: 320px;
  padding: 0.8rem 1rem;
  border-radius: 10px;
  border: 2px solid #333;
  background: #16213e;
  color: #eee;
  font-size: 1rem;
}

input:focus, select:focus {
  outline: none;
  border-color: #e94560;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 320px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 320px;
}

.form label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  text-align: left;
  font-size: 0.9rem;
  color: #aaa;
}

.error {
  color: #ff6b6b;
  font-size: 0.9rem;
}

/* Lobby */
.room-code h1 {
  font-size: 3.5rem;
  letter-spacing: 0.5rem;
  color: #e94560;
}

.player-list ul {
  list-style: none;
  padding: 0;
}

.player-list li {
  padding: 0.5rem 0;
  font-size: 1.1rem;
}

.host-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 320px;
}

.host-controls label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  color: #aaa;
  font-size: 0.9rem;
}

/* Transition */
.transition-screen {
  justify-content: center;
}

.pulse {
  display: inline-block;
  font-size: 3rem;
  color: #e94560;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

/* Voting */
.statements {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-width: 400px;
}

.statement-card {
  background: #16213e;
  border: 2px solid #333;
  text-align: left;
  padding: 1rem;
  font-size: 1rem;
}

.statement-card.selected {
  border-color: #e94560;
  background: #1a1a3e;
}

button.submit-vote {
  margin-top: 0.5rem;
}

.vote-status {
  color: #aaa;
  font-size: 0.9rem;
}

/* Reveal */
.statement-card.is-lie {
  border-color: #e94560;
  background: rgba(233, 69, 96, 0.15);
}

.statement-card.is-truth {
  border-color: #4ecca3;
  background: rgba(78, 204, 163, 0.1);
}

.statement-card .label {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  font-weight: bold;
  text-transform: uppercase;
}

.is-lie .label { color: #e94560; }
.is-truth .label { color: #4ecca3; }

.results ul {
  list-style: none;
  padding: 0;
}

.results li {
  padding: 0.3rem 0;
}

.results .correct { color: #4ecca3; }
.results .wrong { color: #e94560; }

.points p {
  color: #ccc;
  font-size: 0.95rem;
}

/* Scoreboard */
.scores, .final-scores {
  width: 100%;
  max-width: 320px;
}

.score-row {
  display: flex;
  justify-content: space-between;
  padding: 0.6rem 0;
  border-bottom: 1px solid #333;
  font-size: 1.1rem;
}

.score-row .rank {
  color: #e94560;
  width: 2.5rem;
  text-align: left;
}

.score-row .name {
  flex: 1;
  text-align: left;
}

.score-row .score {
  color: #4ecca3;
}

/* Winner */
.winner {
  padding: 1.5rem;
  border: 2px solid #e94560;
  border-radius: 16px;
  background: rgba(233, 69, 96, 0.1);
}

.winner h3 {
  color: #e94560;
  font-size: 1.5rem;
}

/* Waiting dots animation */
.dots {
  display: inline-block;
  animation: dots 1.5s steps(4, end) infinite;
  width: 1.5em;
  text-align: left;
  overflow: hidden;
  vertical-align: bottom;
}

@keyframes dots {
  0% { width: 0; }
  100% { width: 1.5em; }
}
```

**Step 4: Clean up unused Vite boilerplate**

Delete these files if they exist:
- `client/src/assets/react.svg`
- `client/public/vite.svg`

Replace `client/src/index.css`:

```css
:root {
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

Replace `client/index.html` title to "Lie Detector".

**Step 5: Verify full client builds**

Run: `cd client && npm run build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add client/src/App.tsx client/src/App.css client/src/main.tsx client/src/index.css client/index.html
git add -u client/  # stage any deletions
git commit -m "wire up App with phase routing and base styles"
```

---

### Task 11: Integration Smoke Test

Verify the full game works end-to-end by running both server and client.

**Step 1: Start the server**

Run: `cd server && npx tsx src/index.ts`
Expected: "Server running on port 3001"

**Step 2: Start the client**

In another terminal:
Run: `cd client && npm run dev`
Expected: Vite dev server starts on localhost:5173 (or similar)

**Step 3: Manual smoke test**

Open 3 browser tabs to the client URL:
1. Tab 1: Create game as "Alice" → copy room code
2. Tab 2: Join room as "Bob"
3. Tab 3: Join room as "Charlie"
4. Tab 1: Start game (1 round)
5. First player's tab: enter 2 truths and a lie, submit
6. Verify transition screen appears on all tabs
7. Other 2 tabs: vote on the lie
8. Verify transition screen, then reveal, then scoreboard
9. Continue through all 3 turns
10. Verify game over screen with final scores

**Step 4: Fix any issues found**

Address any bugs found during smoke testing.

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix issues found during smoke testing"
```

---

### Task 12: Run All Tests

Final verification that all tests pass.

**Step 1: Run server tests**

Run: `cd server && npx vitest run`
Expected: All tests pass.

**Step 2: Verify client builds**

Run: `cd client && npm run build`
Expected: Build succeeds with no errors.

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "all tests passing, build clean"
```
