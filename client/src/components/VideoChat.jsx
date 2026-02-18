import { useEffect, useRef, useState } from "react";
import socket from "../network/socket";
console.log("VIDEO BUILD VERSION 6 - DEBUG");

export default function VideoChat({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const iceCandidateQueue = useRef([]);
  const readyForCallReceived = useRef(false);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const localStreamRef = useRef(null);

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
    console.log("[WRtC] useEffect running, roomId:", roomId);
    console.log("[WEBRTC] socket connected?", socket.connected, "id:", socket.id);

    // Register BEFORE init so we never miss it
    socket.on("ready-for-call", () => {
      console.log("[WEBRTC] ✅ ready-for-call received! peerRef:", !!peerRef.current);
      readyForCallReceived.current = true;
      if (peerRef.current) {
        console.log("[WEBRTC] peer already exists, creating offer now");
        createOffer(peerRef.current);
      } else {
        console.log("[WEBRTC] peer not ready yet, will create offer after init");
      }
    });

    // Log ALL incoming socket events for debugging
    socket.onAny((event, ...args) => {
      console.log("[WEBRTC] socket event received:", event, args);
    });

    async function createOffer(peer) {
      console.log("[WEBRTC] createOffer called");
      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        console.log("[WEBRTC] offer created, emitting webrtc-offer");
        socket.emit("webrtc-offer", { roomId, offer });
      } catch (err) {
        console.error("[WEBRTC] createOffer error:", err);
      }
    }

    async function drainIceCandidateQueue(peer) {
      console.log("[WEBRTC] draining ICE queue, size:", iceCandidateQueue.current.length);
      while (iceCandidateQueue.current.length > 0) {
        const candidate = iceCandidateQueue.current.shift();
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("[WEBRTC] queued ICE error:", err);
        }
      }
    }

    async function init() {
      console.log("[WEBRTC] init() started");

      try {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        console.log("[WEBRTC] getUserMedia success");
      } catch (err) {
        console.error("[WEBRTC] getUserMedia FAILED:", err);
        return;
      }

      localVideoRef.current.srcObject = localStreamRef.current;

      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerRef.current = peer;
      console.log("[WEBRTC] RTCPeerConnection created");

      localStreamRef.current.getTracks().forEach((track) => {
        peer.addTrack(track, localStreamRef.current);
        console.log("[WEBRTC] added track:", track.kind);
      });

      peer.ontrack = (event) => {
        console.log("[WEBRTC] ✅ ontrack fired! streams:", event.streams.length);
        if (remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("[WEBRTC] sending ICE candidate");
          socket.emit("webrtc-ice-candidate", { roomId, candidate: event.candidate });
        } else {
          console.log("[WEBRTC] ICE gathering complete");
        }
      };

      peer.oniceconnectionstatechange = () => {
        console.log("[WEBRTC] ICE state:", peer.iceConnectionState);
      };

      peer.onsignalingstatechange = () => {
        console.log("[WEBRTC] signaling state:", peer.signalingState);
      };

      socket.on("webrtc-offer", async ({ offer }) => {
        console.log("[WEBRTC] received offer, creating answer");
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(offer));
          await drainIceCandidateQueue(peer);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          console.log("[WEBRTC] answer created, emitting");
          socket.emit("webrtc-answer", { roomId, answer });
        } catch (err) {
          console.error("[WEBRTC] answer error:", err);
        }
      });

      socket.on("webrtc-answer", async ({ answer }) => {
        console.log("[WEBRTC] received answer");
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(answer));
          await drainIceCandidateQueue(peer);
        } catch (err) {
          console.error("[WEBRTC] setRemoteDescription (answer) error:", err);
        }
      });

      socket.on("webrtc-ice-candidate", async ({ candidate }) => {
        console.log("[WEBRTC] received ICE candidate, remoteDesc ready?", !!peer.remoteDescription);
        if (peer.remoteDescription) {
          try {
            await peer.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("[WEBRTC] addIceCandidate error:", err);
          }
        } else {
          iceCandidateQueue.current.push(candidate);
        }
      });

      console.log("[WEBRTC] init() done. readyForCallReceived:", readyForCallReceived.current);

      // If ready-for-call arrived before init finished, create offer now
      if (readyForCallReceived.current) {
        console.log("[WEBRTC] creating offer (was waiting for init)");
        await createOffer(peer);
      }
    }

    init();

    return () => {
      console.log("[WEBRTC] cleanup");
      socket.off("ready-for-call");
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("webrtc-ice-candidate");
      socket.offAny();
      peerRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId]);

  return (
    <>
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