import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import socket from "../network/socket";
import "./VideoChat.css";

// ─── Fallback ICE config (STUN only) ─
const FALLBACK_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

const MAX_RETRIES = 2;
const ICE_TIMEOUT_MS = 15000;

export default function VideoChat({ roomId }) {
  const localVideoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Mesh Network State
  const localStreamRef = useRef(null);
  const iceServersRef = useRef(FALLBACK_ICE_SERVERS);
  const peersRef = useRef(new Map());
  const timeoutsRef = useRef(new Map());
  const retriesRef = useRef(new Map());
  const isReadyRef = useRef(false);
  const pendingSignalsRef = useRef([]);

  const [remoteStreams, setRemoteStreams] = useState([]);
  const [peerStatuses, setPeerStatuses] = useState({});

  // --- UI STATUS ---
  const statusConfig = {
    waiting: { label: "Waiting for opponent…", color: "var(--text-muted)", dotColor: "#888", animated: false },
    connecting: { label: "Connecting…", color: "var(--warning)", dotColor: "#f5a623", animated: true },
    retrying: { label: "Retrying…", color: "var(--warning)", dotColor: "#f5a623", animated: true },
    connected: { label: "Connected", color: "var(--success)", dotColor: "#4caf50", animated: false },
    failed: { label: "Failed", color: "var(--danger)", dotColor: "#e53935", animated: false },
  };

  const overallStatus = useMemo(() => {
    const statuses = Object.values(peerStatuses);
    if (statuses.length === 0) return "waiting";
    if (statuses.includes("failed")) return "failed";
    if (statuses.includes("retrying")) return "retrying";
    if (statuses.includes("connecting")) return "connecting";
    return "connected";
  }, [peerStatuses]);

  const { label: statusLabel, color: statusColor, dotColor, animated: dotAnimated } = statusConfig[overallStatus];

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getTracks().find(t => t.kind === "audio");
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getTracks().find(t => t.kind === "video");
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOff(!videoTrack.enabled);
    }
  };

  const clearIceTimeout = useCallback((targetId) => {
    const timeoutId = timeoutsRef.current.get(targetId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutsRef.current.delete(targetId);
    }
  }, []);

  const removePeer = useCallback((id) => {
    console.log(`[MESH] Removing peer ${id}`);
    clearIceTimeout(id);
    const peerObj = peersRef.current.get(id);
    if (peerObj) {
      peerObj.peer.close();
      peersRef.current.delete(id);
    }
    setRemoteStreams(prev => prev.filter(s => s.id !== id));
    setPeerStatuses(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [clearIceTimeout]);

  const createOfferRef = useRef(null);

  const getPeerObj = useCallback((targetId) => {
    if (!peersRef.current.has(targetId)) {
      console.log(`[MESH] Creating new peer for target: ${targetId}`);

      const peer = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 10,
      });
      const peerObj = { peer, iceQueue: [], remoteDescSet: false };
      peersRef.current.set(targetId, peerObj);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peer.addTrack(track, localStreamRef.current);
        });
      }

      peer.ontrack = (event) => {
        console.log(`[MESH] Track received from ${targetId}, kind:`, event.track.kind);
        setRemoteStreams(prev => {
          if (prev.find(s => s.id === targetId)) {
            return prev;
          }
          return [...prev, { id: targetId, stream: event.streams[0] }];
        });
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc-ice-candidate", { targetId, candidate: event.candidate });
        }
      };

      const handleRetry = () => {
        const currentRetries = retriesRef.current.get(targetId) || 0;
        if (currentRetries < MAX_RETRIES) {
          console.warn(`[MESH] Retrying connection to ${targetId} (Attempt ${currentRetries + 1})`);
          retriesRef.current.set(targetId, currentRetries + 1);
          setPeerStatuses(prev => ({ ...prev, [targetId]: "retrying" }));

          removePeer(targetId);
          setTimeout(() => {
            if (socket.id > targetId) {
              createOfferRef.current(targetId);
            }
          }, 1000 + Math.random() * 500);
        } else {
          console.error(`[MESH] ❌ All retries exhausted for ${targetId}`);
          setPeerStatuses(prev => ({ ...prev, [targetId]: "failed" }));
          clearIceTimeout(targetId);
        }
      };

      const startIceTimeout = () => {
        clearIceTimeout(targetId);
        const timeoutId = setTimeout(() => {
          if (peer.iceConnectionState !== "connected" && peer.iceConnectionState !== "completed") {
            console.warn(`[MESH] ⏰ ICE timeout after ${ICE_TIMEOUT_MS}ms for ${targetId}`);
            handleRetry();
          }
        }, ICE_TIMEOUT_MS);
        timeoutsRef.current.set(targetId, timeoutId);
      };

      peer.oniceconnectionstatechange = () => {
        const state = peer.iceConnectionState;
        console.log(`[MESH] Peer ${targetId} ICE state:`, state);

        switch (state) {
          case "checking":
            setPeerStatuses(prev => ({ ...prev, [targetId]: "connecting" }));
            startIceTimeout();
            break;
          case "connected":
          case "completed":
            setPeerStatuses(prev => ({ ...prev, [targetId]: "connected" }));
            clearIceTimeout(targetId);
            retriesRef.current.set(targetId, 0);
            break;
          case "failed":
            handleRetry();
            break;
          case "disconnected":
            setPeerStatuses(prev => ({ ...prev, [targetId]: "connecting" }));
            startIceTimeout();
            break;
          case "closed":
            clearIceTimeout(targetId);
            break;
          default:
            break;
        }
      };
    }
    return peersRef.current.get(targetId);
  }, [clearIceTimeout, removePeer]);

  const createOffer = useCallback(async (targetId) => {
    const { peer } = getPeerObj(targetId);
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      console.log(`[MESH] Emitting offer to ${targetId}`);
      socket.emit("webrtc-offer", { targetId, offer });
    } catch (err) {
      console.error("[MESH] createOffer error:", err);
    }
  }, [getPeerObj]);

  createOfferRef.current = createOffer;

  useEffect(() => {
    async function drainIceCandidateQueue(targetId) {
      const peerObj = peersRef.current.get(targetId);
      if (!peerObj) return;
      while (peerObj.iceQueue.length > 0) {
        const candidate = peerObj.iceQueue.shift();
        try {
          await peerObj.peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("[MESH] queued ICE error:", err);
        }
      }
    }

    const processSignal = async (type, data) => {
      try {
        if (type === "all-users") {
          const users = data;
          users.forEach(userId => createOffer(userId));
        } else if (type === "user-joined") {
          const userId = data;
          getPeerObj(userId);
        } else if (type === "webrtc-offer") {
          const { senderId, offer } = data;
          const peerObj = getPeerObj(senderId);
          await peerObj.peer.setRemoteDescription(new RTCSessionDescription(offer));
          peerObj.remoteDescSet = true;
          await drainIceCandidateQueue(senderId);

          const answer = await peerObj.peer.createAnswer();
          await peerObj.peer.setLocalDescription(answer);
          console.log(`[MESH] Emitting answer to ${senderId}`);
          socket.emit("webrtc-answer", { targetId: senderId, answer });
        } else if (type === "webrtc-answer") {
          const { senderId, answer } = data;
          const peerObj = getPeerObj(senderId);
          await peerObj.peer.setRemoteDescription(new RTCSessionDescription(answer));
          peerObj.remoteDescSet = true;
          await drainIceCandidateQueue(senderId);
        } else if (type === "webrtc-ice-candidate") {
          const { senderId, candidate } = data;
          const peerObj = getPeerObj(senderId);
          if (peerObj.remoteDescSet) {
            await peerObj.peer.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            peerObj.iceQueue.push(candidate);
          }
        } else if (type === "user-disconnected") {
          removePeer(data);
        }
      } catch (err) {
        console.error(`[MESH] Error processing signal ${type}:`, err);
      }
    };

    const handleSignal = (type, data) => {
      if (isReadyRef.current) {
        processSignal(type, data);
      } else {
        console.log(`[MESH] Queuing signal ${type} (waiting for local media)`);
        pendingSignalsRef.current.push({ type, data });
      }
    };

    const listeners = {
      "all-users": (users) => handleSignal("all-users", users),
      "user-joined": (userId) => handleSignal("user-joined", userId),
      "webrtc-offer": (data) => handleSignal("webrtc-offer", data),
      "webrtc-answer": (data) => handleSignal("webrtc-answer", data),
      "webrtc-ice-candidate": (data) => handleSignal("webrtc-ice-candidate", data),
      "user-disconnected": (userId) => handleSignal("user-disconnected", userId),
    };

    Object.entries(listeners).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    async function init() {
      console.log("[MESH] Initialization started");

      try {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      } catch (err) {
        console.error("[MESH] getUserMedia FAILED:", err);
      }

      try {
        const result = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("timeout")), 5000);
          socket.emit("get-turn-credentials", (data) => {
            clearTimeout(timeout);
            resolve(data);
          });
        });
        if (result?.iceServers?.length) {
          iceServersRef.current = result.iceServers;
          console.log("[MESH] Got TURN credentials");
        }
      } catch (err) {
        console.warn("[MESH] TURN fetch failed, using STUN:", err.message);
      }

      console.log(`[MESH] Initialization complete. Processing ${pendingSignalsRef.current.length} queued signals.`);
      isReadyRef.current = true;
      while (pendingSignalsRef.current.length > 0) {
        const { type, data } = pendingSignalsRef.current.shift();
        processSignal(type, data);
      }
    }

    init();

    return () => {
      Object.keys(listeners).forEach(event => socket.off(event));
      peersRef.current.forEach(obj => obj.peer.close());
      peersRef.current.clear();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [getPeerObj, createOffer, removePeer]);

  return (
    <>
      {/* Status badge */}
      <div className="video-chat__status" style={{ color: statusColor }}>
        <span
          className={`video-chat__status-dot${dotAnimated ? " video-chat__status-dot--animated" : ""}`}
          style={{ backgroundColor: dotColor }}
        />
        {statusLabel}
      </div>

      {/* Remote videos */}
      <div className="video-chat__remote-container">
        {remoteStreams.map((rs, index) => {
          const bottomOffset = 20 + index * 230;
          return (
            <div
              key={rs.id}
              className="video-chat__remote-card"
              style={{ bottom: bottomOffset }}
            >
              <video
                ref={(el) => { if (el) el.srcObject = rs.stream; }}
                autoPlay
                playsInline
                className="video-chat__remote-video"
              />
              <span className="video-chat__remote-label">Opponent</span>
            </div>
          );
        })}
      </div>

      {/* Local video (PiP) */}
      <div className="video-chat__local-wrapper">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="video-chat__local-video"
        />
        <span className="video-chat__local-label">You</span>
      </div>

      {/* Controls */}
      <div className="video-chat__controls">
        <button
          onClick={toggleMute}
          className={`video-chat__ctrl-btn ${isMuted ? "video-chat__ctrl-btn--off" : "video-chat__ctrl-btn--on"}`}
          data-tooltip={isMuted ? "Unmute" : "Mute"}
          id="toggle-mute-btn"
        >
          {isMuted ? "🔇" : "🎤"}
        </button>
        <button
          onClick={toggleCamera}
          className={`video-chat__ctrl-btn ${isCameraOff ? "video-chat__ctrl-btn--off" : "video-chat__ctrl-btn--on"}`}
          data-tooltip={isCameraOff ? "Enable Camera" : "Disable Camera"}
          id="toggle-camera-btn"
        >
          {isCameraOff ? "📵" : "📷"}
        </button>
      </div>
    </>
  );
}