import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { loginUserWithCredentials } from "../services/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const currentUser = localStorage.getItem("bf_current_user");
    if (currentUser) {
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Introduce correo y contraseña para iniciar sesión.");
      return;
    }

    try {
      setLoading(true);
      const user = await loginUserWithCredentials({ email, password });
      localStorage.setItem("bf_current_user", JSON.stringify(user));
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page auth-page--neon">
      <div className="auth-card auth-card-elevated">
        <div className="auth-topbar">
          <p className="auth-kicker">BODYFUEL</p>
          <span className="auth-chip">Acceso seguro</span>
        </div>

        <h1>Iniciar sesión</h1>
        <p className="auth-subtitle">
          Accede con tu correo y contraseña para entrar a BodyFuel.
        </p>

        {location.state?.registered ? (
          <p className="success-text">Usuario creado. Ahora inicia sesión.</p>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}

        <form onSubmit={handleSubmit} className="auth-form auth-form-spacious">
          <div className="auth-field">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ej. correo@dominio.com"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
            />
          </div>

          <button type="submit" className="auth-primary-button" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="auth-footer">
          ¿No tienes cuenta? <Link to="/register">Regístrate aquí</Link>
        </p>
      </div>
    </div>
  );
}
