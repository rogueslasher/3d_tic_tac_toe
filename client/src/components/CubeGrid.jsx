import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function CubeGrid({
  board,
  onCellClick,
  winnerInfo,
  activeLayer,
  playerSymbol,
  currentTurn,
}) {
  const size = 0.85;
  const gap = 0.2;
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const isMyTurn = playerSymbol && playerSymbol === currentTurn;

  const cubes = [];

  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 3; z++) {
        const index = x * 9 + y * 3 + z;
        const value = board[index];
        const layer = z;
        const isWinningCube = winnerInfo?.line?.includes(index);
        const isHovered = hoveredIndex === index;
        const isEmpty = !value;

        // Dim if a layer filter is active and this isn't the selected layer
        const isDimmed = activeLayer !== null && activeLayer !== layer;

        cubes.push(
          <Cell
            key={index}
            index={index}
            position={[
              (x - 1) * (size + gap),
              (y - 1) * (size + gap),
              (z - 1) * (size + gap),
            ]}
            size={size}
            value={value}
            isEmpty={isEmpty}
            isWinningCube={isWinningCube}
            isDimmed={isDimmed}
            isHovered={isHovered}
            isMyTurn={isMyTurn}
            playerSymbol={playerSymbol}
            onCellClick={onCellClick}
            setHoveredIndex={setHoveredIndex}
          />
        );
      }
    }
  }

  return <group>{cubes}</group>;
}

/* ── Individual cell mesh ── */
function Cell({
  index,
  position,
  size,
  value,
  isEmpty,
  isWinningCube,
  isDimmed,
  isHovered,
  isMyTurn,
  playerSymbol,
  onCellClick,
  setHoveredIndex,
}) {
  const meshRef = useRef();
  const materialRef = useRef();

  // Colors
  const COLOR_X = new THREE.Color("#00d4ff");
  const COLOR_O = new THREE.Color("#ff3d9a");
  const COLOR_WIN = new THREE.Color("#ffd700");
  const COLOR_EMPTY = new THREE.Color("#2a2a4a");
  const COLOR_EMPTY_HOVER = new THREE.Color("#3a3a5a");
  const COLOR_DIMMED = new THREE.Color("#1a1a2e");
  const COLOR_GHOST_X = new THREE.Color("#00d4ff");
  const COLOR_GHOST_O = new THREE.Color("#ff3d9a");

  // Show ghost preview for empty cells when it's your turn and you hover
  const showGhost = isEmpty && isHovered && isMyTurn && !isDimmed;

  useFrame((_, delta) => {
    if (!materialRef.current) return;

    const mat = materialRef.current;
    let targetColor, targetEmissive, targetEmissiveIntensity, targetOpacity;

    if (isWinningCube) {
      targetColor = COLOR_WIN;
      targetEmissive = COLOR_WIN;
      // Pulsing glow for winning cells
      targetEmissiveIntensity = 0.4 + Math.sin(Date.now() * 0.004) * 0.3;
      targetOpacity = 1;
    } else if (isDimmed) {
      targetColor = COLOR_DIMMED;
      targetEmissive = COLOR_DIMMED;
      targetEmissiveIntensity = 0;
      targetOpacity = 0.15;
    } else if (showGhost) {
      // Ghost preview
      targetColor = playerSymbol === "X" ? COLOR_GHOST_X : COLOR_GHOST_O;
      targetEmissive = targetColor;
      targetEmissiveIntensity = 0.15;
      targetOpacity = 0.3;
    } else if (value === "X") {
      targetColor = COLOR_X;
      targetEmissive = COLOR_X;
      targetEmissiveIntensity = 0.3;
      targetOpacity = 0.92;
    } else if (value === "O") {
      targetColor = COLOR_O;
      targetEmissive = COLOR_O;
      targetEmissiveIntensity = 0.3;
      targetOpacity = 0.92;
    } else if (isHovered) {
      targetColor = COLOR_EMPTY_HOVER;
      targetEmissive = COLOR_EMPTY_HOVER;
      targetEmissiveIntensity = 0.05;
      targetOpacity = 0.2;
    } else {
      // Empty
      targetColor = COLOR_EMPTY;
      targetEmissive = COLOR_EMPTY;
      targetEmissiveIntensity = 0;
      targetOpacity = 0.12;
    }

    // Smooth lerp transitions
    const speed = 6 * delta;
    mat.color.lerp(targetColor, speed);
    mat.emissive.lerp(targetEmissive, speed);
    mat.emissiveIntensity += (targetEmissiveIntensity - mat.emissiveIntensity) * speed;
    mat.opacity += (targetOpacity - mat.opacity) * speed;
  });

  // Scale animation on hover
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const targetScale = isHovered && isEmpty && !isDimmed ? 1.08 : 1;
    const current = meshRef.current.scale.x;
    const newScale = current + (targetScale - current) * 6 * delta;
    meshRef.current.scale.setScalar(newScale);
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerDown={(e) => {
        e.stopPropagation();
        onCellClick(index);
      }}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHoveredIndex(index);
        document.body.style.cursor = isEmpty ? "pointer" : "default";
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHoveredIndex(null);
        document.body.style.cursor = "default";
      }}
    >
      <boxGeometry args={[size, size, size]} />
      <meshStandardMaterial
        ref={materialRef}
        color={isEmpty ? "#2a2a4a" : value === "X" ? "#00d4ff" : "#ff3d9a"}
        emissive={isEmpty ? "#2a2a4a" : value === "X" ? "#00d4ff" : "#ff3d9a"}
        emissiveIntensity={0}
        transparent
        opacity={isEmpty ? 0.12 : 0.9}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}
