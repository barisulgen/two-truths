import { describe, it, expect, beforeEach } from "vitest";
import { GameRoom } from "./GameRoom.js";

describe("GameRoom", () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom("ABCD", "host-1", "Alice");
  });

  // ─── Room creation and players ───────────────────────────────────

  describe("room creation and players", () => {
    it("creates a room with a code and host", () => {
      expect(room.code).toBe("ABCD");
      expect(room.phase).toBe("LOBBY");
      expect(room.players).toHaveLength(1);
      expect(room.players[0]).toMatchObject({
        id: "host-1",
        name: "Alice",
        score: 0,
        connected: true,
      });
      expect(room.hostId).toBe("host-1");
    });

    it("adds players", () => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      expect(room.players).toHaveLength(3);
      expect(room.players.map((p) => p.name)).toEqual([
        "Alice",
        "Bob",
        "Charlie",
      ]);
    });

    it("rejects duplicate names", () => {
      room.addPlayer("p2", "Bob");
      expect(() => room.addPlayer("p3", "Bob")).toThrow(/already taken/i);
    });

    it("rejects joins after game started", () => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);
      expect(() => room.addPlayer("p4", "Dave")).toThrow(
        /already started/i
      );
    });
  });

  // ─── Start game ──────────────────────────────────────────────────

  describe("start game", () => {
    it("starts with 3+ players, sets phase to SUBMITTING", () => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);
      expect(room.phase).toBe("SUBMITTING");
      expect(room.totalRounds).toBe(1);
      expect(room.currentRound).toBe(1);
    });

    it("rejects start with fewer than 3 players", () => {
      room.addPlayer("p2", "Bob");
      expect(() => room.startGame(1)).toThrow(/at least 3/i);
    });

    it("only host can start", () => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      expect(() => room.startGame(1, "p2")).toThrow(/host/i);
    });

    it("shuffles turn order", () => {
      // Add enough players that a shuffle is likely to differ
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.addPlayer("p4", "Dave");
      room.addPlayer("p5", "Eve");

      // Run multiple times to test that turn order is set
      room.startGame(1);
      expect(room.turnOrder).toHaveLength(5);
      // All player ids should be present in turnOrder
      const playerIds = room.players.map((p) => p.id);
      expect(room.turnOrder.sort()).toEqual(playerIds.sort());
    });
  });

  // ─── Submit statements ───────────────────────────────────────────

  describe("submit statements", () => {
    beforeEach(() => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);
    });

    it("accepts statements from current player, transitions to PRE_VOTE_TRANSITION", () => {
      const currentPlayerId = room.turnOrder[room.currentPlayerIndex];
      room.submitStatements(
        currentPlayerId,
        ["Truth 1", "Truth 2"],
        "The Lie"
      );
      expect(room.phase).toBe("PRE_VOTE_TRANSITION");
    });

    it("shuffles statements (lie position is randomized among 3)", () => {
      const currentPlayerId = room.turnOrder[room.currentPlayerIndex];
      room.submitStatements(
        currentPlayerId,
        ["Truth 1", "Truth 2"],
        "The Lie"
      );
      // The statements array should contain all 3 statements
      const statements = room.currentStatements!;
      expect(statements).toHaveLength(3);
      expect(statements).toContain("Truth 1");
      expect(statements).toContain("Truth 2");
      expect(statements).toContain("The Lie");
      // The lie index should point to "The Lie"
      expect(statements[room.lieIndex!]).toBe("The Lie");
    });

    it("rejects statements from non-current player", () => {
      const currentPlayerId = room.turnOrder[room.currentPlayerIndex];
      const otherPlayer = room.players.find(
        (p) => p.id !== currentPlayerId
      )!;
      expect(() =>
        room.submitStatements(
          otherPlayer.id,
          ["Truth 1", "Truth 2"],
          "The Lie"
        )
      ).toThrow(/not your turn/i);
    });
  });

  // ─── Voting ──────────────────────────────────────────────────────

  describe("voting", () => {
    let submitterId: string;
    let voters: string[];

    beforeEach(() => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);
      submitterId = room.turnOrder[room.currentPlayerIndex];
      voters = room.players
        .filter((p) => p.id !== submitterId)
        .map((p) => p.id);

      room.submitStatements(
        submitterId,
        ["Truth 1", "Truth 2"],
        "The Lie"
      );
      room.advanceFromTransition(); // PRE_VOTE_TRANSITION → VOTING
    });

    it("moves to VOTING phase after advanceFromTransition", () => {
      expect(room.phase).toBe("VOTING");
    });

    it("accepts votes from non-submitter players", () => {
      room.castVote(voters[0], 0);
      // Should not throw, and phase should still be VOTING until all voted
      expect(room.phase).toBe("VOTING");
    });

    it("rejects vote from the submitter", () => {
      expect(() => room.castVote(submitterId, 0)).toThrow(/submitter/i);
    });

    it("transitions to PRE_REVEAL_TRANSITION when all votes are in", () => {
      voters.forEach((voterId) => {
        room.castVote(voterId, 0);
      });
      expect(room.phase).toBe("PRE_REVEAL_TRANSITION");
    });

    it("rejects duplicate votes", () => {
      room.castVote(voters[0], 0);
      expect(() => room.castVote(voters[0], 1)).toThrow("Already voted");
    });
  });

  // ─── Vote status ─────────────────────────────────────────────────

  describe("getVoteStatus", () => {
    let submitterId: string;
    let voters: { id: string; name: string }[];

    beforeEach(() => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);
      submitterId = room.turnOrder[room.currentPlayerIndex];
      voters = room.players
        .filter((p) => p.id !== submitterId)
        .map((p) => ({ id: p.id, name: p.name }));

      room.submitStatements(
        submitterId,
        ["Truth 1", "Truth 2"],
        "The Lie"
      );
      room.advanceFromTransition();
    });

    it("returns voted and pending lists", () => {
      const status = room.getVoteStatus();
      expect(status.voted).toHaveLength(0);
      expect(status.pending).toHaveLength(voters.length);
      expect(status.pending.sort()).toEqual(
        voters.map((v) => v.name).sort()
      );
    });

    it("updates after a vote is cast", () => {
      room.castVote(voters[0].id, 0);
      const status = room.getVoteStatus();
      expect(status.voted).toContain(voters[0].name);
      expect(status.pending).not.toContain(voters[0].name);
    });
  });

  // ─── Reveal and scoring ──────────────────────────────────────────

  describe("reveal and scoring", () => {
    let submitterId: string;
    let submitterName: string;
    let voters: { id: string; name: string }[];
    let lieIdx: number;

    beforeEach(() => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);
      submitterId = room.turnOrder[room.currentPlayerIndex];
      submitterName = room.players.find((p) => p.id === submitterId)!.name;
      voters = room.players
        .filter((p) => p.id !== submitterId)
        .map((p) => ({ id: p.id, name: p.name }));

      room.submitStatements(
        submitterId,
        ["Truth 1", "Truth 2"],
        "The Lie"
      );
      lieIdx = room.lieIndex!;
      room.advanceFromTransition(); // → VOTING
    });

    it("moves to REVEAL after advanceFromTransition from PRE_REVEAL_TRANSITION", () => {
      // All vote correctly
      voters.forEach((v) => room.castVote(v.id, lieIdx));
      expect(room.phase).toBe("PRE_REVEAL_TRANSITION");
      room.advanceFromTransition(); // → REVEAL
      expect(room.phase).toBe("REVEAL");
    });

    it("scores +1 for correct guess", () => {
      // First voter guesses correctly, second guesses wrong
      room.castVote(voters[0].id, lieIdx);
      const wrongIdx = (lieIdx + 1) % 3;
      room.castVote(voters[1].id, wrongIdx);
      room.advanceFromTransition(); // → REVEAL (scores calculated)

      const voter0 = room.players.find((p) => p.id === voters[0].id)!;
      expect(voter0.score).toBe(1);
    });

    it("scores +1 to submitter per fooled player", () => {
      // Both voters guess wrong
      const wrongIdx = (lieIdx + 1) % 3;
      voters.forEach((v) => room.castVote(v.id, wrongIdx));
      room.advanceFromTransition(); // → REVEAL

      const submitter = room.players.find((p) => p.id === submitterId)!;
      expect(submitter.score).toBe(2); // +1 per fooled voter
    });

    it("returns detailed results via getRevealResults", () => {
      room.castVote(voters[0].id, lieIdx); // correct
      const wrongIdx = (lieIdx + 1) % 3;
      room.castVote(voters[1].id, wrongIdx); // wrong
      room.advanceFromTransition(); // → REVEAL

      const results = room.getRevealResults();
      expect(results.lieIndex).toBe(lieIdx);
      expect(results.statements).toHaveLength(3);
      expect(results.results).toHaveLength(2);

      const correctVoter = results.results.find(
        (r) => r.playerName === voters[0].name
      )!;
      expect(correctVoter.correct).toBe(true);
      expect(correctVoter.votedIndex).toBe(lieIdx);

      const wrongVoter = results.results.find(
        (r) => r.playerName === voters[1].name
      )!;
      expect(wrongVoter.correct).toBe(false);

      expect(results.pointsThisTurn).toBeDefined();
      expect(results.pointsThisTurn.submitterName).toBe(submitterName);
      expect(results.pointsThisTurn.submitterPoints).toBe(1); // one fooled
      const guesserCorrect = results.pointsThisTurn.guessers.find(
        (g: { name: string; points: number }) => g.name === voters[0].name
      )!;
      expect(guesserCorrect.points).toBe(1);
      const guesserWrong = results.pointsThisTurn.guessers.find(
        (g: { name: string; points: number }) => g.name === voters[1].name
      )!;
      expect(guesserWrong.points).toBe(0);
    });
  });

  // ─── Round progression ───────────────────────────────────────────

  describe("round progression", () => {
    beforeEach(() => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
    });

    function completeTurn(gameRoom: GameRoom): void {
      const submitterId =
        gameRoom.turnOrder[gameRoom.currentPlayerIndex];
      gameRoom.submitStatements(
        submitterId,
        ["Truth 1", "Truth 2"],
        "The Lie"
      );
      const lieIdx = gameRoom.lieIndex!;
      gameRoom.advanceFromTransition(); // → VOTING
      const voters = gameRoom.players.filter(
        (p) => p.id !== submitterId && p.connected
      );
      voters.forEach((v) => gameRoom.castVote(v.id, lieIdx));
      gameRoom.advanceFromTransition(); // → REVEAL
      gameRoom.advanceToScoreboard(); // → SCOREBOARD
    }

    it("advances to next player after scoreboard", () => {
      room.startGame(1);
      const firstPlayerIndex = room.currentPlayerIndex;
      completeTurn(room);
      room.advanceFromScoreboard();
      // Should move to the next player
      expect(room.currentPlayerIndex).toBe(firstPlayerIndex + 1);
      expect(room.phase).toBe("SUBMITTING");
    });

    it("ends game after all rounds (cycles) complete", () => {
      room.startGame(1); // 1 round = 3 turns (3 players)
      for (let i = 0; i < 3; i++) {
        completeTurn(room);
        room.advanceFromScoreboard();
      }
      expect(room.phase).toBe("GAME_OVER");
    });

    it("reshuffles turn order for new cycles", () => {
      room.addPlayer("p4", "Dave");
      room.addPlayer("p5", "Eve");
      room.startGame(2); // 2 rounds with 5 players

      const firstRoundOrder = [...room.turnOrder];

      // Complete all turns in round 1
      for (let i = 0; i < 5; i++) {
        completeTurn(room);
        room.advanceFromScoreboard();
      }
      // Now we should be in round 2 with a potentially reshuffled order
      expect(room.currentRound).toBe(2);
      expect(room.phase).toBe("SUBMITTING");
      // Turn order should still contain all player ids
      expect(room.turnOrder.sort()).toEqual(firstRoundOrder.sort());
    });
  });

  // ─── Disconnect handling ─────────────────────────────────────────

  describe("disconnect handling", () => {
    beforeEach(() => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);
    });

    it("marks player as disconnected", () => {
      room.disconnectPlayer("p2");
      const player = room.players.find((p) => p.id === "p2")!;
      expect(player.connected).toBe(false);
    });

    it("skips disconnected submitter", () => {
      const currentPlayerId = room.turnOrder[room.currentPlayerIndex];
      room.disconnectPlayer(currentPlayerId);
      const oldIndex = room.currentPlayerIndex;
      room.skipDisconnectedSubmitter();
      expect(room.currentPlayerIndex).not.toBe(oldIndex);
      expect(room.phase).toBe("SUBMITTING");
    });
  });

  // ─── Reconnect ───────────────────────────────────────────────────

  describe("reconnect", () => {
    beforeEach(() => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
    });

    it("updates player id on reconnect", () => {
      room.disconnectPlayer("p2");
      room.reconnectPlayer("p2", "p2-new");
      const player = room.players.find((p) => p.id === "p2-new")!;
      expect(player).toBeDefined();
      expect(player.name).toBe("Bob");
      expect(player.connected).toBe(true);
    });

    it("updates host id if host reconnects", () => {
      room.disconnectPlayer("host-1");
      room.reconnectPlayer("host-1", "host-new");
      expect(room.hostId).toBe("host-new");
    });

    it("updates turn order on reconnect", () => {
      room.startGame(1);
      const oldOrder = [...room.turnOrder];
      room.disconnectPlayer("p2");
      room.reconnectPlayer("p2", "p2-new");
      expect(room.turnOrder).toContain("p2-new");
      expect(room.turnOrder).not.toContain("p2");
    });
  });

  // ─── Reset for new game ──────────────────────────────────────────

  describe("reset for new game", () => {
    it("resets scores, phase, round tracking", () => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);

      // Modify some state
      room.players[0].score = 5;
      room.players[1].score = 3;

      room.resetForNewGame();

      expect(room.phase).toBe("LOBBY");
      expect(room.currentRound).toBe(0);
      expect(room.currentPlayerIndex).toBe(0);
      expect(room.totalRounds).toBe(0);
      expect(room.turnOrder).toHaveLength(0);
      room.players.forEach((p) => {
        expect(p.score).toBe(0);
      });
    });
  });

  // ─── getCurrentPlayerName ────────────────────────────────────────

  describe("getCurrentPlayerName", () => {
    it("returns name of current turn player", () => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);
      const currentId = room.turnOrder[room.currentPlayerIndex];
      const expectedName = room.players.find(
        (p) => p.id === currentId
      )!.name;
      expect(room.getCurrentPlayerName()).toBe(expectedName);
    });
  });

  // ─── Activity tracking ──────────────────────────────────────────

  describe("activity tracking", () => {
    it("touch updates last activity", () => {
      room.touch();
      expect(room.isStale(60000)).toBe(false);
    });

    it("isStale returns true after timeout", () => {
      // Manually set lastActivity to the past
      (room as any).lastActivity = Date.now() - 120000;
      expect(room.isStale(60000)).toBe(true);
    });
  });

  // ─── advanceToScoreboard ─────────────────────────────────────────

  describe("advanceToScoreboard", () => {
    it("transitions from REVEAL to SCOREBOARD", () => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.startGame(1);

      const submitterId = room.turnOrder[room.currentPlayerIndex];
      room.submitStatements(
        submitterId,
        ["Truth 1", "Truth 2"],
        "The Lie"
      );
      room.advanceFromTransition(); // → VOTING
      const lieIdx = room.lieIndex!;
      const voters = room.players.filter((p) => p.id !== submitterId);
      voters.forEach((v) => room.castVote(v.id, lieIdx));
      room.advanceFromTransition(); // → REVEAL
      expect(room.phase).toBe("REVEAL");

      room.advanceToScoreboard();
      expect(room.phase).toBe("SCOREBOARD");
    });
  });

  // ─── Edge cases: voting with disconnected players ────────────────

  describe("voting with disconnected players", () => {
    it("auto-transitions when all connected non-submitters have voted", () => {
      room.addPlayer("p2", "Bob");
      room.addPlayer("p3", "Charlie");
      room.addPlayer("p4", "Dave");
      room.startGame(1);

      const submitterId = room.turnOrder[room.currentPlayerIndex];
      room.submitStatements(
        submitterId,
        ["Truth 1", "Truth 2"],
        "The Lie"
      );
      room.advanceFromTransition(); // → VOTING

      // Disconnect one non-submitter
      const nonSubmitters = room.players.filter(
        (p) => p.id !== submitterId
      );
      room.disconnectPlayer(nonSubmitters[0].id);

      // Only connected non-submitters need to vote
      const connectedVoters = nonSubmitters.filter(
        (p) => p.id !== nonSubmitters[0].id
      );
      connectedVoters.forEach((v) => room.castVote(v.id, 0));

      expect(room.phase).toBe("PRE_REVEAL_TRANSITION");
    });
  });
});
