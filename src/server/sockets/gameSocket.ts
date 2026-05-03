import { Server, Socket } from "socket.io";
import { roomManager } from "../services/roomManager.ts";

/**
 * Ana Socket.io Handler Fonksiyonu
 */
export function setupGameSockets(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`📡 Yeni bağlantı: ${socket.id}`);

    // Platforma Katılma
    socket.on("join_platform", (nickname: string) => {
      roomManager.addPlayer(socket.id, nickname);
      socket.emit("platform_joined", socket.id);
      broadcastRooms(io);
    });

    // Oda Oluşturma
    socket.on("create_room", (data: { name: string, gameType: string }) => {
      const newRoom = roomManager.createRoom(socket.id, data.name, data.gameType);
      if (newRoom) {
        socket.join(newRoom.id);
        socket.emit("room_created", newRoom);
        broadcastRooms(io);
        console.log(`🏠 Oda oluşturuldu: ${newRoom.name} (${newRoom.id})`);
      }
    });

    // Odaya Katılma
    socket.on("join_room", (roomId: string) => {
      const result = roomManager.joinRoom(roomId, socket.id);

      if (result.success && result.room) {
        socket.join(roomId);
        io.to(roomId).emit("player_joined", result.room);
        broadcastRooms(io);
      } else {
        socket.emit("error", { message: result.error });
      }
    });

    // Odadan Ayrılma
    socket.on("leave_room", () => {
      handlePlayerLeaving(socket, io);
    });

    // Mesaj Gönderme
    socket.on("send_message", (data: { message: string }) => {
      const player = roomManager.getPlayer(socket.id);
      if (player && player.roomId) {
        io.to(player.roomId).emit("new_message", {
          sender: player.nickname,
          text: data.message,
          timestamp: new Date()
        });
      }
    });

    // Oyun Hamlesi (Tic Tac Toe)
    socket.on("make_move", (data: { index: number }) => {
      handleTicTacToeMove(socket, io, data.index);
    });

    // Bağlantı Kesilmesi
    socket.on("disconnect", () => {
      handlePlayerLeaving(socket, io);
    });
  });
}

/**
 * Oyuncunun ayrılma senaryolarını yönetir
 */
function handlePlayerLeaving(socket: Socket, io: Server) {
  const result = roomManager.leaveRoom(socket.id);
  if (result.roomId) {
    socket.leave(result.roomId);
    if (!result.lastPlayerLeft && result.room) {
      io.to(result.roomId).emit("player_left", result.room);
    }
    broadcastRooms(io);
  }
  // Eğer disconnect ise player manager'dan tamamen silinmeli
  roomManager.removePlayer(socket.id);
}

/**
 * Tic Tac Toe Oyun Mantığı
 */
function handleTicTacToeMove(socket: Socket, io: Server, index: number) {
  const player = roomManager.getPlayer(socket.id);
  if (!player || !player.roomId) return;

  const room = roomManager.getRoom(player.roomId);
  if (!room) return;

  // Oyun başlatma (2 oyuncu olduğunda ve daha önce başlatılmamışsa)
  if (room.status === "waiting" && room.players.length === 2) {
    room.status = "playing";
    room.state = {
      board: Array(9).fill(null),
      turn: room.hostId,
      winner: null
    };
  }

  if (room.status !== "playing" || !room.state) return;
  const state = room.state;

  // Sıra kontrolü
  if (state.turn !== socket.id || state.board[index] !== null || state.winner) {
    return;
  }

  // Hamleyi yap
  const mark = socket.id === room.hostId ? "X" : "O";
  state.board[index] = mark;
  
  // Kazanan kontrolü
  const winPatterns = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]];
  let winnerMark = null;
  for (const [a, b, c] of winPatterns) {
    if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
      winnerMark = state.board[a];
      break;
    }
  }

  if (winnerMark) {
    state.winner = socket.id;
    room.status = "finished";
    io.to(room.id).emit("game_over", { winner: player.nickname, board: state.board });
  } else if (state.board.every((c: any) => c !== null)) {
    room.status = "finished";
    io.to(room.id).emit("game_over", { draw: true, board: state.board });
  } else {
    state.turn = room.players.find(p => p.id !== socket.id)?.id;
    io.to(room.id).emit("move_made", { playerId: socket.id, index, board: state.board, nextTurn: state.turn });
  }
}

/**
 * Mevcut odaları tüm lobiye yayınlar
 */
function broadcastRooms(io: Server) {
  const list = roomManager.getAllRooms();
  io.emit("room_list", list);
}

