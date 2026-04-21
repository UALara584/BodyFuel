import { Link, Route, Routes, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage";
import FoodsPage from "./pages/FoodsPage";
import RecipesPage from "./pages/RecipesPage";
import PlanPage from "./pages/PlanPage";

function NavLinkItem({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link to={to} className={`nav-link ${isActive ? "active" : ""}`}>
      {children}
    </Link>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-text">
          <h1>BodyFuel</h1>
          <p>Planificación nutricional semanal</p>
        </div>
      </header>

      <div className="app-layout">
        <aside className="side-nav">
          <NavLinkItem to="/">Inicio</NavLinkItem>
          <NavLinkItem to="/foods">Alimentos</NavLinkItem>
          <NavLinkItem to="/recipes">Recetas</NavLinkItem>
          <NavLinkItem to="/plan">Plan semanal</NavLinkItem>
        </aside>

        <main className="app-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/foods" element={<FoodsPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/plan" element={<PlanPage />} />
          </Routes>
        </main>
      </div>

      <nav className="bottom-nav">
        <NavLinkItem to="/">Inicio</NavLinkItem>
        <NavLinkItem to="/foods">Alimentos</NavLinkItem>
        <NavLinkItem to="/recipes">Recetas</NavLinkItem>
        <NavLinkItem to="/plan">Plan</NavLinkItem>
      </nav>
    </div>
  );
}