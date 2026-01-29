import { WIN_LINES } from "./winLines";

export function checkWinner(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (
      board[a] &&
      board[a] === board[b] &&
      board[a] === board[c]
    ) {
      return { winner: board[a], line };
    }
  }
  return null;
}
