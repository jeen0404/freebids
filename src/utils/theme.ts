import { useCallback, useState } from 'react';

/** Also read by the inline script in index.html, which applies the theme before first paint. */
const THEME_KEY = 'freebids_theme';

export function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = useCallback(() => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      try {
        localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      } catch {
        // storage blocked; the choice lasts for this page only
      }
      return next;
    });
  }, []);
  return [dark, toggle];
}
