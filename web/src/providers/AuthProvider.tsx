'use client';

import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '@/lib/api';
import { User, setToken as saveToken, getToken, removeToken, setUser as saveUser, getUser } from '@/lib/auth';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = getToken();
    const storedUser = getUser();

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
      api.get('/api/users/me')
        .then((res) => {
          if (res.data.success && res.data.data) {
            setUser(res.data.data);
            saveUser(res.data.data);
          }
        })
        .catch(() => {
          removeToken();
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post('/api/auth/login', { username, password });
    if (res.data.success && res.data.data) {
      const { token: t, user: u } = res.data.data;
      saveToken(t);
      saveUser(u);
      setToken(t);
      setUser(u);
    } else {
      throw new Error(res.data.message || 'เข้าสู่ระบบไม่สำเร็จ');
    }
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token && !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
