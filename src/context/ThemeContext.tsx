import { useColorScheme } from 'nativewind';
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

function readSaved(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // storage unavailable
  }
  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(readSaved);

  useEffect(() => {
    setColorScheme(mode);
    // apply the saved mode once on startup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      setColorScheme(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // ignore
      }
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
