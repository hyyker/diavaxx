import { icon } from './icons.js';
import { STORAGE_KEY } from './model.js';

const preference = matchMedia('(prefers-color-scheme: dark)');
let selected = 'system';

export function applyTheme(theme = selected) {
  selected = theme;
  const effective = theme === 'system' ? (preference.matches ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = effective;
  document.documentElement.style.colorScheme = effective;
  const toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(effective === 'dark'));
    toggle.innerHTML = icon(effective === 'dark' ? 'sun' : 'moon');
  }
  document.querySelector('meta[name="theme-color"]').content =
    effective === 'dark' ? '#14251f' : '#176b55';
}
preference.addEventListener('change', () => applyTheme());

// Apply before rendering the app. An unreadable record is handled by the store.
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  applyTheme(saved?.settings?.theme);
} catch {
  applyTheme();
}
