import { Server } from "socket.io";
import { Room } from "../services/roomManager.ts";
import { GameModule } from "./ticTacToe.ts";

export const RockPaperScissorsGame: GameModule = {
  init(room: Room) {
    room.status = "playing";
    room.state = {
      moves: {}, // { socketId: 'rock' | 'paper' | 'scissors' }
      scores: {},
      round: 1,
      results: null // Son elin sonucu
    };
    room.players.forEach(p => {
      room.state.scores[p.id] = 0;
    });
  },

  handleMove(socketId: string, room: Room, io: Server, data: any) {
    const state = room.state;
    if (!state || room.status !== "playing") return;

    // Zaten hamle yapmış mı kontrol et
    if (state.moves[socketId]) return;

    // Geçerli hamle mi?
    const validMoves = ["rock", "paper", "scissors"];
    if (!validMoves.includes(data.move)) return;

    // Hamleyi kaydet
    state.moves[socketId] = data.move;

    // Her iki oyuncu da hamle yaptı mı?
    if (Object.keys(state.moves).length === 2) {
      this.resolveRound(room, io);
    } else {
      // Sadece diğer oyuncuya "hazır" bilgisini gönder (hamleyi gizli tut)
      io.to(room.id).emit("player_ready", { playerId: socketId });
    }
  },

  resolveRound(room: Room, io: Server) {
    const state = room.state;
    const p1Id = room.players[0].id;
    const p2Id = room.players[1].id;
    const move1 = state.moves[p1Id];
    const move2 = state.moves[p2Id];

    let winnerId = null;

    if (move1 !== move2) {
      if (
        (move1 === "rock" && move2 === "scissors") ||
        (move1 === "paper" && move2 === "rock") ||
        (move1 === "scissors" && move2 === "paper")
      ) {
        winnerId = p1Id;
      } else {
        winnerId = p2Id;
      }
    }

    if (winnerId) {
      state.scores[winnerId]++;
    }

    const roundResult = {
      moves: state.moves,
      winnerId: winnerId,
      scores: state.scores,
      round: state.round
    };

    state.results = roundResult;
    state.moves = {}; // Sıfırla
    state.round++;

    io.to(room.id).emit("round_resolved", roundResult);

    // 3 puana ulaşan kazanır
    if (state.scores[p1Id] >= 3 || state.scores[p2Id] >= 3) {
      room.status = "finished";
      const finalWinner = state.scores[p1Id] >= 3 ? room.players[0].nickname : room.players[1].nickname;
      io.to(room.id).emit("game_over", { winner: finalWinner, scores: state.scores });
    }
  }
};
