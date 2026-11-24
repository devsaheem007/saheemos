import { create } from 'zustand';
import { api } from './api';

export interface User { _id: string; name: string; email: string; role: string; phone?: string; profileId?: string; mustChangePassword?: boolean }

interface AuthState {
  user: User | null; perms: Record<string, string>; ready: boolean;
  load: () => Promise<void>; login: (email: string, password: string) => Promise<User>; logout: () => Promise<void>;
  can: (resource: string, action?: string) => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null, perms: {}, ready: false,
  load: async () => {
    try { const { data } = await api.get('/auth/me'); set({ user: data.user, perms: data.permissions, ready: true }); }
    catch { set({ user: null, perms: {}, ready: true }); }
  },
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    set({ user: data.user, perms: data.permissions, ready: true });
    return data.user;
  },
  logout: async () => { try { await api.post('/auth/logout'); } finally { set({ user: null, perms: {} }); } },
  can: (resource, action = 'r') => (get().perms[resource] || '').includes(action),
}));

interface Toast { id: number; msg: string; kind: 'ok' | 'err' }
export const useToasts = create<{ items: Toast[]; push: (msg: string, kind?: 'ok' | 'err') => void; drop: (id: number) => void }>((set) => ({
  items: [],
  push: (msg, kind = 'ok') => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items, { id, msg, kind }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 4500);
  },
  drop: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));
export const toast = { ok: (m: string) => useToasts.getState().push(m, 'ok'), err: (m: string) => useToasts.getState().push(m, 'err') };

export const PORTAL = ['student', 'parent'];
export const homeFor = (role: string) => ([...PORTAL, 'teacher', 'class_teacher'].includes(role) ? '/app/me' : '/app');
