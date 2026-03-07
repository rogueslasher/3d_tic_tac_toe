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

// ─── TURN credential fetching from Metered.ca ─────────────────────
const METERED_API_KEY = process.env.METERED_API_KEY || "";

async function fetchTurnCredentials() {
  if (!METERED_API_KEY) {
    console.warn("[TURN] No METERED_API_KEY set — falling back to STUN-only");
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ];
  }

  try {
    const resp = await fetch(
      `https://tic-tac-toe.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
    );
    if (!resp.ok) throw new Error(`Metered API returned ${resp.status}`);
    const iceServers = await resp.json();
    console.log("[TURN] Fetched", iceServers.length, "ICE servers from Metered");
    return iceServers;
  } catch (err) {
    console.error("[TURN] Failed to fetch from Metered:", err.message);
    // Fallback to STUN-only
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];
  }
}

// REST endpoint for fetching TURN credentials
app.get("/api/turn-credentials", async (req, res) => {
  const iceServers = await fetchTurnCredentials();
  res.json({ iceServers });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const rooms = {}; // roomId -> game state

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // ── Provide fresh TURN credentials to the client ──
  socket.on("get-turn-credentials", async (callback) => {
    const iceServers = await fetchTurnCredentials();
    callback({ iceServers });
  });
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

    if (!room.players.includes(socket.id)) {
      if (room.players.length < 2) {
        room.players.push(socket.id);
      } else {
        return; // Room is full
      }
    }

    console.log("ROOM PLAYERS:", room.players);

    const playerIndex = room.players.indexOf(socket.id);
    const symbol = playerIndex === 0 ? "X" : "O";

    console.log("Assigning", symbol, "to", socket.id);

    socket.emit("player-assigned", symbol);
    io.to(roomId).emit("state-update", room);

    if (room.players.length === 2 && playerIndex === 1) {
      socket.emit("ready-for-call");
      console.log("Emitted ready-for-call to second player:", socket.id);
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