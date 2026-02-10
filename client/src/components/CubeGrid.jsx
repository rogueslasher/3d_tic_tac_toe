
export default function CubeGrid({
  board,
  onCellClick,
  winnerInfo,
  activeLayer,
}) {
  const size = 0.9;
  const gap = 0.15;

  const cubes = [];

  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 3; z++) {
        const index = x * 9 + y * 3 + z;
        const value = board[index];
        const layer = z; // depth layer

        const isWinningCube = winnerInfo?.line.includes(index);

        // 🎨 CLEAR BASE COLORS
        let color = "#e0e0e0"; // empty

        if (value === "X") color = "#42a5f5"; // blue
        if (value === "O") color = "#ef5350"; // red

        // 🟡 WIN OVERRIDES EVERYTHING
        if (isWinningCube) {
          color = "gold";
        }
        // 🔦 DIM ONLY WHEN A LAYER IS SELECTED
        else if (activeLayer !== null && activeLayer !== layer) {
          color = "#555555";
        }

        cubes.push(
          <mesh
            key={index}
            position={[
              (x - 1) * (size + gap),
              (y - 1) * (size + gap),
              (z - 1) * (size + gap),
            ]}
            onPointerDown={(e) => {
              e.stopPropagation();
              onCellClick(index);
            }}
          >
            <boxGeometry args={[size, size, size]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      }
    }
  }

  return <group>{cubes}</group>;
}
