export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: 'surveyor' | 'callcenter' | 'checker';
  [key: string]: unknown;
}

export function setToken(token: string): void {
  if (typeof window !== 'undefined') localStorage.setItem('token', token);
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') return localStorage.getItem('token');
  return null;
}

export function removeToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}

export function setUser(user: User): void {
  if (typeof window !== 'undefined') localStorage.setItem('user', JSON.stringify(user));
}

export function getUser(): User | null {
  if (typeof window !== 'undefined') {
    const s = localStorage.getItem('user');
    if (s) { try { return JSON.parse(s); } catch { return null; } }
  }
  return null;
}

export function getDashboardPath(role: string): string | null {
  switch (role) {
    case 'callcenter': return '/callcenter';
    case 'checker': return '/inspector';
    default: return null;
  }
}
