import { useState } from "react";

interface VotingScreenProps {
  statements: string[];
  currentPlayerName: string;
  isMyTurn: boolean;
  voteStatus: { voted: string[]; pending: string[] } | null;
  onVote: (voteIndex: number) => void;
}

export default function VotingScreen({
  statements,
  currentPlayerName,
  isMyTurn,
  voteStatus,
  onVote,
}: VotingScreenProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const handleVote = () => {
    if (selectedIndex !== null && !hasVoted) {
      setHasVoted(true);
      onVote(selectedIndex);
    }
  };

  // The submitter doesn't vote; they see vote progress
  if (isMyTurn) {
    return (
      <div className="screen voting-screen">
        <h2>Others are voting...</h2>
        <p>
          They're trying to find your lie!
        </p>
        {voteStatus && (
          <div className="vote-progress">
            <p>
              <strong>{voteStatus.voted.length}</strong> voted,{" "}
              <strong>{voteStatus.pending.length}</strong> still thinking...
            </p>
            <div className="vote-names">
              {voteStatus.voted.map((name) => (
                <span key={name} className="vote-chip voted">
                  {name}
                </span>
              ))}
              {voteStatus.pending.map((name) => (
                <span key={name} className="vote-chip pending">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // After voting, show progress
  if (hasVoted) {
    return (
      <div className="screen voting-screen">
        <h2>Vote Submitted!</h2>
        <p>Waiting for others to vote...</p>
        {voteStatus && (
          <div className="vote-progress">
            <p>
              <strong>{voteStatus.voted.length}</strong> voted,{" "}
              <strong>{voteStatus.pending.length}</strong> still thinking...
            </p>
            <div className="vote-names">
              {voteStatus.voted.map((name) => (
                <span key={name} className="vote-chip voted">
                  {name}
                </span>
              ))}
              {voteStatus.pending.map((name) => (
                <span key={name} className="vote-chip pending">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="screen voting-screen">
      <h2>Which is the lie?</h2>
      <p>
        <strong>{currentPlayerName}</strong> said these three things. One is a
        lie!
      </p>

      <div className="statement-cards">
        {statements.map((statement, index) => (
          <button
            key={index}
            className={`statement-card ${selectedIndex === index ? "selected" : ""}`}
            onClick={() => setSelectedIndex(index)}
          >
            <span className="statement-number">{index + 1}</span>
            <span className="statement-text">{statement}</span>
          </button>
        ))}
      </div>

      <button
        className="btn btn-primary"
        disabled={selectedIndex === null}
        onClick={handleVote}
      >
        Submit Vote
      </button>
    </div>
  );
}
