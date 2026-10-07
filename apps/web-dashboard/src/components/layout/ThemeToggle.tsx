"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "soc-dashboard-theme";
const THEME_EVENT = "soc-dashboard-theme-change";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function readTheme(): Theme | null {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : null;
}

function subscribeToTheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let hasSavedPreference = false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    hasSavedPreference = saved === "light" || saved === "dark";
  } catch {
    // Theme selection still works for this session when storage is unavailable.
  }

  const updateFromSystem = (event: MediaQueryListEvent | MediaQueryList) => {
    if (hasSavedPreference) return;
    const nextTheme = event.matches ? "dark" : "light";
    applyTheme(nextTheme);
    onChange();
  };
  const updateFromStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    if (event.newValue === "light" || event.newValue === "dark") {
      hasSavedPreference = true;
      applyTheme(event.newValue);
    } else if (event.newValue === null) {
      hasSavedPreference = false;
      updateFromSystem(media);
      return;
    }
    onChange();
  };
  const updateFromCurrentTab = () => onChange();

  media.addEventListener?.("change", updateFromSystem);
  window.addEventListener("storage", updateFromStorage);
  window.addEventListener(THEME_EVENT, updateFromCurrentTab);
  return () => {
    media.removeEventListener?.("change", updateFromSystem);
    window.removeEventListener("storage", updateFromStorage);
    window.removeEventListener(THEME_EVENT, updateFromCurrentTab);
  };
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, () => null);

  function toggleTheme() {
    if (!theme) return;
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.dataset.themeTransition = "true";
    applyTheme(nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Keep the selected theme active even if it cannot be persisted.
    }
    window.setTimeout(() => root.removeAttribute("data-theme-transition"), 180);
  }

  const nextTheme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      disabled={theme === null}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === "light"}
      title={`Switch to ${nextTheme} mode`}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] disabled:cursor-wait"
    >
      {theme === "light" ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
    </button>
  );
}
