import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUserWithCredentials } from "../services/api";

const initialForm = {
  email: "",
  password: "",
  confirmPassword: "",
  nombre: "",
  fecha_nacimiento: "",
  sexo: "mujer",
  peso: "",
  altura: "",
  peso_objetivo_kg: "",
  nivel_actividad: "3",
  objetivo: "perder",
  tipo_dieta: "mediterranea",
  intolerancias: [],
  intoleranciasExtra: "",
};

const activityOptions = [
  { value: "1", label: "Sedentario", detail: "poco o nada de ejercicio" },
  { value: "2", label: "Ligero", detail: "1-3 días por semana" },
  { value: "3", label: "Moderado", detail: "3-5 días por semana" },
  { value: "4", label: "Activo", detail: "6-7 días por semana" },
  { value: "5", label: "Muy activo", detail: "entrenamiento intenso" },
];

const intoleranceOptions = ["lactosa", "gluten", "frutos secos", "huevo", "marisco", "soja"];

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

  function handleIntoleranceChange(event) {
    const { value, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      intolerancias: checked
        ? [...prev.intolerancias, value]
        : prev.intolerancias.filter((item) => item !== value),
    }));
  }

  function getIntolerances() {
    const extra = formData.intoleranciasExtra
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    return [...new Set([...formData.intolerancias, ...extra])];
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (
      !formData.email.trim() ||
      !formData.password ||
      !formData.nombre.trim() ||
      !formData.fecha_nacimiento ||
      !formData.sexo ||
      !formData.peso ||
      !formData.altura ||
      !formData.peso_objetivo_kg ||
      !formData.nivel_actividad ||
      !formData.objetivo ||
      !formData.tipo_dieta
    ) {
      setError("Completa todos los datos para calcular tu perfil.");
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
        fecha_nacimiento: formData.fecha_nacimiento,
        sexo: formData.sexo,
        peso: Number(formData.peso),
        altura: Number(formData.altura),
        peso_objetivo_kg: Number(formData.peso_objetivo_kg),
        nivel_actividad: Number(formData.nivel_actividad),
        objetivo: formData.objetivo,
        tipo_dieta: formData.tipo_dieta,
        intolerancias: getIntolerances(),
      });

      navigate("/", { replace: true, state: { registered: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-large auth-card-elevated">
        <div className="auth-topbar">
          <p className="auth-kicker">BODYFUEL</p>
          <span className="auth-chip">Perfil calculado</span>
        </div>

        <h1>Registro</h1>
        <p className="auth-subtitle">Crea tu cuenta y calcularemos calorías, macros y objetivos automáticamente.</p>

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
            <label htmlFor="fecha_nacimiento">Fecha de nacimiento</label>
            <input
              id="fecha_nacimiento"
              name="fecha_nacimiento"
              type="date"
              value={formData.fecha_nacimiento}
              onChange={handleChange}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="sexo">Género</label>
            <select id="sexo" name="sexo" value={formData.sexo} onChange={handleChange} required>
              <option value="mujer">Mujer</option>
              <option value="hombre">Hombre</option>
            </select>
          </div>

          <div className="auth-field">
            <label htmlFor="peso">Peso actual (kg)</label>
            <input
              id="peso"
              name="peso"
              type="number"
              min="1"
              step="0.1"
              value={formData.peso}
              onChange={handleChange}
              placeholder="Ej. 68"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="altura">Altura (cm)</label>
            <input
              id="altura"
              name="altura"
              type="number"
              min="1"
              step="0.1"
              value={formData.altura}
              onChange={handleChange}
              placeholder="Ej. 165"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="peso_objetivo_kg">Peso objetivo (kg)</label>
            <input
              id="peso_objetivo_kg"
              name="peso_objetivo_kg"
              type="number"
              min="1"
              step="0.1"
              value={formData.peso_objetivo_kg}
              onChange={handleChange}
              placeholder="Ej. 58"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="objetivo">Objetivo</label>
            <select id="objetivo" name="objetivo" value={formData.objetivo} onChange={handleChange} required>
              <option value="perder">Definición / perder grasa</option>
              <option value="mantener">Mantenimiento</option>
              <option value="ganar">Volumen / ganar músculo</option>
            </select>
          </div>

          <div className="auth-field">
            <label htmlFor="nivel_actividad">Nivel de actividad</label>
            <select
              id="nivel_actividad"
              name="nivel_actividad"
              value={formData.nivel_actividad}
              onChange={handleChange}
              required
            >
              {activityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.detail}
                </option>
              ))}
            </select>
          </div>

          <div className="auth-field">
            <label htmlFor="tipo_dieta">Tipo de dieta</label>
            <select id="tipo_dieta" name="tipo_dieta" value={formData.tipo_dieta} onChange={handleChange} required>
              <option value="mediterranea">Mediterránea</option>
              <option value="omnivora">Omnívora</option>
              <option value="vegetariana">Vegetariana</option>
              <option value="vegana">Vegana</option>
              <option value="keto">Keto</option>
              <option value="alta en proteina">Alta en proteína</option>
            </select>
          </div>

          <fieldset className="auth-field auth-field-full auth-checkbox-field">
            <legend>Intolerancias</legend>
            <div className="auth-checkbox-grid">
              {intoleranceOptions.map((option) => (
                <label key={option} className="auth-checkbox-option">
                  <input
                    type="checkbox"
                    value={option}
                    checked={formData.intolerancias.includes(option)}
                    onChange={handleIntoleranceChange}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="auth-field auth-field-full">
            <label htmlFor="intoleranciasExtra">Otras intolerancias</label>
            <input
              id="intoleranciasExtra"
              name="intoleranciasExtra"
              type="text"
              value={formData.intoleranciasExtra}
              onChange={handleChange}
              placeholder="Separadas por comas"
            />
          </div>

          <button type="submit" className="auth-primary-button" disabled={loading}>
            {loading ? "Calculando perfil..." : "Crear cuenta"}
          </button>
        </form>

        <p className="auth-footer">
          ¿Ya tienes cuenta? <Link to="/">Ir a iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
