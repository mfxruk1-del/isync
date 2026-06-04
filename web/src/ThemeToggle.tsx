import { useState } from 'react';
import { getTheme, toggleTheme, type Theme } from './theme';

// A small sun/moon button that flips between light and dark.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getTheme());
  return (
    <button
      onClick={() => setTheme(toggleTheme())}
      className="chip"
      aria-label="Toggle light or dark mode"
      title="Toggle light / dark"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
