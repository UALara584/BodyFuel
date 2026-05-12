import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import FoodsPage from "./pages/FoodsPage";
import RecipesPage from "./pages/RecipesPage";
import PlanPage from "./pages/PlanPage";
import ProfilePage from "./pages/ProfilePage";
import FriendsPage from "./pages/FriendsPage";
import SettingsPage from "./pages/SettingsPage";
import AssistantPage from "./pages/AssistantPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { useEffect, useState } from "react";

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
  };

  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {icons[name]}
      </g>
    </svg>
  );
}

function NavLinkItem({ to, icon, children }) {
  const location = useLocation();
  const isProfileArea = [
    "/profile",
    "/profile/edit",
    "/friends",
    "/settings",
    "/profile/friends",
    "/profile/settings",
  ].includes(location.pathname);
  const isActive = location.pathname === to || (to === "/profile" && isProfileArea);

  return (
    <Link to={to} className={`nav-link ${isActive ? "active" : ""}`}>
      <NavIcon name={icon} />
      <span className="nav-label">{children}</span>
    </Link>
  );
}

function RequireAuth() {
  const location = useLocation();
  const hasUser = Boolean(localStorage.getItem("bf_current_user"));

  if (!hasUser) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(() =>
    JSON.parse(localStorage.getItem("bf_current_user") || "null")
  );
  const userName = currentUser?.nombre || "Usuario";
  const isProfileArea = [
    "/profile",
    "/profile/edit",
    "/friends",
    "/settings",
    "/profile/friends",
    "/profile/settings",
  ].includes(location.pathname);

  useEffect(() => {
    function syncCurrentUser() {
      setCurrentUser(JSON.parse(localStorage.getItem("bf_current_user") || "null"));
    }

    window.addEventListener("bf:user-updated", syncCurrentUser);
    window.addEventListener("storage", syncCurrentUser);

    return () => {
      window.removeEventListener("bf:user-updated", syncCurrentUser);
      window.removeEventListener("storage", syncCurrentUser);
    };
  }, []);

  function handleLogout() {
    localStorage.removeItem("bf_current_user");
    setCurrentUser(null);
    navigate("/", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-text app-header-inner">
          <div>
            <h1>BodyFuel</h1>
            <p>Hola, {userName}. Planifica tu nutrición semanal.</p>
          </div>

          <button type="button" className="logout-button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className={`app-layout ${isProfileArea ? "app-layout-profile" : ""}`}>
        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav">
        <NavLinkItem to="/home" icon="home">Inicio</NavLinkItem>
        <NavLinkItem to="/foods" icon="foods">Alimentos</NavLinkItem>
        <NavLinkItem to="/recipes" icon="recipes">Recetas</NavLinkItem>
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
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/edit" element={<ProfilePage mode="edit" />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile/friends" element={<FriendsPage />} />
          <Route path="/profile/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
