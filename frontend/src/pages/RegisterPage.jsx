import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUserWithCredentials } from "../services/api";

const initialForm = {
  email: "",
  password: "",
  confirmPassword: "",
  nombre: "",
  edad: "",
  peso: "",
  altura: "",
  objetivo: "",
  calorias_objetivo: "",
};

export default function RegisterPage() {
  const [formData, setFormData] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (
      !formData.email.trim() ||
      !formData.password ||
      !formData.nombre.trim() ||
      !formData.edad ||
      !formData.peso ||
      !formData.altura ||
      !formData.objetivo.trim() ||
      !formData.calorias_objetivo
    ) {
      setError("Completa todos los datos para registrarte.");
      return;
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);

      await registerUserWithCredentials({
        email: formData.email,
        password: formData.password,
        nombre: formData.nombre,
        edad: Number(formData.edad),
        peso: Number(formData.peso),
        altura: Number(formData.altura),
        objetivo: formData.objetivo,
        calorias_objetivo: Number(formData.calorias_objetivo),
      });

      navigate("/", { replace: true, state: { registered: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page auth-page--neon">
      <div className="auth-card auth-card-large auth-card-elevated">
        <div className="auth-topbar">
          <p className="auth-kicker">BODYFUEL</p>
          <span className="auth-chip">Nuevo perfil</span>
        </div>

        <h1>Registro</h1>
        <p className="auth-subtitle">Crea tu cuenta con tus datos personales y acceso.</p>

        {error ? <p className="error-text">{error}</p> : null}

        <form onSubmit={handleSubmit} className="auth-form auth-grid-form auth-form-spacious">
          <div className="auth-field">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="correo@dominio.com"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="confirmPassword">Confirmar contraseña</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="nombre">Nombre</label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Tu nombre"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="edad">Edad</label>
            <input
              id="edad"
              name="edad"
              type="number"
              min="0"
              value={formData.edad}
              onChange={handleChange}
              placeholder="Ej. 28"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="peso">Peso (kg)</label>
            <input
              id="peso"
              name="peso"
              type="number"
              min="0"
              step="0.1"
              value={formData.peso}
              onChange={handleChange}
              placeholder="Ej. 72.5"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="altura">Altura (cm)</label>
            <input
              id="altura"
              name="altura"
              type="number"
              min="0"
              step="0.1"
              value={formData.altura}
              onChange={handleChange}
              placeholder="Ej. 175"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="objetivo">Objetivo</label>
            <input
              id="objetivo"
              name="objetivo"
              type="text"
              value={formData.objetivo}
              onChange={handleChange}
              placeholder="Ej. Definición"
              required
            />
          </div>

          <div className="auth-field auth-field-full">
            <label htmlFor="calorias_objetivo">Calorías objetivo</label>
            <input
              id="calorias_objetivo"
              name="calorias_objetivo"
              type="number"
              min="0"
              value={formData.calorias_objetivo}
              onChange={handleChange}
              placeholder="Ej. 2200"
              required
            />
          </div>

          <button type="submit" className="auth-primary-button" disabled={loading}>
            {loading ? "Registrando..." : "Crear cuenta"}
          </button>
        </form>

        <p className="auth-footer">
          ¿Ya tienes cuenta? <Link to="/">Ir a iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
