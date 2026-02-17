console.log("INDEX.JS EXECUTED");

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { WIN_LINES } from "./winLines.js";

export function checkWinner(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (
      board[a] &&
      board[a] === board[b] &&
      board[a] === board[c]
    ) {
      return { winner: board[a], line };
    }
  }
  return null;
}


const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const rooms = {}; // roomId -> game state

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("webrtc-offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("webrtc-offer", { offer });
  });

  socket.on("webrtc-answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("webrtc-answer", { answer });
  });

  socket.on("webrtc-ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("webrtc-ice-candidate", { candidate });
  });


  socket.on("join-room", ({ roomId }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        board: Array(27).fill(null),
        playerTurn: "X",
        players: [],
        winner: null,
      };
    }

    const room = rooms[roomId];

    if (!room.players.includes(socket.id) && room.players.length < 2) {
      room.players.push(socket.id);

      console.log("ROOM PLAYERS:", room.players);

      const symbol = room.players.length === 1 ? "X" : "O";

      console.log("Assigning", symbol, "to", socket.id);

      socket.emit("player-assigned", symbol);
      io.to(roomId).emit("state-update", room);

      // FIX: removed stray `peer` references that don't exist server-side —
      // those lines were crashing the handler before ready-for-call could fire.

      if (room.players.length === 2) {
        // FIX: emit to the *second* player (the one who just joined).
        // Player[0] is already waiting; player[1] is guaranteed to have its
        // WebRTC listeners initialised by the time this arrives because they
        // just finished their own init() call.
        socket.emit("ready-for-call");
        console.log("Emitted ready-for-call to second player:", socket.id);
      }
    }
  });

  socket.on("make-move", ({ roomId, index }) => {
    const room = rooms[roomId];
    if (!room) return;

    const playerIndex = room.players.indexOf(socket.id);
    const symbol = playerIndex === 0 ? "X" : "O";

    if (room.winner) return;
    if (room.playerTurn !== symbol) return;
    if (room.board[index]) return;

    room.board[index] = symbol;

    const result = checkWinner(room.board);

    if (result) {
      room.winner = result;
    } else {
      room.playerTurn = symbol === "X" ? "O" : "X";
    }

    io.to(roomId).emit("state-update", room);
  });

  socket.on("reset-game", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.board = Array(27).fill(null);
    room.playerTurn = "X";
    room.winner = null;

    io.to(roomId).emit("state-update", room);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(id => id !== socket.id);

      if (room.players.length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log("Server running on port", PORT);
});