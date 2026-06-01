import { useMemo } from "react";
import "./VictoryOverlay.css";

const CONFETTI_COLORS = [
  "#dcb965", "#8a9ab0", "#5fa879", "#b8a070",
  "#f5f0e8", "#c9a08a", "#e8d5a3", "#7da87b",
];

function ConfettiParticles({ count = 40 }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: `${Math.random() * 2}s`,
      duration: `${2 + Math.random() * 3}s`,
      size: `${5 + Math.random() * 8}px`,
    }));
  }, [count]);

  return (
    <div className="victory-confetti">
      {particles.map((p) => (
        <div
          key={p.id}
          className="victory-particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

export default function VictoryOverlay({ winnerInfo, isDraw, onPlayAgain, onNewRoom }) {
  if (!winnerInfo && !isDraw) return null;

  const winner = winnerInfo?.winner;
  const titleClass = winner === "X"
    ? "victory-title victory-title--x"
    : winner === "O"
      ? "victory-title victory-title--o"
      : "victory-title victory-title--draw";

  const titleText = isDraw
    ? "It's a Draw!"
    : `${winner} Wins!`;

  const subtitle = isDraw
    ? "Well fought — nobody backed down."
    : winner === "X"
      ? "Cyan dominance across the cube."
      : "Magenta claims the victory.";

  const trophy = isDraw ? "🤝" : "🏆";

  return (
    <div className="victory-overlay" id="victory-overlay">
      {!isDraw && <ConfettiParticles />}

      <div className="victory-card">
        <div className="victory-trophy">{trophy}</div>
        <h2 className={titleClass}>{titleText}</h2>
        <p className="victory-subtitle">{subtitle}</p>

        <div className="victory-actions">
          <button
            className="victory-btn victory-btn--primary"
            onClick={onPlayAgain}
            id="play-again-btn"
          >
            Play Again
          </button>
          <button
            className="victory-btn victory-btn--secondary"
            onClick={onNewRoom}
            id="new-room-btn"
          >
            New Room
          </button>
        </div>
      </div>
    </div>
  );
}
