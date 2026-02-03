# 🎮 3D Multiplayer Tic Tac Toe + Video Chat

A real-time 3D multiplayer Tic Tac Toe game built with React Three Fiber and Socket.io, featuring integrated peer-to-peer video chat using WebRTC.

## 🚀 Live Demo

🌐 Frontend:(https://3d-tic-tac-toe-virid.vercel.app/)
🖥 Backend: https://threed-tic-tac-toe-rnxj.onrender.com 

---

## ✨ Features

- 🧊 Interactive 3D 3x3x3 Tic Tac Toe board
- 👥 Real-time multiplayer using Socket.io
- 🎥 Peer-to-peer video chat (WebRTC)
- 🔁 Live game state synchronization
- 🏆 Server-side win detection
- 🔐 Room-based gameplay
- 🎮 Smooth camera controls (OrbitControls)
- 📦 Fully deployed (Vercel + Render)

---

## 🛠 Tech Stack

### Frontend
- React
- Vite
- React Three Fiber
- Drei
- Socket.io Client
- WebRTC

### Backend
- Node.js
- Express
- Socket.io
- CORS

### Deployment
- Vercel (Frontend)
- Render (Backend)

---

## 🧠 How It Works

1. Users join a room.
2. Server assigns X or O.
3. Moves are validated server-side.
4. Game state is broadcast to all players.
5. Winner detection happens on the server.
6. WebRTC establishes peer-to-peer video connection.



## 🧪 Local Development

### Clone the repo
```bash
git clone https://github.com/rogueslasher/3d_tic_tac_toe.git
cd 3d_tic_tac_toe
```

### Install frontend
```bash
cd client
npm install
npm run dev
```

### Install backend
```bash
cd ../server
npm install
node index.js
```

---

## 🔮 Future Improvements

- Spectator mode
- Persistent rooms
- Chat system
- Match history
- Better UI polish
- Mobile responsiveness

---

## 👤 Author

**Aniket Pandey**  
GitHub: https://github.com/rogueslasher  

---

⭐ If you like this project, give it a star!
