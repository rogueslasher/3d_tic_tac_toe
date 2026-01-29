export const WIN_LINES = [];

// Helper: index(x, y, z)
const idx = (x, y, z) => x * 9 + y * 3 + z;

/* =========================
   1. Rows (along z)
========================= */
for (let x = 0; x < 3; x++) {
  for (let y = 0; y < 3; y++) {
    WIN_LINES.push([
      idx(x, y, 0),
      idx(x, y, 1),
      idx(x, y, 2),
    ]);
  }
}

/* =========================
   2. Columns (along y)
========================= */
for (let x = 0; x < 3; x++) {
  for (let z = 0; z < 3; z++) {
    WIN_LINES.push([
      idx(x, 0, z),
      idx(x, 1, z),
      idx(x, 2, z),
    ]);
  }
}

/* =========================
   3. Vertical stacks (along x)
========================= */
for (let y = 0; y < 3; y++) {
  for (let z = 0; z < 3; z++) {
    WIN_LINES.push([
      idx(0, y, z),
      idx(1, y, z),
      idx(2, y, z),
    ]);
  }
}

/* =========================
   4. Diagonals in XY planes
========================= */
for (let x = 0; x < 3; x++) {
  WIN_LINES.push([
    idx(x, 0, 0),
    idx(x, 1, 1),
    idx(x, 2, 2),
  ]);
  WIN_LINES.push([
    idx(x, 0, 2),
    idx(x, 1, 1),
    idx(x, 2, 0),
  ]);
}

/* =========================
   5. Diagonals in XZ planes
========================= */
for (let y = 0; y < 3; y++) {
  WIN_LINES.push([
    idx(0, y, 0),
    idx(1, y, 1),
    idx(2, y, 2),
  ]);
  WIN_LINES.push([
    idx(0, y, 2),
    idx(1, y, 1),
    idx(2, y, 0),
  ]);
}

/* =========================
   6. Diagonals in YZ planes
========================= */
for (let z = 0; z < 3; z++) {
  WIN_LINES.push([
    idx(0, 0, z),
    idx(1, 1, z),
    idx(2, 2, z),
  ]);
  WIN_LINES.push([
    idx(0, 2, z),
    idx(1, 1, z),
    idx(2, 0, z),
  ]);
}

/* =========================
   7. Space diagonals (4)
========================= */
WIN_LINES.push([idx(0, 0, 0), idx(1, 1, 1), idx(2, 2, 2)]);
WIN_LINES.push([idx(0, 0, 2), idx(1, 1, 1), idx(2, 2, 0)]);
WIN_LINES.push([idx(0, 2, 0), idx(1, 1, 1), idx(2, 0, 2)]);
WIN_LINES.push([idx(0, 2, 2), idx(1, 1, 1), idx(2, 0, 0)]);
