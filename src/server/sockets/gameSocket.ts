import { Server, Socket } from "socket.io";
import { roomManager } from "../services/roomManager.ts";

import { GameEngine } from "../games/ticTacToe.ts";

/**
 * Ana Socket.io Handler Fonksiyonu
 */
export function setupGameSockets(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`📡 Yeni bağlantı: ${socket.id}`);

    // Platforma Katılma
    socket.on("join_platform", (nickname: string) => {
      console.log(`👤 Oyuncu platforma katılmak istiyor: ${nickname} (ID: ${socket.id})`);
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
        
        // Sistem Mesajı: Katılma
        const player = roomManager.getPlayer(socket.id);
        io.to(roomId).emit("new_message", {
          sender: "Sistem",
          text: `${player?.nickname} odaya katıldı.`,
          timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          isSystem: true
        });

        // Oda dolduysa (2 kişi) oyunu başlat
        if (result.room.players.length === 2) {
          const game = GameEngine[result.room.gameType];
          if (game) {
            game.init(result.room);
            io.to(roomId).emit("game_started", result.room);
          }
        }

        broadcastRooms(io);
      } else {
        socket.emit("error", { message: result.error });
      }
    });

    // Hızlı Eşleşme
    socket.on("quick_match", () => {
       const room = roomManager.findQuickMatch();
       if (room) {
         // Uygun oda bulundu
         const result = roomManager.joinRoom(room.id, socket.id);
         if (result.success && result.room) {
           socket.join(room.id);
           io.to(room.id).emit("player_joined", result.room);
           
           if (result.room.players.length === 2) {
             const game = GameEngine[result.room.gameType];
             if (game) {
               game.init(result.room);
               io.to(room.id).emit("game_started", result.room);
             }
           }
           broadcastRooms(io);
         }
       } else {
         // Oda bulunamadı, yeni oda oluştur
         const player = roomManager.getPlayer(socket.id);
         const gameTypes = ["tictactoe", "rps"];
         const randomType = gameTypes[Math.floor(Math.random() * gameTypes.length)];
         const newRoom = roomManager.createRoom(socket.id, `${player?.nickname}'in Hızlı Odası`, randomType);
         if (newRoom) {
           socket.join(newRoom.id);
           socket.emit("room_created", newRoom);
           broadcastRooms(io);
         }
       }
    });

    // Tekrar Oyna (Rematch)
    socket.on("request_rematch", () => {
      const player = roomManager.getPlayer(socket.id);
      if (player && player.roomId) {
        // Diğer oyuncuya bildir
        socket.to(player.roomId).emit("rematch_offered", { sender: player.nickname });
      }
    });

    socket.on("accept_rematch", () => {
      const player = roomManager.getPlayer(socket.id);
      if (player && player.roomId) {
        const room = roomManager.getRoom(player.roomId);
        if (room) {
          const game = GameEngine[room.gameType];
          if (game) {
             game.init(room);
             io.to(room.id).emit("game_started", room);
          }
        }
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
          timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          isSystem: false
        });
      }
    });

    // Genel Oyun Hamlesi Yönetimi
    socket.on("make_move", (data: any) => {
      const player = roomManager.getPlayer(socket.id);
      if (!player || !player.roomId) return;

      const room = roomManager.getRoom(player.roomId);
      if (!room) return;

      const game = GameEngine[room.gameType];
      if (game) {
        game.handleMove(socket.id, room, io, data);
      }
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
  const player = roomManager.getPlayer(socket.id);
  const result = roomManager.leaveRoom(socket.id);
  
  if (result.roomId) {
    // Sistem Mesajı: Ayrılma
    if (player) {
      io.to(result.roomId).emit("new_message", {
        sender: "Sistem",
        text: `${player.nickname} odadan ayrıldı.`,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        isSystem: true
      });
    }

    socket.leave(result.roomId);
    if (!result.lastPlayerLeft && result.room) {
      // Eğer oyun devam ediyorsa, kalan oyuncuya bildir
      if (result.room.status === "playing") {
        result.room.status = "finished";
        const winner = result.room.players[0];
        io.to(result.roomId).emit("game_over", { 
          winner: winner.nickname, 
          board: result.room.state?.board || [],
          forfeit: true 
        });
      }
      io.to(result.roomId).emit("player_left", result.room);
    }
    broadcastRooms(io);
  }
  // Eğer disconnect ise player manager'dan tamamen silinmeli
  roomManager.removePlayer(socket.id);
}

/**
 * Mevcut odaları tüm lobiye yayınlar
 */
function broadcastRooms(io: Server) {
  const list = roomManager.getAllRooms();
  io.emit("room_list", list);
}

