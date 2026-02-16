import { GameRoom } from "./GameRoom.js";

export class RoomManager {
  private rooms = new Map<string, GameRoom>();

  createRoom(hostId: string, hostName: string): GameRoom {
    const code = this.generateCode();
    const room = new GameRoom(code, hostId, hostName);
    this.rooms.set(code, room);
    return room;
  }

  findRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  findRoomByPlayerId(playerId: string): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.id === playerId)) {
        return room;
      }
    }
    return undefined;
  }

  removeRoom(code: string) {
    this.rooms.delete(code);
  }

  cleanupStaleRooms(timeoutMs = 30 * 60 * 1000) {
    for (const [code, room] of this.rooms.entries()) {
      if (room.isStale(timeoutMs)) {
        this.rooms.delete(code);
      }
    }
  }

  private generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O to avoid confusion
    let code: string;
    do {
      code = Array.from({ length: 4 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join("");
    } while (this.rooms.has(code));
    return code;
  }
}
