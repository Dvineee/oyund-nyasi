import { v4 as uuidv4 } from "uuid";

export interface Player {
  id: string;
  nickname: string;
  roomId?: string;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  players: Player[];
  status: "waiting" | "playing" | "finished";
  gameType: string;
  maxPlayers: number;
  state?: any;
}

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private players: Map<string, Player> = new Map();

  // Oyuncu İşlemleri
  addPlayer(id: string, nickname: string) {
    this.players.set(id, { id, nickname });
  }

  getPlayer(id: string) {
    return this.players.get(id);
  }

  removePlayer(id: string) {
    const player = this.players.get(id);
    if (player && player.roomId) {
      this.leaveRoom(id);
    }
    this.players.delete(id);
  }

  // Oda İşlemleri
  createRoom(hostId: string, name: string, gameType: string = "tictactoe", maxPlayers: number = 2): Room | null {
    const player = this.players.get(hostId);
    if (!player) return null;

    const roomId = uuidv4();
    const newRoom: Room = {
      id: roomId,
      name: name || `${player.nickname}'in Odası`,
      hostId: hostId,
      players: [player],
      status: "waiting",
      gameType,
      maxPlayers
    };

    this.rooms.set(roomId, newRoom);
    player.roomId = roomId;
    return newRoom;
  }

  joinRoom(roomId: string, playerId: string): { success: boolean; error?: string; room?: Room } {
    const room = this.rooms.get(roomId);
    const player = this.players.get(playerId);

    if (!room) return { success: false, error: "Oda bulunamadı." };
    if (!player) return { success: false, error: "Oyuncu kaydı eksik." };
    if (room.players.length >= room.maxPlayers) return { success: false, error: "Oda dolu." };
    if (room.status !== "waiting") return { success: false, error: "Oyun zaten başladı." };

    room.players.push(player);
    player.roomId = roomId;
    return { success: true, room };
  }

  leaveRoom(playerId: string): { roomId?: string; lastPlayerLeft?: boolean; room?: Room } {
    const player = this.players.get(playerId);
    if (!player || !player.roomId) return {};

    const roomId = player.roomId;
    const room = this.rooms.get(roomId);
    
    if (room) {
      room.players = room.players.filter(p => p.id !== playerId);
      player.roomId = undefined;

      if (room.players.length === 0) {
        this.rooms.delete(roomId);
        return { roomId, lastPlayerLeft: true };
      } else {
        if (room.hostId === playerId) {
          room.hostId = room.players[0].id;
        }
        return { roomId, room };
      }
    }
    return {};
  }

  findQuickMatch(): Room | null {
    for (const room of this.rooms.values()) {
      if (room.status === "waiting" && room.players.length === 1) {
        return room;
      }
    }
    return null;
  }

  getAllRooms() {
    return Array.from(this.rooms.values()).map(r => ({
      id: r.id,
      name: r.name,
      playerCount: r.players.length,
      maxPlayers: r.maxPlayers,
      status: r.status,
      gameType: r.gameType
    }));
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }
}

export const roomManager = new RoomManager();
