import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { Prefs, PrefKeys } from '../lib/storage';
import { DarkColors, LightColors, type ThemeColors } from './colors';
import { Typography } from './typography';

export type ThemeScheme = 'light' | 'dark' | 'system';
export type ThemeMode = ThemeScheme;

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  typography: typeof Typography;
  toggleTheme: () => void;
  setScheme: (scheme: ThemeScheme) => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeScheme>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void Prefs.init().then(() => {
      if (!active) return;
      const stored = Prefs.getString(PrefKeys.themeMode);
      if (stored === 'light' || stored === 'dark' || stored === 'system') setModeState(stored);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeScheme) => {
    Prefs.setString(PrefKeys.themeMode, next);
    setModeState(next);
    if (next === 'system') Appearance.setColorScheme('unspecified');
  }, []);

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const toggleTheme = useCallback(() => setMode(isDark ? 'light' : 'dark'), [isDark, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: isDark ? DarkColors : LightColors,
      isDark,
      typography: Typography,
      toggleTheme,
      setScheme: setMode,
      mode,
      setMode,
    }),
    [isDark, mode, setMode, toggleTheme],
  );

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
