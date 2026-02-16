import { useGameState } from "./hooks/useGameState.ts";
import HomeScreen from "./components/HomeScreen.tsx";
import LobbyScreen from "./components/LobbyScreen.tsx";
import SubmittingScreen from "./components/SubmittingScreen.tsx";
import TransitionScreen from "./components/TransitionScreen.tsx";
import VotingScreen from "./components/VotingScreen.tsx";
import RevealScreen from "./components/RevealScreen.tsx";
import ScoreboardScreen from "./components/ScoreboardScreen.tsx";
import GameOverScreen from "./components/GameOverScreen.tsx";
import "./App.css";

function App() {
  const game = useGameState();

  const renderPhase = () => {
    switch (game.phase) {
      case null:
        return (
          <HomeScreen
            onCreateRoom={game.createRoom}
            onJoinRoom={game.joinRoom}
            error={game.error}
            onClearError={game.clearError}
          />
        );

      case "LOBBY":
        return (
          <LobbyScreen
            roomCode={game.roomCode ?? ""}
            players={game.players}
            isHost={game.isHost}
            onStartGame={game.startGame}
          />
        );

      case "SUBMITTING":
        return (
          <SubmittingScreen
            isMyTurn={game.isMyTurn}
            currentPlayerName={game.currentPlayerName}
            onSubmit={game.submitStatements}
          />
        );

      case "PRE_VOTE_TRANSITION":
        return <TransitionScreen type="pre-vote" />;

      case "VOTING":
        return (
          <VotingScreen
            statements={game.phaseData?.statements ?? []}
            currentPlayerName={game.currentPlayerName}
            isMyTurn={game.isMyTurn}
            voteStatus={game.voteStatus}
            onVote={game.castVote}
          />
        );

      case "PRE_REVEAL_TRANSITION":
        return <TransitionScreen type="pre-reveal" />;

      case "REVEAL":
        return (
          <RevealScreen
            statements={game.phaseData?.statements ?? []}
            lieIndex={game.phaseData?.lieIndex ?? 0}
            results={game.phaseData?.results ?? []}
            pointsThisTurn={game.phaseData?.pointsThisTurn ?? null}
            isHost={game.isHost}
            onNext={game.nextRound}
          />
        );

      case "SCOREBOARD":
        return (
          <ScoreboardScreen
            players={game.phaseData?.scores ?? game.players}
            currentRound={game.currentRound}
            totalRounds={game.totalRounds}
            isHost={game.isHost}
            onNext={game.nextRound}
          />
        );

      case "GAME_OVER":
        return (
          <GameOverScreen
            players={game.phaseData?.scores ?? game.players}
            isHost={game.isHost}
            onPlayAgain={game.playAgain}
          />
        );

      default:
        return <HomeScreen
          onCreateRoom={game.createRoom}
          onJoinRoom={game.joinRoom}
          error={game.error}
          onClearError={game.clearError}
        />;
    }
  };

  return <div className="app">{renderPhase()}</div>;
}

export default App;
