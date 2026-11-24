import { create } from 'zustand';
import { Prefs, PrefKeys } from '../lib/storage';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const storedMode = (): ThemeMode => {
  const value = Prefs.getString(PrefKeys.themeMode);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'dark';
};

/** Port of lib/providers/theme_provider.dart. */
export const useThemeStore = create<ThemeState>((set) => ({
  mode: storedMode(),
  setMode: (mode) => {
    Prefs.setString(PrefKeys.themeMode, mode);
    set({ mode });
  },
}));
