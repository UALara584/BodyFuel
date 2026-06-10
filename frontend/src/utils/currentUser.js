const CURRENT_USER_STORAGE_KEY = "bf_current_user";

export function sanitizeCurrentUser(user) {
  if (!user || typeof user !== "object" || Array.isArray(user)) {
    return null;
  }

  const safeUser = { ...user };
  delete safeUser.password;
  return safeUser;
}

export function getStoredCurrentUser() {
  try {
    const rawUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (!rawUser) return null;

    const parsedUser = JSON.parse(rawUser);
    const safeUser = sanitizeCurrentUser(parsedUser);

    if (!safeUser) {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      return null;
    }

    if (Object.hasOwn(parsedUser, "password")) {
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(safeUser));
    }

    return safeUser;
  } catch {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    return null;
  }
}

export function storeCurrentUser(user) {
  const safeUser = sanitizeCurrentUser(user);

  if (!safeUser) {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    return null;
  }

  localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(safeUser));
  return safeUser;
}

export function clearStoredCurrentUser() {
  localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
}
