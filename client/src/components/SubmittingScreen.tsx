import { useState } from "react";

interface SubmittingScreenProps {
  isMyTurn: boolean;
  currentPlayerName: string;
  onSubmit: (truths: [string, string], lie: string) => void;
}

export default function SubmittingScreen({
  isMyTurn,
  currentPlayerName,
  onSubmit,
}: SubmittingScreenProps) {
  const [truth1, setTruth1] = useState("");
  const [truth2, setTruth2] = useState("");
  const [lie, setLie] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit =
    truth1.trim() !== "" && truth2.trim() !== "" && lie.trim() !== "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit && !submitted) {
      setSubmitted(true);
      onSubmit([truth1.trim(), truth2.trim()], lie.trim());
    }
  };

  if (!isMyTurn) {
    return (
      <div className="screen submitting-screen">
        <h2>Waiting...</h2>
        <p className="waiting-message">
          <strong>{currentPlayerName}</strong> is writing their statements.
        </p>
        <div className="pulse-dot" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="screen submitting-screen">
        <h2>Submitted!</h2>
        <p className="waiting-message">Your statements have been submitted.</p>
      </div>
    );
  }

  return (
    <div className="screen submitting-screen">
      <h2>Your Turn!</h2>
      <p>Enter two truths and one lie about yourself.</p>

      <form className="form" onSubmit={handleSubmit}>
        <label className="input-label">Truth #1</label>
        <input
          type="text"
          className="input"
          placeholder="Something true about you..."
          value={truth1}
          onChange={(e) => setTruth1(e.target.value)}
          maxLength={150}
          autoFocus
        />

        <label className="input-label">Truth #2</label>
        <input
          type="text"
          className="input"
          placeholder="Another truth about you..."
          value={truth2}
          onChange={(e) => setTruth2(e.target.value)}
          maxLength={150}
        />

        <label className="input-label">The Lie</label>
        <input
          type="text"
          className="input"
          placeholder="Something false about you..."
          value={lie}
          onChange={(e) => setLie(e.target.value)}
          maxLength={150}
        />

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!canSubmit}
        >
          Submit Statements
        </button>
      </form>
    </div>
  );
}
