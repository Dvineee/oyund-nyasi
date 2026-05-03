import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";

/**
 * Oyuncu ve Oda Arayüzleri (Models)
 */
interface Player {
  id: string;
  nickname: string;
  roomId?: string;
}

interface Room {
  id: string;
  name: string;
  hostId: string;
  players: Player[];
  status: "waiting" | "playing" | "finished";
  gameType: "tictactoe";
  state?: any;
}

// Bellek içi durum yönetimi (Scalable çözümlerde Redis tercih edilebilir)
const rooms: Map<string, Room> = new Map();
const players: Map<string, Player> = new Map();

/**
 * Ana Socket.io Handler Fonksiyonu
 */
export function setupGameSockets(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`📡 Yeni bağlantı: ${socket.id}`);

    // Platforma Katılma
    socket.on("join_platform", (nickname: string) => {
      players.set(socket.id, { id: socket.id, nickname });
      socket.emit("platform_joined", socket.id);
      broadcastRooms(io);
    });

    // Oda Oluşturma
    socket.on("create_room", (data: { name: string, gameType: "tictactoe" }) => {
      const player = players.get(socket.id);
      if (!player) return;

      const roomId = uuidv4();
      const newRoom: Room = {
        id: roomId,
        name: data.name || `${player.nickname}'in Odası`,
        hostId: socket.id,
        players: [player],
        status: "waiting",
        gameType: data.gameType || "tictactoe"
      };

      rooms.set(roomId, newRoom);
      player.roomId = roomId;
      socket.join(roomId);
      
      socket.emit("room_created", newRoom);
      broadcastRooms(io);
      console.log(`🏠 Oda oluşturuldu: ${newRoom.name} (${roomId})`);
    });

    // Odaya Katılma
    socket.on("join_room", (roomId: string) => {
      const room = rooms.get(roomId);
      const player = players.get(socket.id);

      if (room && player && room.players.length < 2 && room.status === "waiting") {
        room.players.push(player);
        player.roomId = roomId;
        socket.join(roomId);

        io.to(roomId).emit("player_joined", room);
        broadcastRooms(io);
      } else {
        socket.emit("error", { message: "Oda dolu veya artık müsait değil." });
      }
    });

    // Mesaj Gönderme
    socket.on("send_message", (data: { message: string }) => {
      const player = players.get(socket.id);
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
      handleDisconnect(socket, io);
    });
  });
}

/**
 * Tic Tac Toe Oyun Mantığı
 */
function handleTicTacToeMove(socket: Socket, io: Server, index: number) {
  const player = players.get(socket.id);
  if (!player || !player.roomId) return;

  const room = rooms.get(player.roomId);
  if (!room) return;

  // Oyun başlatma (2 oyuncu olduğunda ilk hamlede başlar)
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
 * Çıkış İşlemleri
 */
function handleDisconnect(socket: Socket, io: Server) {
  const player = players.get(socket.id);
  if (player && player.roomId) {
    const room = rooms.get(player.roomId);
    if (room) {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        rooms.delete(player.roomId);
      } else {
        if (room.hostId === socket.id) room.hostId = room.players[0].id;
        io.to(player.roomId).emit("player_left", room);
      }
    }
  }
  players.delete(socket.id);
  broadcastRooms(io);
}

/**
 * Mevcut odaları tüm lobiye yayınlar
 */
function broadcastRooms(io: Server) {
  const list = Array.from(rooms.values()).map(r => ({
    id: r.id,
    name: r.name,
    playerCount: r.players.length,
    status: r.status,
    gameType: r.gameType
  }));
  io.emit("room_list", list);
}
