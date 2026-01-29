import { useState } from "react";
import GameUI from "./GameUI";
import { checkWinner } from "../game/gameLogic";

export default function Game({ children }) {
  const [board, setBoard] = useState(Array(27).fill(null));
  const [player, setPlayer] = useState("X");
  const [winnerInfo, setWinnerInfo] = useState(null);
  const [activeLayer, setActiveLayer] = useState(null);

  const handleMove = (index) => {
    if (board[index] || winnerInfo) return;

    const newBoard = [...board];
    newBoard[index] = player;

    const result = checkWinner(newBoard);
    if (result) setWinnerInfo(result);

    setBoard(newBoard);
    setPlayer(player === "X" ? "O" : "X");
  };

  const resetGame = () => {
    setBoard(Array(27).fill(null));
    setPlayer("X");
    setWinnerInfo(null);
    setActiveLayer(null);
  };

  return (
    <>
      {/* UI — MUST RECEIVE setActiveLayer */}
      <GameUI
        player={player}
        winnerInfo={winnerInfo}
        resetGame={resetGame}
        setActiveLayer={setActiveLayer}
        board={board}
  handleMove={handleMove}
      />

      {/* 3D scene */}
      {children({
        board,
        handleMove,
        winnerInfo,
        activeLayer,
      })}
    </>
  );
}
