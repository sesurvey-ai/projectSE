'use client';

import { useContext } from 'react';
import { SocketContext } from '@/providers/SocketProvider';

export function useSocket() {
  return useContext(SocketContext);
}
