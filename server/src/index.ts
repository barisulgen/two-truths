import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { RoomManager } from "./RoomManager.js";
import type { ClientEvents, ServerEvents, RoomState } from "@two-truths/shared";

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
            statements: room.currentStatements!,
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
        const postScoreboardPhase = room.phase as string;

        if (postScoreboardPhase === "GAME_OVER") {
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
      const currentPhase = room.phase as string;
      if (voteStatus.pending.length === 0 && currentPhase === "PRE_REVEAL_TRANSITION") {
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
