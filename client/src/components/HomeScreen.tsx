import { useState } from "react";

interface HomeScreenProps {
  onCreateRoom: (name: string) => void;
  onJoinRoom: (code: string, name: string) => void;
  error: string | null;
  onClearError: () => void;
}

type Mode = "menu" | "create" | "join";

export default function HomeScreen({
  onCreateRoom,
  onJoinRoom,
  error,
  onClearError,
}: HomeScreenProps) {
  const [mode, setMode] = useState<Mode>("menu");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const handleBack = () => {
    setMode("menu");
    setName("");
    setRoomCode("");
    onClearError();
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateRoom(name.trim());
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && roomCode.trim()) {
      onJoinRoom(roomCode.trim().toUpperCase(), name.trim());
    }
  };

  return (
    <div className="screen home-screen">
      <h1 className="game-title">Lie Detector</h1>
      <p className="game-subtitle">Can you spot the lie?</p>

      {error && <div className="error-banner">{error}</div>}

      {mode === "menu" && (
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={() => setMode("create")}>
            Create Game
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setMode("join")}
          >
            Join Game
          </button>
        </div>
      )}

      {mode === "create" && (
        <form className="form" onSubmit={handleCreate}>
          <input
            type="text"
            className="input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!name.trim()}
          >
            Create Room
          </button>
          <button type="button" className="btn btn-back" onClick={handleBack}>
            Back
          </button>
        </form>
      )}

      {mode === "join" && (
        <form className="form" onSubmit={handleJoin}>
          <input
            type="text"
            className="input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <input
            type="text"
            className="input"
            placeholder="Room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!name.trim() || !roomCode.trim()}
          >
            Join Room
          </button>
          <button type="button" className="btn btn-back" onClick={handleBack}>
            Back
          </button>
        </form>
      )}
    </div>
  );
}
