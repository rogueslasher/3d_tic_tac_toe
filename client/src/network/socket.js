import { io } from "socket.io-client";

const socket = io("https://threed-tic-tac-toe-rnxj.onrender.com");
transports: ["websocket"],
socket.on("connect", () => {
  console.log("Connected to server:", socket.id);
});
export default socket;
