import type { Player } from "@lie-detector/shared";

interface GameOverScreenProps {
  players: Player[];
  isHost: boolean;
  onPlayAgain: () => void;
}

export default function GameOverScreen({
  players,
  isHost,
  onPlayAgain,
}: GameOverScreenProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winnerScore = sorted.length > 0 ? sorted[0].score : 0;

  return (
    <div className="screen game-over-screen">
      <h2>Game Over!</h2>

      <div className="final-scoreboard">
        {sorted.map((player, index) => (
          <div
            key={player.id}
            className={`score-row rank-${index + 1} ${player.score === winnerScore ? "winner" : ""}`}
          >
            <span className="score-rank">
              {player.score === winnerScore && index === 0 ? "👑" : `#${index + 1}`}
            </span>
            <span className="score-name">{player.name}</span>
            <span className="score-points">{player.score} pts</span>
          </div>
        ))}
      </div>

      {isHost && (
        <button className="btn btn-primary" onClick={onPlayAgain}>
          Play Again
        </button>
      )}

      {!isHost && (
        <p className="waiting-message">Waiting for host to start a new game...</p>
      )}
    </div>
  );
}
