import {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type TextSize = 'md' | 'lg' | 'xl';

const SIZE_PCT: Record<TextSize, string> = {md: '100%', lg: '112.5%', xl: '125%'};
const DARK_QUERY = '(prefers-color-scheme: dark)';

function load<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v as T) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode: setting lasts for this session only */ }
}

interface ThemeCtx {
  theme: ThemeChoice;
  resolved: 'light' | 'dark';
  setTheme(t: ThemeChoice): void;
  textSize: TextSize;
  setTextSize(s: TextSize): void;
}
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({children}: {children: React.ReactNode}): React.JSX.Element {
  const [theme, setThemeState] = useState<ThemeChoice>(() => load('reel.theme', ['system', 'light', 'dark'], 'system'));
  const [textSize, setSizeState] = useState<TextSize>(() => load('reel.textSize', ['md', 'lg', 'xl'], 'md'));
  const [systemDark, setSystemDark] = useState(() => matchMedia(DARK_QUERY).matches);

  useEffect(() => {
    const mq = matchMedia(DARK_QUERY);
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => { document.documentElement.dataset.theme = resolved; }, [resolved]);
  useEffect(() => { document.documentElement.style.fontSize = SIZE_PCT[textSize]; }, [textSize]);

  const setTheme = useCallback((t: ThemeChoice) => { setThemeState(t); save('reel.theme', t); }, []);
  const setTextSize = useCallback((s: TextSize) => { setSizeState(s); save('reel.textSize', s); }, []);
  const value = useMemo(() => ({theme, resolved, setTheme, textSize, setTextSize}), [theme, resolved, setTheme, textSize, setTextSize]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>');
  return v;
}
