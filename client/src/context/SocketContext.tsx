import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import type { ClientEvents, ServerEvents } from "@two-truths/shared";

type GameSocket = Socket<ServerEvents, ClientEvents>;

const SocketContext = createContext<GameSocket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket] = useState<GameSocket>(() =>
    io("http://localhost:3001", { autoConnect: false })
  );

  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket(): GameSocket {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error("useSocket must be used within SocketProvider");
  return socket;
}
