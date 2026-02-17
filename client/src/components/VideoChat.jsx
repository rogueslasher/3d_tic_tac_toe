import { useEffect, useRef, useState } from "react";
import socket from "../network/socket";
console.log("VIDEO BUILD VERSION 5");

export default function VideoChat({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const localStreamRef = useRef(null);
  const iceCandidateQueue = useRef([]);

  // FIX: track if ready-for-call arrived before init() finished
  const readyForCallReceived = useRef(false);

  const toggleMute = () => {
    const audioTrack = localStreamRef.current
      ?.getTracks()
      .find((track) => track.kind === "audio");
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current
      ?.getTracks()
      .find((track) => track.kind === "video");
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  };

  useEffect(() => {
    // FIX: register ready-for-call BEFORE init() so we never miss it
    socket.on("ready-for-call", () => {
      console.log("READY FOR CALL RECEIVED");
      readyForCallReceived.current = true;
      // if peer is already set up, create offer immediately
      if (peerRef.current) {
        createOffer(peerRef.current);
      }
      // otherwise createOffer will be called at the end of init()
    });

    async function createOffer(peer) {
      console.log("Creating offer...");
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("webrtc-offer", { roomId, offer });
    }

    async function drainIceCandidateQueue(peer) {
      while (iceCandidateQueue.current.length > 0) {
        const candidate = iceCandidateQueue.current.shift();
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding queued ICE candidate:", err);
        }
      }
    }

    async function init() {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localVideoRef.current.srcObject = localStreamRef.current;

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
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

      peer.oniceconnectionstatechange = () => {
        console.log("ICE STATE:", peer.iceConnectionState);
      };

      socket.on("webrtc-offer", async ({ offer }) => {
        console.log("Received offer, creating answer");
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        await drainIceCandidateQueue(peer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("webrtc-answer", { roomId, answer });
      });

      socket.on("webrtc-answer", async ({ answer }) => {
        console.log("Received answer");
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
        await drainIceCandidateQueue(peer);
      });

      socket.on("webrtc-ice-candidate", async ({ candidate }) => {
        if (peer.remoteDescription) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("Error adding ICE candidate:", err);
          }
        } else {
          console.log("Queuing ICE candidate");
          iceCandidateQueue.current.push(candidate);
        }
      });

      // FIX: if ready-for-call already arrived before init() finished, create offer now
      if (readyForCallReceived.current) {
        console.log("ready-for-call was already received, creating offer now");
        await createOffer(peer);
      }
    }

    init();

    return () => {
      socket.off("ready-for-call");
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("webrtc-ice-candidate");
      peerRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
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