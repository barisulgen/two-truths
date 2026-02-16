import { describe, it, expect } from "vitest";
import { RoomManager } from "./RoomManager.js";

describe("RoomManager", () => {
  it("creates a room with a 4-letter code", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1", "Alice");
    expect(room.code).toMatch(/^[A-Z]{4}$/);
    expect(room.players).toHaveLength(1);
  });

  it("finds a room by code", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1", "Alice");
    expect(manager.findRoom(room.code)).toBe(room);
  });

  it("returns undefined for unknown code", () => {
    const manager = new RoomManager();
    expect(manager.findRoom("ZZZZ")).toBeUndefined();
  });

  it("finds room by player ID", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1", "Alice");
    expect(manager.findRoomByPlayerId("host-1")).toBe(room);
  });

  it("removes a room", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1", "Alice");
    manager.removeRoom(room.code);
    expect(manager.findRoom(room.code)).toBeUndefined();
  });

  it("generates unique codes", () => {
    const manager = new RoomManager();
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const room = manager.createRoom(`host-${i}`, `Player${i}`);
      codes.add(room.code);
    }
    expect(codes.size).toBe(20);
  });

  it("finds room by code case-insensitively", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1", "Alice");
    expect(manager.findRoom(room.code.toLowerCase())).toBe(room);
  });
});
