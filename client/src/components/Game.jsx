import { useState, useEffect } from "react";
import socket from "../network/socket";
import GameUI from "./GameUI";
import VideoChat from "./VideoChat";

export default function Game({ children }) {
  const [board, setBoard] = useState(Array(27).fill(null));
  const [player, setPlayer] = useState("X");
  const [winnerInfo, setWinnerInfo] = useState(null);
  const [activeLayer, setActiveLayer] = useState(null);
  const [playerSymbol, setPlayerSymbol] = useState(null);

  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room") || "default";


  useEffect(() => {
    console.log("Game useEffect running");

    // Attach listeners FIRST
    socket.on("player-assigned", (symbol) => {
      console.log("Assigned as:", symbol);
      setPlayerSymbol(symbol);
    });

    socket.on("state-update", (state) => {
      setBoard(state.board);
      setPlayer(state.playerTurn);
      setWinnerInfo(state.winner || null);
    });

    socket.on("room-full", () => {
      const wantsToSpectate = window.confirm("This room is already full (2 players). Would you like to join as a spectator?");
      if (wantsToSpectate) {
        socket.emit("join-room", { roomId, asSpectator: true });
      } else {
        const newRoomId = Math.random().toString(36).substring(2, 8);
        alert("Redirecting to a new room...");
        window.location.href = `/?room=${newRoomId}`;
      }
    });

    // THEN emit join-room
    console.log("Emitting join-room", roomId);
    socket.emit("join-room", { roomId });

    return () => {
      socket.off("player-assigned");
      socket.off("state-update");
      socket.off("room-full");
    };
  }, [roomId]);



  const handleMove = (index) => {
    if (!playerSymbol) return; // not assigned yet
    if (board[index] || winnerInfo) return;
    if (player !== playerSymbol) return; // not your turn

    socket.emit("make-move", {
      roomId,
      index,
    }, []);
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
        roomId={roomId}

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
