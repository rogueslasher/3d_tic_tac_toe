export default function GameUI({
  player,
  playerSymbol,
  winnerInfo,
  resetGame,
  setActiveLayer,
  board,
  handleMove,
}) {

  // 🛡 Guard against undefined board during render
  if (!board || board.length !== 27) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 10,
        background: "rgba(0,0,0,0.6)",
        padding: "12px 16px",
        borderRadius: "8px",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <h4 style={{ marginBottom: "6px" }}>
  Your Symbol: {playerSymbol || "Waiting..."}
</h4>

{!winnerInfo ? (
  <h3>Turn: {player}</h3>
) : (
  <h3>Winner: {winnerInfo.winner} 🏆</h3>
)}

      <button
        onClick={resetGame}
        style={{
          marginTop: "10px",
          padding: "6px 12px",
          borderRadius: "6px",
          border: "none",
          cursor: "pointer",
          width: "100%",
        }}
      >
        Reset Game
      </button>

      <div style={{ marginTop: "12px" }}>
        <p style={{ marginBottom: "6px" }}>Mini Boards</p>

        {[0, 1, 2].map((layer) => (
          <div key={layer} style={{ marginBottom: "10px" }}>
            <p style={{ fontSize: "12px", marginBottom: "4px" }}>
              Layer {layer + 1}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 24px)",
                gap: "4px",
              }}
            >
              {Array.from({ length: 9 }).map((_, i) => {
                const row = Math.floor(i / 3);
const col = i % 3;

// 🔥 flip row so bottom row maps to y = 0 in 3D
const flippedRow = 2 - row;

const index = layer * 9 + flippedRow * 3 + col;

                const value = board[index];

                return (
                  <div
                    key={i}
                    onClick={() => handleMove(index)}
                    style={{
                      width: "24px",
                      height: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      cursor: "pointer",
                      background: "#222",
                      border: "1px solid #555",
                      color:
                        value === "X"
                          ? "#42a5f5"
                          : value === "O"
                          ? "#ef5350"
                          : "#999",
                    }}
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
