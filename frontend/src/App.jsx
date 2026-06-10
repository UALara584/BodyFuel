import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import FoodsPage from "./pages/FoodsPage";
import RecipesPage from "./pages/RecipesPage";
import PlanPage from "./pages/PlanPage";
import ProfilePage from "./pages/ProfilePage";
import FriendsPage from "./pages/FriendsPage";
import SettingsPage from "./pages/SettingsPage";
import ProgressPage from "./pages/ProgressPage";
import AssistantPage from "./pages/AssistantPage";
import ChatsPage from "./pages/ChatsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { UserAvatar } from "./components/UserAvatar";
import { useEffect, useState } from "react";
import { fetchUserById } from "./services/api";
import { fetchChatConversations } from "./services/chatApi";
import {
  clearStoredCurrentUser,
  getStoredCurrentUser,
  storeCurrentUser,
} from "./utils/currentUser";

function NavIcon({ name }) {
  const icons = {
    home: (
      <path d="M3.5 10.6 12 3.5l8.5 7.1v8.1a1.8 1.8 0 0 1-1.8 1.8h-4.1v-5.7H9.4v5.7H5.3a1.8 1.8 0 0 1-1.8-1.8z" />
    ),
    foods: (
      <>
        <path d="M6.7 3.2v17.6" />
        <path d="M4.1 3.3v5.1a2.6 2.6 0 0 0 5.2 0V3.3" />
        <path d="M17.2 3.2c-2.3 1-3.5 3.1-3.5 6.2v2.2h3.5v9.2" />
      </>
    ),
    recipes: (
      <>
        <path d="M5.5 4.2h10.2a2.8 2.8 0 0 1 2.8 2.8v12.1H7.4a3.4 3.4 0 0 1 0-6.8h11.1" />
        <path d="M7.4 12.3V4.2" />
        <path d="M10 7.5h5.4" />
      </>
    ),
    assistant: (
      <>
        <path d="M5 6.6h14v9.2a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" />
        <path d="M12 6.6V3.2" />
        <path d="M8.7 11.4h.1" />
        <path d="M15.2 11.4h.1" />
        <path d="M9.4 15.1h5.2" />
      </>
    ),
    chats: (
      <>
        <path d="M4.6 6.2h14.8a2.4 2.4 0 0 1 2.4 2.4v6.8a2.4 2.4 0 0 1-2.4 2.4H10l-5.4 3v-3.1a2.4 2.4 0 0 1-2.4-2.4V8.6a2.4 2.4 0 0 1 2.4-2.4z" />
        <path d="M7.6 10.7h8.8" />
        <path d="M7.6 14h5.4" />
      </>
    ),
    plan: (
      <>
        <path d="M5.2 4.8h13.6v15H5.2z" />
        <path d="M8.3 3.2v3.2" />
        <path d="M15.7 3.2v3.2" />
        <path d="M5.2 9h13.6" />
        <path d="M8.4 12.5h2" />
        <path d="M13.6 12.5h2" />
        <path d="M8.4 16h2" />
      </>
    ),
    profile: (
      <>
        <path d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4" />
        <path d="M4.6 20.2a7.8 7.8 0 0 1 14.8 0" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3.1" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
  };

  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {icons[name]}
      </g>
    </svg>
  );
}

function BrandMark() {
  return (
    <svg className="brand-mark-icon" viewBox="0 0 32 32" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path strokeWidth="2.2" d="M16 27c6.2-3.4 10-8.2 10-13.3 0-4.5-3.7-8.1-8.2-8.1-1.1 0-2.2.2-3.2.7" />
        <path strokeWidth="2.2" d="M14.8 26.7C9.4 23.1 6 18.6 6 13.8 6 9.2 9.7 5.6 14.2 5.6c1.2 0 2.4.3 3.5.8" />
        <path strokeWidth="2" d="M9.7 16h4.4l2.1-5.1 3 9.4 2-4.3h3.1" />
      </g>
    </svg>
  );
}

function NavLinkItem({ to, icon, children, badgeCount = 0 }) {
  const location = useLocation();
  const isProfileArea = [
    "/profile",
    "/profile/edit",
    "/friends",
    "/progress",
    "/profile/friends",
    "/profile/progress",
  ].includes(location.pathname);
  const isChatArea = to === "/chats" && location.pathname.startsWith("/chats");
  const isSettingsArea =
    to === "/settings" && ["/settings", "/profile/settings"].includes(location.pathname);
  const isActive =
    location.pathname === to ||
    (to === "/profile" && isProfileArea) ||
    isSettingsArea ||
    isChatArea;
  const visibleBadge = Number(badgeCount || 0);

  return (
    <Link to={to} className={`nav-link ${isActive ? "active" : ""}`}>
      <NavIcon name={icon} />
      <span className="nav-label-wrap">
        <span className="nav-label">{children}</span>
        {visibleBadge > 0 ? (
          <span className="nav-badge">{visibleBadge > 99 ? "99+" : visibleBadge}</span>
        ) : null}
      </span>
    </Link>
  );
}

function RequireAuth() {
  const hasUser = Boolean(getStoredCurrentUser());

  if (!hasUser) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(getStoredCurrentUser);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const userName = currentUser?.nombre || "Usuario";
  const isProfileArea = [
    "/profile",
    "/profile/edit",
    "/friends",
    "/settings",
    "/progress",
    "/profile/friends",
    "/profile/settings",
    "/profile/progress",
  ].includes(location.pathname);

  useEffect(() => {
    function syncCurrentUser() {
      setCurrentUser(getStoredCurrentUser());
    }

    window.addEventListener("bf:user-updated", syncCurrentUser);
    window.addEventListener("storage", syncCurrentUser);

    return () => {
      window.removeEventListener("bf:user-updated", syncCurrentUser);
      window.removeEventListener("storage", syncCurrentUser);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshCurrentUser() {
      const storedUser = getStoredCurrentUser();
      if (!storedUser?.id) return;

      try {
        const freshUser = await fetchUserById(storedUser.id);
        if (cancelled) return;

        const nextUser = storeCurrentUser({ ...storedUser, ...freshUser });
        setCurrentUser(nextUser);
      } catch {
        // Mantiene la sesión local si el backend no está disponible en ese momento.
      }
    }

    refreshCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    let cancelled = false;

    async function refreshChatUnreadCount() {
      if (!currentUser?.id) {
        setChatUnreadCount(0);
        return;
      }

      try {
        const conversations = await fetchChatConversations(currentUser.id);
        if (cancelled) return;

        const totalUnread = (conversations || []).reduce(
          (total, conversation) => total + Number(conversation.unread_count || 0),
          0
        );
        setChatUnreadCount(totalUnread);
      } catch {
        if (!cancelled) {
          setChatUnreadCount(0);
        }
      }
    }

    refreshChatUnreadCount();
    window.addEventListener("bf:chats-updated", refreshChatUnreadCount);
    const intervalId = window.setInterval(refreshChatUnreadCount, 30000);

    return () => {
      cancelled = true;
      window.removeEventListener("bf:chats-updated", refreshChatUnreadCount);
      window.clearInterval(intervalId);
    };
  }, [currentUser?.id, location.pathname]);

  function handleLogout() {
    clearStoredCurrentUser();
    setCurrentUser(null);
    navigate("/", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link to="/home" className="sidebar-brand">
          <span>BodyFuel</span>
          <small>Nutrición y rendimiento</small>
        </Link>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          <NavLinkItem to="/home" icon="home">Inicio</NavLinkItem>
          <NavLinkItem to="/foods" icon="foods">Alimentos</NavLinkItem>
          <NavLinkItem to="/recipes" icon="recipes">Recetas</NavLinkItem>
          <NavLinkItem to="/chats" icon="chats" badgeCount={chatUnreadCount}>Chats</NavLinkItem>
          <NavLinkItem to="/assistant" icon="assistant">Asistente IA</NavLinkItem>
          <NavLinkItem to="/plan" icon="plan">Plan semanal</NavLinkItem>
          <NavLinkItem to="/profile" icon="profile">Mi perfil</NavLinkItem>
        </nav>

        <div className="sidebar-secondary-nav">
          <NavLinkItem to="/settings" icon="settings">Ajustes</NavLinkItem>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div className="app-header-inner">
            <Link to="/home" className="mobile-brand" aria-label="Ir al inicio">
              <BrandMark />
              <span>BodyFuel</span>
            </Link>

            <p className="header-greeting">
              Buenos días, <strong>{userName}</strong>
            </p>

            <div className="header-actions">
              <span className="header-user">Hola, {userName}</span>
              <button type="button" className="logout-button" onClick={handleLogout}>
                Cerrar sesión
              </button>
              <Link to="/profile" className="header-avatar" aria-label="Abrir mi perfil">
                <UserAvatar
                  avatar={currentUser?.avatar}
                  name={userName}
                  className="header-avatar-image"
                />
              </Link>
            </div>
          </div>
        </header>

        <div className={`app-layout ${isProfileArea ? "app-layout-profile" : ""}`}>
          <main className="app-content">
            <Outlet />
          </main>
        </div>

        <footer className="app-footer">
          <p>© {new Date().getFullYear()} BodyFuel. Todos los derechos reservados.</p>
          <div>
            <Link to="/settings">Privacidad</Link>
            <Link to="/settings">Términos</Link>
            <Link to="/assistant">Contacto</Link>
          </div>
        </footer>
      </div>

      <nav className="bottom-nav">
        <NavLinkItem to="/home" icon="home">Inicio</NavLinkItem>
        <NavLinkItem to="/foods" icon="foods">Alimentos</NavLinkItem>
        <NavLinkItem to="/recipes" icon="recipes">Recetas</NavLinkItem>
        <NavLinkItem to="/chats" icon="chats" badgeCount={chatUnreadCount}>Chats</NavLinkItem>
        <NavLinkItem to="/assistant" icon="assistant">Asistente IA</NavLinkItem>
        <NavLinkItem to="/plan" icon="plan">Plan semanal</NavLinkItem>
        <NavLinkItem to="/profile" icon="profile">Mi perfil</NavLinkItem>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/foods" element={<FoodsPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/chats/:conversationId" element={<ChatsPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/edit" element={<ProfilePage mode="edit" />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/profile/friends" element={<FriendsPage />} />
          <Route path="/profile/settings" element={<SettingsPage />} />
          <Route path="/profile/progress" element={<ProgressPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
