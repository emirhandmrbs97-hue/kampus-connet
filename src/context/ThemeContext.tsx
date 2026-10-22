import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
};

const KEY = 'campus-theme-mode';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(KEY)
      .then((saved) => {
        const next: ThemeMode =
          saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
        if (!active) return;
        setModeState(next);
        setColorScheme(next);
      })
      .catch((error: unknown) => {
        console.error('Tema tercihi yüklenemedi:', error);
      });
    return () => {
      active = false;
    };
  }, [setColorScheme]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      setColorScheme(next);
      void AsyncStorage.setItem(KEY, next).catch((error: unknown) => {
        console.error('Tema tercihi kaydedilemedi:', error);
      });
    },
    [setColorScheme],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, isDark: colorScheme === 'dark', setMode }),
    [mode, colorScheme, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
