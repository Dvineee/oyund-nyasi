import { Server } from "socket.io";
import { Room } from "../services/roomManager.ts";

export interface GameModule {
  init(room: Room): void;
  handleMove(socketId: string, room: Room, io: Server, data: any): void;
}

/**
 * Tic Tac Toe Oyun Mantığı Modülü
 */
export const TicTacToeGame: GameModule = {
  init(room: Room) {
    room.status = "playing";
    room.state = {
      board: Array(9).fill(null),
      turn: room.hostId, // İlk hamle oda sahibinde (X)
      winner: null,
      marks: {
        [room.players[0].id]: "X",
        [room.players[1].id]: "O"
      }
    };
  },

  handleMove(socketId: string, room: Room, io: Server, data: any) {
    const state = room.state;
    if (!state || room.status !== "playing") return;

    // Sıra kontrolü
    if (state.turn !== socketId) {
      io.to(socketId).emit("error", { message: "Sıra sizde değil!" });
      return;
    }

    const index = data.index;
    // Geçersiz hamle kontrolü
    if (index < 0 || index > 8 || state.board[index] !== null || state.winner) return;

    // Hamleyi yap
    const mark = state.marks[socketId];
    state.board[index] = mark;

    // Kazanan kontrolü
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Satırlar
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Sütunlar
      [0, 4, 8], [2, 4, 6]             // Diagonaller
    ];

    let winnerMark = null;
    for (const [a, b, c] of winPatterns) {
      if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
        winnerMark = state.board[a];
        break;
      }
    }

    if (winnerMark) {
      state.winner = socketId;
      room.status = "finished";
      const winnerName = room.players.find(p => p.id === socketId)?.nickname;
      io.to(room.id).emit("game_over", { winner: winnerName, board: state.board });
    } else if (state.board.every((c: any) => c !== null)) {
      room.status = "finished";
      io.to(room.id).emit("game_over", { draw: true, board: state.board });
    } else {
      // Sırayı değiştir
      state.turn = room.players.find(p => p.id !== socketId)?.id;
      io.to(room.id).emit("move_made", { 
        playerId: socketId, 
        index, 
        board: state.board, 
        nextTurn: state.turn 
      });
    }
  }
};

import { TicTacToeGame } from "./ticTacToe.ts";
import { RockPaperScissorsGame } from "./rockPaperScissors.ts";

/**
 * Oyun Fabrikası (Yeni oyunlar buraya eklenir)
 */
export const GameEngine: Record<string, any> = {
  tictactoe: TicTacToeGame,
  rps: RockPaperScissorsGame
};
