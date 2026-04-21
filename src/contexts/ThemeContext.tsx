import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'sky' | 'indigo' | 'emerald' | 'amber' | 'pink';

interface ThemeContextType {
  mode: ThemeMode;
  accent: AccentColor;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const ACCENT_VARS: Record<AccentColor, { primary: string; ring: string }> = {
  sky:     { primary: '199 89% 48%',  ring: '199 89% 48%' },
  indigo:  { primary: '239 84% 67%',  ring: '239 84% 67%' },
  emerald: { primary: '160 84% 39%',  ring: '160 84% 39%' },
  amber:   { primary: '38 92% 50%',   ring: '38 92% 50%' },
  pink:    { primary: '330 81% 60%',  ring: '330 81% 60%' },
};

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(mode: ThemeMode): boolean {
  const root = document.documentElement;
  const dark = mode === 'dark' || (mode === 'system' && getSystemDark());
  if (dark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  return dark;
}

function applyAccent(accent: AccentColor) {
  const root = document.documentElement;
  const vars = ACCENT_VARS[accent];
  root.style.setProperty('--primary', vars.primary);
  root.style.setProperty('--ring', vars.ring);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('theme-mode') as ThemeMode) || 'light';
  });
  const [accent, setAccentState] = useState<AccentColor>(() => {
    return (localStorage.getItem('theme-accent') as AccentColor) || 'sky';
  });
  const [isDark, setIsDark] = useState(false);

  // Apply theme on mount and when mode changes
  useEffect(() => {
    const dark = applyTheme(mode);
    setIsDark(dark);

    // Listen for system preference changes when in 'system' mode
    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        const d = applyTheme('system');
        setIsDark(d);
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [mode]);

  // Apply accent on mount and when accent changes
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  const setMode = (newMode: ThemeMode) => {
    localStorage.setItem('theme-mode', newMode);
    setModeState(newMode);
  };

  const setAccent = (newAccent: AccentColor) => {
    localStorage.setItem('theme-accent', newAccent);
    setAccentState(newAccent);
  };

  return (
    <ThemeContext.Provider value={{ mode, accent, isDark, setMode, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
