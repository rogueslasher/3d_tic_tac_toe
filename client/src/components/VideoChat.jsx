import { useEffect, useRef, useState, useCallback } from "react";
import socket from "../network/socket";
console.log("VIDEO BUILD VERSION 7 - TURN + RETRY");

// ─── ICE server configuration ────────────────────────────────────────
// Multiple STUN servers for redundancy + free Metered TURN servers
// for NAT traversal across restrictive networks.
const ICE_SERVERS = {
  iceServers: [
    // STUN servers (discover public IP)
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },

    // Free TURN servers from Open Relay (relay.metered.ca)
    // These relay traffic when direct peer-to-peer fails (symmetric NAT)
    {
      urls: "turn:a.relay.metered.ca:80",
      username: "e8dd65b92f6bce636d5230c8",
      credential: "JxOVkJpMqCNKl4Gp",
    },
    {
      urls: "turn:a.relay.metered.ca:80?transport=tcp",
      username: "e8dd65b92f6bce636d5230c8",
      credential: "JxOVkJpMqCNKl4Gp",
    },
    {
      urls: "turn:a.relay.metered.ca:443",
      username: "e8dd65b92f6bce636d5230c8",
      credential: "JxOVkJpMqCNKl4Gp",
    },
    {
      urls: "turns:a.relay.metered.ca:443?transport=tcp",
      username: "e8dd65b92f6bce636d5230c8",
      credential: "JxOVkJpMqCNKl4Gp",
    },
  ],
  iceCandidatePoolSize: 10,
};

const MAX_RETRIES = 2;
const ICE_TIMEOUT_MS = 15000; // 15 seconds before retry

export default function VideoChat({ roomId }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const iceCandidateQueue = useRef([]);
  const readyForCallReceived = useRef(false);
  const retryCountRef = useRef(0);
  const iceTimeoutRef = useRef(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("waiting"); // waiting | connecting | connected | failed | retrying
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

  // ─── Clear any running ICE timeout ───────────────────────────────
  const clearIceTimeout = useCallback(() => {
    if (iceTimeoutRef.current) {
      clearTimeout(iceTimeoutRef.current);
      iceTimeoutRef.current = null;
    }
  }, []);

  // ─── Start ICE timeout — retries if connection isn't made ────────
  const startIceTimeout = useCallback(() => {
    clearIceTimeout();
    iceTimeoutRef.current = setTimeout(() => {
      const peer = peerRef.current;
      if (
        peer &&
        peer.iceConnectionState !== "connected" &&
        peer.iceConnectionState !== "completed"
      ) {
        console.warn(
          `[WEBRTC] ⏰ ICE timeout after ${ICE_TIMEOUT_MS}ms. State: ${peer.iceConnectionState}. Retry ${retryCountRef.current + 1}/${MAX_RETRIES}`
        );

        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          setConnectionStatus("retrying");
          // Close old peer and re-negotiate
          peer.close();
          peerRef.current = null;
          iceCandidateQueue.current = [];
          // Re-trigger the connection by creating a new peer
          setupPeer(localStreamRef.current);
        } else {
          console.error("[WEBRTC] ❌ All retries exhausted");
          setConnectionStatus("failed");
        }
      }
    }, ICE_TIMEOUT_MS);
  }, [clearIceTimeout]);

  // ─── Create and configure a new RTCPeerConnection ────────────────
  const setupPeer = useCallback(
    (localStream) => {
      console.log("[WEBRTC] setupPeer() called, attempt:", retryCountRef.current);

      const peer = new RTCPeerConnection(ICE_SERVERS);
      peerRef.current = peer;
      console.log("[WEBRTC] RTCPeerConnection created with TURN servers");

      // Add local tracks
      localStream.getTracks().forEach((track) => {
        peer.addTrack(track, localStream);
        console.log("[WEBRTC] added track:", track.kind);
      });

      // ── Remote track received ──
      peer.ontrack = (event) => {
        console.log("[WEBRTC] ✅ ontrack fired! streams:", event.streams.length);
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // ── Send ICE candidates to remote peer ──
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(
            "[WEBRTC] sending ICE candidate, type:",
            event.candidate.type,
            "protocol:",
            event.candidate.protocol
          );
          socket.emit("webrtc-ice-candidate", {
            roomId,
            candidate: event.candidate,
          });
        } else {
          console.log("[WEBRTC] ICE gathering complete");
        }
      };

      // ── ICE connection state (connected / failed / disconnected) ──
      peer.oniceconnectionstatechange = () => {
        const state = peer.iceConnectionState;
        console.log("[WEBRTC] ICE connection state:", state);

        switch (state) {
          case "checking":
            setConnectionStatus("connecting");
            startIceTimeout();
            break;
          case "connected":
          case "completed":
            setConnectionStatus("connected");
            clearIceTimeout();
            retryCountRef.current = 0; // reset for future reconnects
            break;
          case "failed":
            console.error("[WEBRTC] ❌ ICE connection failed");
            if (retryCountRef.current < MAX_RETRIES) {
              retryCountRef.current += 1;
              setConnectionStatus("retrying");
              clearIceTimeout();
              peer.close();
              peerRef.current = null;
              iceCandidateQueue.current = [];
              setupPeer(localStream);
            } else {
              setConnectionStatus("failed");
              clearIceTimeout();
            }
            break;
          case "disconnected":
            console.warn("[WEBRTC] ⚠️ ICE disconnected — may recover automatically");
            setConnectionStatus("connecting");
            startIceTimeout(); // give it time to recover, then retry
            break;
          case "closed":
            clearIceTimeout();
            break;
          default:
            break;
        }
      };

      // ── ICE gathering state (for debugging) ──
      peer.onicegatheringstatechange = () => {
        console.log("[WEBRTC] ICE gathering state:", peer.iceGatheringState);
      };

      peer.onsignalingstatechange = () => {
        console.log("[WEBRTC] signaling state:", peer.signalingState);
      };

      // ── Connection state (overall) ──
      peer.onconnectionstatechange = () => {
        console.log("[WEBRTC] connection state:", peer.connectionState);
      };

      // If ready-for-call already arrived, create offer immediately
      if (readyForCallReceived.current) {
        console.log("[WEBRTC] creating offer (ready-for-call was already received)");
        createOffer(peer);
      }

      return peer;
    },
    [roomId, startIceTimeout, clearIceTimeout]
  );

  useEffect(() => {
    console.log("[WEBRTC] useEffect running, roomId:", roomId);
    console.log("[WEBRTC] socket connected?", socket.connected, "id:", socket.id);

    // Register BEFORE init so we never miss it
    socket.on("ready-for-call", () => {
      console.log("[WEBRTC] ✅ ready-for-call received! peerRef:", !!peerRef.current);
      readyForCallReceived.current = true;
      setConnectionStatus("connecting");
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
        setConnectionStatus("failed");
        return;
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      // Set up the peer connection with TURN servers
      const peer = setupPeer(localStreamRef.current);

      // ── Handle incoming signaling messages ──
      socket.on("webrtc-offer", async ({ offer }) => {
        console.log("[WEBRTC] received offer, creating answer");
        setConnectionStatus("connecting");
        try {
          const currentPeer = peerRef.current;
          if (!currentPeer) return;
          await currentPeer.setRemoteDescription(new RTCSessionDescription(offer));
          await drainIceCandidateQueue(currentPeer);
          const answer = await currentPeer.createAnswer();
          await currentPeer.setLocalDescription(answer);
          console.log("[WEBRTC] answer created, emitting");
          socket.emit("webrtc-answer", { roomId, answer });
        } catch (err) {
          console.error("[WEBRTC] answer error:", err);
        }
      });

      socket.on("webrtc-answer", async ({ answer }) => {
        console.log("[WEBRTC] received answer");
        try {
          const currentPeer = peerRef.current;
          if (!currentPeer) return;
          await currentPeer.setRemoteDescription(new RTCSessionDescription(answer));
          await drainIceCandidateQueue(currentPeer);
        } catch (err) {
          console.error("[WEBRTC] setRemoteDescription (answer) error:", err);
        }
      });

      socket.on("webrtc-ice-candidate", async ({ candidate }) => {
        const currentPeer = peerRef.current;
        if (!currentPeer) return;
        console.log(
          "[WEBRTC] received ICE candidate, remoteDesc ready?",
          !!currentPeer.remoteDescription
        );
        if (currentPeer.remoteDescription) {
          try {
            await currentPeer.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("[WEBRTC] addIceCandidate error:", err);
          }
        } else {
          iceCandidateQueue.current.push(candidate);
        }
      });

      console.log("[WEBRTC] init() done. readyForCallReceived:", readyForCallReceived.current);
    }

    init();

    return () => {
      console.log("[WEBRTC] cleanup");
      clearIceTimeout();
      socket.off("ready-for-call");
      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("webrtc-ice-candidate");
      socket.offAny();
      peerRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId, setupPeer, clearIceTimeout]);

  // ─── Connection status label & color ─────────────────────────────
  const statusConfig = {
    waiting: { label: "Waiting for opponent…", color: "#888" },
    connecting: { label: "Connecting…", color: "#f5a623" },
    retrying: { label: "Retrying connection…", color: "#f5a623" },
    connected: { label: "Connected ✅", color: "#4caf50" },
    failed: { label: "Connection failed ❌", color: "#e53935" },
  };
  const { label: statusLabel, color: statusColor } =
    statusConfig[connectionStatus] || statusConfig.waiting;

  return (
    <>
      {/* ── Connection status indicator ── */}
      <div
        style={{
          position: "absolute",
          bottom: 245,
          right: 20,
          background: "rgba(0,0,0,0.7)",
          color: statusColor,
          padding: "4px 12px",
          borderRadius: 12,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "system-ui, sans-serif",
          zIndex: 10,
          transition: "color 0.3s ease",
        }}
      >
        {statusLabel}
      </div>

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
          borderRadius: 8,
          background: "#111",
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
          borderRadius: 6,
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