import type { VoteResult, TurnPoints } from "@two-truths/shared";

interface RevealScreenProps {
  statements: string[];
  lieIndex: number;
  results: VoteResult[];
  pointsThisTurn: TurnPoints | null;
  isHost: boolean;
  onNext: () => void;
}

export default function RevealScreen({
  statements,
  lieIndex,
  results,
  pointsThisTurn,
  isHost,
  onNext,
}: RevealScreenProps) {
  return (
    <div className="screen reveal-screen">
      <h2>The Lie Revealed!</h2>

      <div className="reveal-statements">
        {statements.map((statement, index) => (
          <div
            key={index}
            className={`reveal-card ${index === lieIndex ? "is-lie" : "is-truth"}`}
          >
            <span className="reveal-label">
              {index === lieIndex ? "LIE" : "TRUTH"}
            </span>
            <span className="reveal-text">{statement}</span>
          </div>
        ))}
      </div>

      {results.length > 0 && (
        <div className="vote-results">
          <h3>How everyone voted</h3>
          <ul>
            {results.map((result) => (
              <li
                key={result.playerName}
                className={result.correct ? "correct" : "incorrect"}
              >
                <span className="voter-name">{result.playerName}</span>
                <span className="voter-pick">
                  picked #{result.votedIndex + 1}
                </span>
                <span className="voter-result">
                  {result.correct ? "Correct!" : "Wrong!"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pointsThisTurn && (
        <div className="points-breakdown">
          <h3>Points This Turn</h3>
          <div className="points-entry submitter-points">
            <span>{pointsThisTurn.submitterName} (submitter)</span>
            <span className="points-value">
              +{pointsThisTurn.submitterPoints}
            </span>
          </div>
          {pointsThisTurn.guessers.map((guesser) => (
            <div key={guesser.name} className="points-entry">
              <span>{guesser.name}</span>
              <span className="points-value">+{guesser.points}</span>
            </div>
          ))}
        </div>
      )}

      {isHost && (
        <button className="btn btn-primary" onClick={onNext}>
          Scoreboard &rarr;
        </button>
      )}

      {!isHost && (
        <p className="waiting-message">Waiting for host to continue...</p>
      )}
    </div>
  );
}
