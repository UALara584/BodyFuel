export const APP_SETTINGS_STORAGE_KEY = "bf_app_settings";

export const DEFAULT_APP_SETTINGS = {
  theme: "light",
  units: "metric",
  weeklyReminders: true,
  assistantPersonalization: true,
};

export function getStoredAppSettings() {
  try {
    const rawSettings = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    const parsedSettings = rawSettings ? JSON.parse(rawSettings) : {};

    return {
      ...DEFAULT_APP_SETTINGS,
      ...(parsedSettings && typeof parsedSettings === "object" ? parsedSettings : {}),
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function applyTheme(theme) {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = normalizedTheme;
  document.documentElement.style.colorScheme = normalizedTheme;
}

export function saveAppSettings(settings) {
  const nextSettings = {
    ...DEFAULT_APP_SETTINGS,
    ...settings,
    theme: settings.theme === "light" ? "light" : "dark",
  };

  localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  applyTheme(nextSettings.theme);
  return nextSettings;
}
