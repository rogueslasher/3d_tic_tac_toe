import { io } from "socket.io-client";

const SERVER_URL = "https://threed-tic-tac-toe-rnxj.onrender.com";

console.log("Connecting to", SERVER_URL);

const socket1 = io(SERVER_URL, { transports: ["websocket"], withCredentials: false });
const socket2 = io(SERVER_URL, { transports: ["websocket"], withCredentials: false });

const roomId = "test-live-webrtc-123";

socket1.on("connect_error", (err) => console.log("Socket1 connect_error:", err.message));
socket2.on("connect_error", (err) => console.log("Socket2 connect_error:", err.message));

socket1.on("connect", () => {
    console.log("Socket1 connected:", socket1.id);
    socket1.emit("join-room", { roomId });
});

socket1.on("player-assigned", (symbol) => console.log("Socket1 assigned:", symbol));
socket1.on("ready-for-call", () => console.log("Socket1 received ready-for-call"));


socket2.on("connect", () => {
    console.log("Socket2 connected:", socket2.id);
    // Delay socket2 join to simulate slower client
    setTimeout(() => {
        socket2.emit("join-room", { roomId });
    }, 1000);
});

socket2.on("player-assigned", (symbol) => console.log("Socket2 assigned:", symbol));
socket2.on("ready-for-call", () => console.log("Socket2 received ready-for-call"));

setTimeout(() => {
    console.log("Test finishing...");
    socket1.disconnect();
    socket2.disconnect();
    process.exit(0);
}, 20000);
