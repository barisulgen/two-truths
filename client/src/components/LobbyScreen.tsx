import { useState } from "react";
import type { Player } from "@two-truths/shared";

interface LobbyScreenProps {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  onStartGame: (totalRounds: number) => void;
}

export default function LobbyScreen({
  roomCode,
  players,
  isHost,
  onStartGame,
}: LobbyScreenProps) {
  const [totalRounds, setTotalRounds] = useState(1);

  const canStart = players.length >= 3;

  return (
    <div className="screen lobby-screen">
      <h2>Room Code</h2>
      <div className="room-code">{roomCode}</div>
      <p className="room-code-hint">Share this code with your friends!</p>

      <div className="player-list">
        <h3>Players ({players.length})</h3>
        <ul>
          {players.map((player) => (
            <li key={player.id} className={player.connected ? "" : "disconnected"}>
              {player.name}
              {!player.connected && " (disconnected)"}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <div className="host-controls">
          <div className="round-selector">
            <label htmlFor="rounds">Rounds:</label>
            <select
              id="rounds"
              value={totalRounds}
              onChange={(e) => setTotalRounds(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            disabled={!canStart}
            onClick={() => onStartGame(totalRounds)}
          >
            {canStart ? "Start Game" : `Need ${3 - players.length} more player${3 - players.length === 1 ? "" : "s"}`}
          </button>
        </div>
      ) : (
        <p className="waiting-message">Waiting for the host to start the game...</p>
      )}
    </div>
  );
}
