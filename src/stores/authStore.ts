import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  initialized: boolean;
  deviceSignOutReason: string | null;
  setUser: (user: User | null) => void;
  setInitialized: (initialized: boolean) => void;
  setDeviceSignOutReason: (reason: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,
  deviceSignOutReason: null,
  setUser: (user) => set({ user }),
  setInitialized: (initialized) => set({ initialized }),
  setDeviceSignOutReason: (deviceSignOutReason) => set({ deviceSignOutReason }),
}));
