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
