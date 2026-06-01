import { useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import "./LandingPage.css";

/* ── Tiny spinning cube for the background ── */
function SpinningCube() {
  const ref = useRef();
  useFrame((_, delta) => {
    ref.current.rotation.x += delta * 0.3;
    ref.current.rotation.y += delta * 0.5;
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[1.8, 1.8, 1.8]} />
      <meshStandardMaterial
        color="#3d3830"
        wireframe
        transparent
        opacity={0.35}
      />
    </mesh>
  );
}

export default function LandingPage() {
  const [joinCode, setJoinCode] = useState("");

  const createRoom = () => {
    const newRoom = Math.random().toString(36).substring(2, 8);
    window.location.href = `/?room=${newRoom}`;
  };

  const joinRoom = () => {
    const code = joinCode.trim();
    if (code) {
      window.location.href = `/?room=${code}`;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") joinRoom();
  };

  return (
    <div className="landing">
      {/* Background 3D cube */}
      <div className="landing__bg-canvas">
        <Canvas camera={{ position: [3, 3, 3], fov: 45 }}>
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 5, 5]} intensity={0.7} color="#dcb965" />
          <SpinningCube />
        </Canvas>
      </div>

      {/* Grid overlay pattern */}
      <div className="landing__grid-overlay" />

      {/* Content */}
      <div className="landing__content">
        <div className="landing__badge">MULTIPLAYER • 3D • WEBRTC</div>

        <h1 className="landing__title" id="landing-title">
          <span className="landing__title-line">Tic Tac Toe</span>
          <span className="landing__title-accent">in 3D</span>
        </h1>

        <p className="landing__subtitle">
          Play on a 3×3×3 cube with video chat. Three in a row across any axis wins.
        </p>

        <div className="landing__actions">
          <button
            className="landing__btn landing__btn--primary"
            onClick={createRoom}
            id="create-room-btn"
          >
            <span className="landing__btn-icon">✦</span>
            Create Room
          </button>

          <div className="landing__divider">
            <span>or</span>
          </div>

          <div className="landing__join-group">
            <input
              type="text"
              className="landing__input"
              placeholder="Enter room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={handleKeyDown}
              id="room-code-input"
              maxLength={10}
            />
            <button
              className="landing__btn landing__btn--secondary"
              onClick={joinRoom}
              disabled={!joinCode.trim()}
              id="join-room-btn"
            >
              Join →
            </button>
          </div>
        </div>

        <div className="landing__footer">
          Built by{" "}
          <a
            href="https://github.com/rogueslasher"
            target="_blank"
            rel="noopener noreferrer"
          >
            Aniket Pandey
          </a>
        </div>
      </div>
    </div>
  );
}
