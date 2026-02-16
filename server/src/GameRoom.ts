import type {
  GamePhase,
  Player,
  VoteResult,
  TurnPoints,
} from "@lie-detector/shared";

interface Vote {
  playerId: string;
  voteIndex: number;
}

export class GameRoom {
  // ─── Public state ────────────────────────────────────────────────

  code: string;
  phase: GamePhase;
  players: Player[];
  hostId: string;
  totalRounds: number;
  currentRound: number;
  currentPlayerIndex: number;
  turnOrder: string[];

  // ─── Turn state ──────────────────────────────────────────────────

  currentStatements: string[] | null;
  lieIndex: number | null;
  private votes: Vote[];
  private revealResults: {
    lieIndex: number;
    statements: string[];
    results: VoteResult[];
    pointsThisTurn: TurnPoints;
  } | null;

  // ─── Activity tracking ──────────────────────────────────────────

  private lastActivity: number;

  // ─── Constructor ─────────────────────────────────────────────────

  constructor(code: string, hostId: string, hostName: string) {
    this.code = code;
    this.hostId = hostId;
    this.phase = "LOBBY";
    this.players = [
      { id: hostId, name: hostName, score: 0, connected: true },
    ];
    this.totalRounds = 0;
    this.currentRound = 0;
    this.currentPlayerIndex = 0;
    this.turnOrder = [];
    this.currentStatements = null;
    this.lieIndex = null;
    this.votes = [];
    this.revealResults = null;
    this.lastActivity = Date.now();
  }

  // ─── Player management ──────────────────────────────────────────

  addPlayer(id: string, name: string): void {
    if (this.phase !== "LOBBY") {
      throw new Error("Game has already started");
    }
    if (this.players.some((p) => p.name === name)) {
      throw new Error("Name is already taken");
    }
    this.players.push({ id, name, score: 0, connected: true });
    this.touch();
  }

  // ─── Start game ─────────────────────────────────────────────────

  startGame(totalRounds: number, requesterId?: string): void {
    if (requesterId && requesterId !== this.hostId) {
      throw new Error("Only the host can start the game");
    }
    if (this.players.length < 3) {
      throw new Error("Need at least 3 players to start");
    }

    this.totalRounds = totalRounds;
    this.currentRound = 1;
    this.currentPlayerIndex = 0;
    this.turnOrder = this.players.map((p) => p.id);
    this.shuffleArray(this.turnOrder);
    this.phase = "SUBMITTING";
    this.touch();
  }

  // ─── Submit statements ──────────────────────────────────────────

  submitStatements(
    playerId: string,
    truths: [string, string],
    lie: string
  ): void {
    const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
    if (playerId !== currentPlayerId) {
      throw new Error("Not your turn to submit");
    }

    // Build statements array and shuffle to randomize lie position
    const statements: string[] = [truths[0], truths[1], lie];
    // Track original lie position before shuffle
    const lieMarker = lie;

    this.shuffleArray(statements);
    this.currentStatements = statements;
    this.lieIndex = statements.indexOf(lieMarker);
    this.votes = [];
    this.revealResults = null;

    this.phase = "PRE_VOTE_TRANSITION";
    this.touch();
  }

  // ─── Advance from transition phases ─────────────────────────────

  advanceFromTransition(): void {
    if (this.phase === "PRE_VOTE_TRANSITION") {
      this.phase = "VOTING";
    } else if (this.phase === "PRE_REVEAL_TRANSITION") {
      this.calculateScores();
      this.phase = "REVEAL";
    } else {
      throw new Error(
        `Cannot advance from transition in phase: ${this.phase}`
      );
    }
    this.touch();
  }

  // ─── Cast vote ──────────────────────────────────────────────────

  castVote(playerId: string, voteIndex: number): void {
    const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
    if (playerId === currentPlayerId) {
      throw new Error("The submitter cannot vote on their own statements");
    }

    // Record vote
    this.votes.push({ playerId, voteIndex });

    // Check if all connected non-submitters have voted
    const connectedNonSubmitters = this.players.filter(
      (p) => p.id !== currentPlayerId && p.connected
    );
    const allVoted = connectedNonSubmitters.every((p) =>
      this.votes.some((v) => v.playerId === p.id)
    );

    if (allVoted) {
      this.phase = "PRE_REVEAL_TRANSITION";
    }
    this.touch();
  }

  // ─── Vote status ────────────────────────────────────────────────

  getVoteStatus(): { voted: string[]; pending: string[] } {
    const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
    const nonSubmitters = this.players.filter(
      (p) => p.id !== currentPlayerId && p.connected
    );

    const votedIds = new Set(this.votes.map((v) => v.playerId));

    const voted: string[] = [];
    const pending: string[] = [];

    for (const player of nonSubmitters) {
      if (votedIds.has(player.id)) {
        voted.push(player.name);
      } else {
        pending.push(player.name);
      }
    }

    return { voted, pending };
  }

  // ─── Calculate scores ───────────────────────────────────────────

  private calculateScores(): void {
    const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
    const submitter = this.players.find((p) => p.id === currentPlayerId)!;
    const lieIdx = this.lieIndex!;

    let submitterPoints = 0;
    const results: VoteResult[] = [];
    const guessers: { name: string; points: number }[] = [];

    for (const vote of this.votes) {
      const voter = this.players.find((p) => p.id === vote.playerId)!;
      const correct = vote.voteIndex === lieIdx;

      if (correct) {
        voter.score += 1;
        guessers.push({ name: voter.name, points: 1 });
      } else {
        submitter.score += 1;
        submitterPoints += 1;
        guessers.push({ name: voter.name, points: 0 });
      }

      results.push({
        playerName: voter.name,
        votedIndex: vote.voteIndex,
        correct,
      });
    }

    this.revealResults = {
      lieIndex: lieIdx,
      statements: this.currentStatements!,
      results,
      pointsThisTurn: {
        submitterName: submitter.name,
        submitterPoints,
        guessers,
      },
    };
  }

  // ─── Get reveal results ─────────────────────────────────────────

  getRevealResults(): {
    lieIndex: number;
    statements: string[];
    results: VoteResult[];
    pointsThisTurn: TurnPoints;
  } {
    if (!this.revealResults) {
      throw new Error("No reveal results available");
    }
    return this.revealResults;
  }

  // ─── Advance to scoreboard ──────────────────────────────────────

  advanceToScoreboard(): void {
    if (this.phase !== "REVEAL") {
      throw new Error(
        `Cannot advance to scoreboard from phase: ${this.phase}`
      );
    }
    this.phase = "SCOREBOARD";
    this.touch();
  }

  // ─── Advance from scoreboard ────────────────────────────────────

  advanceFromScoreboard(): void {
    if (this.phase !== "SCOREBOARD") {
      throw new Error(
        `Cannot advance from scoreboard in phase: ${this.phase}`
      );
    }

    this.currentPlayerIndex += 1;

    // Check if the current round (cycle) is complete
    if (this.currentPlayerIndex >= this.turnOrder.length) {
      // All players have had a turn this round
      if (this.currentRound >= this.totalRounds) {
        // All rounds done
        this.phase = "GAME_OVER";
      } else {
        // Start a new round with reshuffled turn order
        this.currentRound += 1;
        this.currentPlayerIndex = 0;
        this.shuffleArray(this.turnOrder);
        this.phase = "SUBMITTING";
      }
    } else {
      this.phase = "SUBMITTING";
    }

    // Reset turn state
    this.currentStatements = null;
    this.lieIndex = null;
    this.votes = [];
    this.revealResults = null;
    this.touch();
  }

  // ─── Disconnect handling ────────────────────────────────────────

  disconnectPlayer(playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (player) {
      player.connected = false;
    }
    this.touch();
  }

  // ─── Reconnect player ──────────────────────────────────────────

  reconnectPlayer(oldId: string, newId: string): void {
    const player = this.players.find((p) => p.id === oldId);
    if (player) {
      player.id = newId;
      player.connected = true;
    }

    // Update host id if applicable
    if (this.hostId === oldId) {
      this.hostId = newId;
    }

    // Update turn order
    const turnIdx = this.turnOrder.indexOf(oldId);
    if (turnIdx !== -1) {
      this.turnOrder[turnIdx] = newId;
    }
    this.touch();
  }

  // ─── Skip disconnected submitter ────────────────────────────────

  skipDisconnectedSubmitter(): void {
    const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
    const currentPlayer = this.players.find(
      (p) => p.id === currentPlayerId
    );
    if (currentPlayer && !currentPlayer.connected) {
      this.currentPlayerIndex += 1;

      if (this.currentPlayerIndex >= this.turnOrder.length) {
        if (this.currentRound >= this.totalRounds) {
          this.phase = "GAME_OVER";
        } else {
          this.currentRound += 1;
          this.currentPlayerIndex = 0;
          this.shuffleArray(this.turnOrder);
        }
      }

      // Keep phase as SUBMITTING (or GAME_OVER if ended)
      if (this.phase !== "GAME_OVER") {
        this.phase = "SUBMITTING";
      }
    }
    this.touch();
  }

  // ─── Reset for new game ─────────────────────────────────────────

  resetForNewGame(): void {
    this.phase = "LOBBY";
    this.totalRounds = 0;
    this.currentRound = 0;
    this.currentPlayerIndex = 0;
    this.turnOrder = [];
    this.currentStatements = null;
    this.lieIndex = null;
    this.votes = [];
    this.revealResults = null;

    for (const player of this.players) {
      player.score = 0;
    }
    this.touch();
  }

  // ─── Get current player name ────────────────────────────────────

  getCurrentPlayerName(): string {
    const currentPlayerId = this.turnOrder[this.currentPlayerIndex];
    const player = this.players.find((p) => p.id === currentPlayerId);
    return player ? player.name : "";
  }

  // ─── Activity tracking ──────────────────────────────────────────

  touch(): void {
    this.lastActivity = Date.now();
  }

  isStale(timeoutMs: number): boolean {
    return Date.now() - this.lastActivity > timeoutMs;
  }

  // ─── Private helpers ────────────────────────────────────────────

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
