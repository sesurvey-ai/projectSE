'use client';

import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { connect, disconnect } from '@/lib/socket';
import { useAuth } from '@/hooks/useAuth';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

export const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (isAuthenticated && token) {
      const s = connect(token);
      setSocket(s);
      s.on('connect', () => setConnected(true));
      s.on('disconnect', () => setConnected(false));
      return () => { disconnect(); setSocket(null); setConnected(false); };
    }
  }, [isAuthenticated, token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}
