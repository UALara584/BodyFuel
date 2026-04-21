import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import FoodsPage from "./pages/FoodsPage";
import RecipesPage from "./pages/RecipesPage";
import PlanPage from "./pages/PlanPage";
import ProfilePage from "./pages/ProfilePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

// eslint-disable-next-line react/prop-types
function NavLinkItem({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link to={to} className={`nav-link ${isActive ? "active" : ""}`}>
      {children}
    </Link>
  );
}

function RequireAuth() {
  const hasUser = Boolean(localStorage.getItem("bf_current_user"));

  if (!hasUser) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function AppLayout() {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userName = currentUser?.nombre || "Usuario";

  function handleLogout() {
    localStorage.removeItem("bf_current_user");
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

      <div className="app-layout">
        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav">
        <NavLinkItem to="/home">Inicio</NavLinkItem>
        <NavLinkItem to="/foods">Alimentos</NavLinkItem>
        <NavLinkItem to="/recipes">Recetas</NavLinkItem>
        <NavLinkItem to="/plan">Plan semanal</NavLinkItem>
        <NavLinkItem to="/profile">Mi perfil</NavLinkItem>
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
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}