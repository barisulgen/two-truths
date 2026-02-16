interface TransitionScreenProps {
  type: "pre-vote" | "pre-reveal";
}

export default function TransitionScreen({ type }: TransitionScreenProps) {
  const message =
    type === "pre-vote" ? "Time to Vote!" : "Results are in!";

  const subMessage =
    type === "pre-vote"
      ? "Can you spot the lie?"
      : "Let's see how everyone did...";

  return (
    <div className="screen transition-screen">
      <h2 className="transition-text pulse">{message}</h2>
      <p className="transition-sub">{subMessage}</p>
    </div>
  );
}
