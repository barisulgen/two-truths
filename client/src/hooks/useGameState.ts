import { useEffect, useState, useCallback } from "react";
import { useSocket } from "../context/SocketContext.tsx";
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
