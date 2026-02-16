import type { Player } from "@two-truths/shared";

interface ScoreboardScreenProps {
  players: Player[];
  currentRound: number;
  totalRounds: number;
  isHost: boolean;
  onNext: () => void;
}

export default function ScoreboardScreen({
  players,
  currentRound,
  totalRounds,
  isHost,
  onNext,
}: ScoreboardScreenProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="screen scoreboard-screen">
      <h2>Scoreboard</h2>
      <p className="round-info">
        Round {currentRound} of {totalRounds}
      </p>

      <div className="scoreboard">
        {sorted.map((player, index) => (
          <div key={player.id} className={`score-row rank-${index + 1}`}>
            <span className="score-rank">#{index + 1}</span>
            <span className="score-name">{player.name}</span>
            <span className="score-points">{player.score} pts</span>
          </div>
        ))}
      </div>

      {isHost && (
        <button className="btn btn-primary" onClick={onNext}>
          Next Turn &rarr;
        </button>
      )}

      {!isHost && (
        <p className="waiting-message">Waiting for host to continue...</p>
      )}
    </div>
  );
}
