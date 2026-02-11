import { useEffect, useRef, useState} from "react";
import socket from "../network/socket";

export default function VideoChat({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const localStreamRef = useRef(null);


  const toggleMute = () => {
  const audioTrack = localStreamRef.current
    ?.getTracks()
    .find(track => track.kind === "audio");

  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  }
};

const toggleCamera = () => {
  const videoTrack = localStreamRef.current
    ?.getTracks()
    .find(track => track.kind === "video");

  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOff(!videoTrack.enabled);
  }
};




  useEffect(() => {
    let localStream;

    async function init() {
      localStreamRef.current= await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localVideoRef.current.srcObject = localStreamRef.current;

      const peer = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
});

      peerRef.current = peer;

      localStreamRef.current.getTracks().forEach((track) => {
        peer.addTrack(track, localStreamRef.current);
      });

      peer.ontrack = (event) => {
  if (remoteVideoRef.current.srcObject !== event.streams[0]) {
    remoteVideoRef.current.srcObject = event.streams[0];
  }
};


      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc-ice-candidate", {
            roomId,
            candidate: event.candidate,
          });
        }
      };

      socket.on("webrtc-offer", async ({ offer }) => {
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("webrtc-answer", { roomId, answer });
      });

      socket.on("webrtc-answer", async ({ answer }) => {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on("webrtc-ice-candidate", async ({ candidate }) => {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error(err);
        }
      });

      socket.on("ready-for-call", async () => {
  if (peerRef.current.signalingState === "stable") {
    const offer = await peerRef.current.createOffer();
    await peerRef.current.setLocalDescription(offer);
    socket.emit("webrtc-offer", { roomId, offer });
  }
});

    }

    init();

    return () => {
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("webrtc-ice-candidate");
      socket.off("start-call");
    };
  }, [roomId]);

 return (
  <>
    {/* Remote Video */}
    <video
      ref={remoteVideoRef}
      autoPlay
      playsInline
      style={{
        position: "absolute",
        bottom: 20,
        right: 20,
        width: 300,
        height: 220,
        objectFit: "cover",
      }}
    />

    {/* Local Video Overlay */}
    <video
      ref={localVideoRef}
      autoPlay
      playsInline
      muted
      style={{
        position: "absolute",
        bottom: 30,
        right: 30,
        width: 90,
        height: 65,
        border: "none",
        objectFit: "cover",
      }}
    />

    {/* Controls */}
    <div
      style={{
        position: "absolute",
        bottom: 0,
        right: 20,
        display: "flex",
        gap: 8,
      }}
    >
      <button
        onClick={toggleMute}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "none",
          background: isMuted ? "#e53935" : "rgba(255,255,255,0.25)",
          color: "white",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        🎤
      </button>

      <button
        onClick={toggleCamera}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "none",
          background: isCameraOff ? "#e53935" : "rgba(255,255,255,0.25)",
          color: "white",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        📷
      </button>
    </div>
  </>
);
}