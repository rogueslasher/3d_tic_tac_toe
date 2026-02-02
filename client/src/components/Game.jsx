import { useState, useEffect } from "react";
import  socket  from "../network/socket"; // make sure this file exists
import GameUI from "./GameUI";
import VideoChat from "./VideoChat";




export default function Game({ children }) {
  const [board, setBoard] = useState(Array(27).fill(null));
  const [player, setPlayer] = useState("X");
  const [winnerInfo, setWinnerInfo] = useState(null);
  const [activeLayer, setActiveLayer] = useState(null);
  const [playerSymbol, setPlayerSymbol] = useState(null);
const roomId = "room1"; // temporary for now


useEffect(() => {
  console.log("Game useEffect running");
console.log("Emitting join-room", roomId);

  socket.emit("join-room", { roomId });

  socket.on("player-assigned", (symbol) => {
    console.log("Assigned as:", symbol);
    setPlayerSymbol(symbol);
    
  });

  socket.on("state-update", (state) => {
  setBoard(state.board);
  setPlayer(state.playerTurn);
  setWinnerInfo(state.winner || null)
});

  return () => {
    socket.off("player-assigned");
    socket.off("state-update");
  };
}, [roomId]);


 const handleMove = (index) => {
  if (!playerSymbol) return; // not assigned yet
  if (board[index] || winnerInfo) return;
  if (player !== playerSymbol) return; // not your turn

  socket.emit("make-move", {
    roomId,
    index,
  },[]);
};


  const resetGame = () => {
  socket.emit("reset-game", { roomId });
};


  return (
    <>
      {/* UI — MUST RECEIVE setActiveLayer */}
     <GameUI
  player={player}
  playerSymbol={playerSymbol}
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
      <VideoChat roomId={roomId} />
    </>
  );
}
