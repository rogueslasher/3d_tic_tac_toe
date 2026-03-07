import { useEffect, useRef, useState, useCallback } from "react";
import socket from "../network/socket";

// ─── Fallback ICE config (STUN only) ─
const FALLBACK_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export default function VideoChat({ roomId }) {
  const localVideoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Mesh Network State
  const localStreamRef = useRef(null);
  const iceServersRef = useRef(FALLBACK_ICE_SERVERS);
  const peersRef = useRef(new Map()); // targetId -> { peer, iceQueue, remoteDescSet }
  const isReadyRef = useRef(false);
  const pendingSignalsRef = useRef([]); // Queues signaling messages before local stream is ready

  const [remoteStreams, setRemoteStreams] = useState([]); // Array of { id, stream }

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

  const getPeerObj = useCallback((targetId) => {
    if (!peersRef.current.has(targetId)) {
      console.log(`[MESH] Creating new peer for target: ${targetId}`);
      const config = {
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 10,
      };

      const peer = new RTCPeerConnection(config);
      const peerObj = { peer, iceQueue: [], remoteDescSet: false };
      peersRef.current.set(targetId, peerObj);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peer.addTrack(track, localStreamRef.current);
        });
      }

      peer.ontrack = (event) => {
        console.log(`[MESH] Track received from ${targetId}`);
        setRemoteStreams(prev => {
          const removed = prev.filter(s => s.id !== targetId);
          return [...removed, { id: targetId, stream: event.streams[0] }];
        });
      };

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc-ice-candidate", { targetId, candidate: event.candidate });
        }
      };

      peer.oniceconnectionstatechange = () => {
        console.log(`[MESH] Peer ${targetId} ICE state:`, peer.iceConnectionState);
      };
    }
    return peersRef.current.get(targetId);
  }, []);

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

  const removePeer = useCallback((id) => {
    console.log(`[MESH] Removing peer ${id}`);
    const peerObj = peersRef.current.get(id);
    if (peerObj) {
      peerObj.peer.close();
      peersRef.current.delete(id);
    }
    setRemoteStreams(prev => prev.filter(s => s.id !== id));
  }, []);

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
          getPeerObj(userId); // Warm up peer object
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

    // Attach listeners wrapping in handleSignal
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

      // 1. Get local media
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

      // 2. Fetch TURN credentials
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

      // 3. Mark ready and process queue
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

  // Handle rendering multiple video feeds
  const renderRemoteVideos = () => {
    return remoteStreams.map((rs, index) => {
      const bottomOffset = 20 + (index * 240); // Stack them vertically

      return (
        <video
          key={rs.id}
          ref={(el) => { if (el) el.srcObject = rs.stream; }}
          autoPlay
          playsInline
          style={{
            position: "absolute",
            bottom: bottomOffset,
            right: 20,
            width: 300,
            height: 220,
            objectFit: "cover",
            borderRadius: 8,
            background: "#111",
            border: "2px solid #555"
          }}
        />
      );
    });
  };

  return (
    <>
      <div style={{ position: "relative", zIndex: 10 }}>
        {renderRemoteVideos()}
      </div>

      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "absolute",
          bottom: 30, // Positioned in the bottom right corner of the primary video
          right: 30,
          width: 90,
          height: 65,
          border: "none",
          objectFit: "cover",
          borderRadius: 6,
          zIndex: 20
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: 0,
          right: 20,
          display: "flex",
          gap: 8,
          zIndex: 30
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