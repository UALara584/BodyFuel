export const APP_SETTINGS_STORAGE_KEY = "bf_app_settings";
export const APP_SETTINGS_UPDATED_EVENT = "bf:settings-updated";

export const DEFAULT_APP_SETTINGS = {
  theme: "dark",
  chatBadges: true,
};

function normalizeAppSettings(settings = {}) {
  return {
    theme: settings.theme === "light" ? "light" : "dark",
    chatBadges: settings.chatBadges !== false,
  };
}

export function getStoredAppSettings() {
  try {
    const rawSettings = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    const parsedSettings = rawSettings ? JSON.parse(rawSettings) : {};
    const storedSettings =
      parsedSettings && typeof parsedSettings === "object" ? parsedSettings : {};
    return normalizeAppSettings({
      ...DEFAULT_APP_SETTINGS,
      ...storedSettings,
    });
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function applyTheme(theme) {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = normalizedTheme;
  document.documentElement.style.colorScheme = normalizedTheme;
}

export function applyAppSettings(settings) {
  const normalizedSettings = normalizeAppSettings(settings);
  const root = document.documentElement;

  applyTheme(normalizedSettings.theme);
  root.dataset.chatBadges = normalizedSettings.chatBadges ? "visible" : "hidden";

  return normalizedSettings;
}

export function saveAppSettings(settings) {
  const nextSettings = normalizeAppSettings({
    ...DEFAULT_APP_SETTINGS,
    ...settings,
  });

  localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  applyAppSettings(nextSettings);
  window.dispatchEvent(new Event(APP_SETTINGS_UPDATED_EVENT));
  return nextSettings;
}
