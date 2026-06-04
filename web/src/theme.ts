// Light/dark theme management. The initial class is set by an inline script in
// index.html (to avoid a flash); these helpers let the UI toggle and persist it.
export type Theme = 'light' | 'dark';

export function getTheme(): Theme {
  return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

export function applyTheme(theme: Theme) {
  const el = document.documentElement;
  el.classList.toggle('light', theme === 'light');
  el.classList.toggle('dark', theme === 'dark');
  // Keep the mobile browser chrome color in sync.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f1f7f3' : '#0a0e16');
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* ignore */
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'light' ? 'dark' : 'light';
  applyTheme(next);
  return next;
}
