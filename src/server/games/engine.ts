import { TicTacToeGame } from "./ticTacToe.ts";
import { RockPaperScissorsGame } from "./rockPaperScissors.ts";

/**
 * Oyun Fabrikası (Yeni oyunlar buraya eklenir)
 */
export const GameEngine: Record<string, any> = {
  tictactoe: TicTacToeGame,
  rps: RockPaperScissorsGame
};
