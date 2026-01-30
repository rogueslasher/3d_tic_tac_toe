console.log("INDEX.JS EXECUTED");

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

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

  socket.on("join-room", ({ roomId }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        board: Array(27).fill(null),
        playerTurn: "X",
        players: [],
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
}

  });

  socket.on("make-move", ({ roomId, index }) => {
    const room = rooms[roomId];
    if (!room) return;

    const playerIndex = room.players.indexOf(socket.id);
    const symbol = playerIndex === 0 ? "X" : "O";

    if (room.playerTurn !== symbol) return;
    if (room.board[index]) return;

    room.board[index] = symbol;
    room.playerTurn = symbol === "X" ? "O" : "X";

    io.to(roomId).emit("state-update", room);
  });

  socket.on("reset-game", ({ roomId }) => {
  const room = rooms[roomId];
  if (!room) return;

  room.board = Array(27).fill(null);
  room.playerTurn = "X";

  io.to(roomId).emit("state-update", room);
});


  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

httpServer.listen(3001, () => {
  console.log("Server running on port 3001");
});
