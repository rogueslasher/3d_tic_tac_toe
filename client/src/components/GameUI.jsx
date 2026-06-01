import { useState } from "react";
import "./GameUI.css";

export default function GameUI({
  player,
  playerSymbol,
  winnerInfo,
  resetGame,
  setActiveLayer,
  board,
  handleMove,
  roomId,
  scores = { X: 0, O: 0, draws: 0 },
  spectatorCount = 0
}) {

  const [copied, setCopied] = useState(false);

  // Guard against undefined board during render
  if (!board || board.length !== 27) {
    return null;
  }

  const isYourTurn = player === playerSymbol;
  const isSpectator = playerSymbol === "spectator";

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback — just ignore
    }
  };

  const getSymbolChipClass = () => {
    if (isSpectator) return "hud__symbol-chip hud__symbol-chip--spectator";
    if (playerSymbol === "X") return "hud__symbol-chip hud__symbol-chip--x";
    if (playerSymbol === "O") return "hud__symbol-chip hud__symbol-chip--o";
    return "hud__symbol-chip";
  };

  const getTurnClass = () => {
    if (winnerInfo) return "";
    if (!playerSymbol || isSpectator) return "hud__turn hud__turn--waiting";
    if (isYourTurn) return `hud__turn hud__turn--your-turn${playerSymbol === "O" ? " is-o" : ""}`;
    return "hud__turn hud__turn--waiting";
  };

  const getTurnText = () => {
    if (!playerSymbol) return "Connecting…";
    if (isSpectator) return `Spectating — ${player}'s turn`;
    if (isYourTurn) return "Your Turn";
    return "Opponent's Turn";
  };

  const getCellClass = (value, index) => {
    const isWin = winnerInfo?.line?.includes(index);
    if (isWin) return "hud__cell hud__cell--win";
    if (value === "X") return "hud__cell hud__cell--x";
    if (value === "O") return "hud__cell hud__cell--o";
    return "hud__cell";
  };

  return (
    <div className="hud" id="game-hud">
      {/* Player badge */}
      <div className="hud__player-badge">
        <div className={getSymbolChipClass()}>
          {isSpectator ? "👁" : (playerSymbol || "?")}
        </div>
        <div className="hud__player-info">
          <span className="hud__player-label">You are</span>
          <span className="hud__player-name">
            {isSpectator ? "Spectator" : playerSymbol ? `Player ${playerSymbol}` : "Waiting…"}
          </span>
        </div>
      </div>

      <div className="hud__divider" />

      {/* Turn / Winner */}
      {winnerInfo ? (
        <div className="hud__winner">
          🏆 {winnerInfo.winner} Wins!
        </div>
      ) : (
        <div className={getTurnClass()}>
          {getTurnText()}
        </div>
      )}

      {/* Scoreboard */}
      <div className="hud__scores">
        <span className="hud__scores-title">Series Score</span>
        <div className="hud__scores-row">
          <div className="hud__score-box">
            <span className="hud__score-label X">X</span>
            <span className="hud__score-val">{scores.X}</span>
          </div>
          <div className="hud__score-box divider">:</div>
          <div className="hud__score-box">
            <span className="hud__score-label O">O</span>
            <span className="hud__score-val">{scores.O}</span>
          </div>
        </div>
        {scores.draws > 0 && (
          <div className="hud__draws-label">
            Draws: {scores.draws}
          </div>
        )}
      </div>

      <div className="hud__divider" />

      {/* Room code & Spectators */}
      <div className="hud__room-details">
        <div className="hud__room" onClick={copyRoomCode} title="Click to copy room link">
          <div>
            <div className="hud__room-label">Room</div>
            <div className="hud__room-code">{roomId}</div>
          </div>
          <span className="hud__room-copy">
            {copied ? "✓ Copied" : "📋 Copy"}
          </span>
        </div>
        {spectatorCount > 0 && (
          <div className="hud__spectators" title={`${spectatorCount} spectator(s) watching`}>
            👁 {spectatorCount} watching
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!isSpectator && (
        <button className="hud__btn hud__btn--reset" onClick={resetGame} id="reset-btn">
          ↻ Reset Game
        </button>
      )}
      <button
        className="hud__btn hud__btn--new-room"
        onClick={() => {
          const newRoom = Math.random().toString(36).substring(2, 8);
          window.location.href = `/?room=${newRoom}`;
        }}
        id="new-room-btn"
      >
        + New Room
      </button>

      <div className="hud__divider" />

      {/* Mini boards */}
      <div className="hud__miniboards">
        <div className="hud__miniboards-title">Board Layers</div>
        {[0, 1, 2].map((layer) => (
          <div
            key={layer}
            className="hud__layer"
            onMouseEnter={() => setActiveLayer(layer)}
            onMouseLeave={() => setActiveLayer(null)}
          >
            <span className="hud__layer-label">Layer {layer + 1}</span>
            <div className="hud__layer-grid">
              {Array.from({ length: 9 }).map((_, i) => {
                const row = Math.floor(i / 3);
                const col = i % 3;
                const flippedRow = 2 - row;
                const index = layer * 9 + flippedRow * 3 + col;
                const value = board[index];

                return (
                  <div
                    key={i}
                    className={getCellClass(value, index)}
                    onClick={() => handleMove(index)}
                  >
                    {value ?? ""}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
