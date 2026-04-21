import { useEffect, useState } from "react";
import { fetchUserById, updateUser } from "../services/api";

const emptyProfile = {
  email: "",
  nombre: "",
  edad: "",
  peso: "",
  altura: "",
  objetivo: "",
  calorias_objetivo: "",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState(emptyProfile);
  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const storedUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");

        if (!storedUser?.id) {
          setError("No se encontró un usuario activo.");
          return;
        }

        setUserId(storedUser.id);

        const freshUser = await fetchUserById(storedUser.id);
        setProfile({
          email: freshUser.email || "",
          nombre: freshUser.nombre || "",
          edad: freshUser.edad?.toString() || "",
          peso: freshUser.peso?.toString() || "",
          altura: freshUser.altura?.toString() || "",
          objetivo: freshUser.objetivo || "",
          calorias_objetivo: freshUser.calorias_objetivo?.toString() || "",
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  function handleProfileChange(event) {
    const { name, value } = event.target;
    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function openEditModal() {
    setShowEditModal(true);
    setError("");
    setSuccess("");
  }

  function closeEditModal() {
    setShowEditModal(false);
    setPasswordData({ password: "", confirmPassword: "" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (passwordData.password || passwordData.confirmPassword) {
      if (passwordData.password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        return;
      }

      if (passwordData.password !== passwordData.confirmPassword) {
        setError("Las contraseñas no coinciden.");
        return;
      }
    }

    const payload = {};

    if (profile.email.trim()) payload.email = profile.email.trim();
    if (profile.nombre.trim()) payload.nombre = profile.nombre.trim();
    if (profile.edad.trim()) payload.edad = Number(profile.edad);
    if (profile.peso.trim()) payload.peso = Number(profile.peso);
    if (profile.altura.trim()) payload.altura = Number(profile.altura);
    if (profile.objetivo.trim()) payload.objetivo = profile.objetivo.trim();
    if (profile.calorias_objetivo.trim()) {
      payload.calorias_objetivo = Number(profile.calorias_objetivo);
    }
    if (passwordData.password) payload.password = passwordData.password;

    if (Object.keys(payload).length === 0) {
      setError("Completa al menos un dato para guardar.");
      return;
    }

    try {
      setSaving(true);
      const updatedUser = await updateUser(userId, payload);
      localStorage.setItem("bf_current_user", JSON.stringify(updatedUser));
      setSuccess("Perfil actualizado correctamente.");
      closeEditModal();
      setPasswordData({ password: "", confirmPassword: "" });
      setProfile({
        email: updatedUser.email || "",
        nombre: updatedUser.nombre || "",
        edad: updatedUser.edad?.toString() || "",
        peso: updatedUser.peso?.toString() || "",
        altura: updatedUser.altura?.toString() || "",
        objetivo: updatedUser.objetivo || "",
        calorias_objetivo: updatedUser.calorias_objetivo?.toString() || "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Cargando perfil...</p>;
  }

  return (
    <div className="page profile-page">
      <div className="page-header">
        <h2>Mi perfil</h2>
        <p>Revisa, completa y actualiza tus datos personales.</p>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {success ? <p className="success-text">{success}</p> : null}

      <section className="card profile-summary profile-summary-panel">
        <div className="profile-summary-head">
          <div>
            <h3>Datos actuales</h3>
            <p>Si algún campo está vacío, puedes completarlo en el editor.</p>
          </div>

          <button type="button" className="profile-edit-button" onClick={openEditModal}>
            Editar perfil
          </button>
        </div>

        <div className="profile-summary-list">
          <div><span>Correo</span><strong>{profile.email || "Sin datos"}</strong></div>
          <div><span>Nombre</span><strong>{profile.nombre || "Sin datos"}</strong></div>
          <div><span>Edad</span><strong>{profile.edad || "Sin datos"}</strong></div>
          <div><span>Peso</span><strong>{profile.peso ? `${profile.peso} kg` : "Sin datos"}</strong></div>
          <div><span>Altura</span><strong>{profile.altura ? `${profile.altura} cm` : "Sin datos"}</strong></div>
          <div><span>Objetivo</span><strong>{profile.objetivo || "Sin datos"}</strong></div>
          <div><span>Calorías objetivo</span><strong>{profile.calorias_objetivo || "Sin datos"}</strong></div>
        </div>
      </section>

      {showEditModal && (
        <div className="modal-overlay">
          <button
            type="button"
            className="modal-backdrop"
            onClick={closeEditModal}
            aria-label="Cerrar editor de perfil"
          />

          <div className="modal-card profile-modal-card">
            <div className="modal-header">
              <h3>Editar perfil</h3>
              <button type="button" className="close-button" onClick={closeEditModal} aria-label="Cerrar ventana">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="profile-form profile-modal-form">
              <div className="field-group">
                <label htmlFor="email">Correo</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={profile.email}
                  onChange={handleProfileChange}
                  placeholder="correo@dominio.com"
                />
              </div>

              <div className="field-group">
                <label htmlFor="nombre">Nombre</label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  value={profile.nombre}
                  onChange={handleProfileChange}
                  placeholder="Tu nombre"
                />
              </div>

              <div className="field-group">
                <label htmlFor="edad">Edad</label>
                <input
                  id="edad"
                  name="edad"
                  type="number"
                  min="0"
                  value={profile.edad}
                  onChange={handleProfileChange}
                  placeholder="Ej. 28"
                />
              </div>

              <div className="field-group">
                <label htmlFor="peso">Peso (kg)</label>
                <input
                  id="peso"
                  name="peso"
                  type="number"
                  min="0"
                  step="0.1"
                  value={profile.peso}
                  onChange={handleProfileChange}
                  placeholder="Ej. 72.5"
                />
              </div>

              <div className="field-group">
                <label htmlFor="altura">Altura (cm)</label>
                <input
                  id="altura"
                  name="altura"
                  type="number"
                  min="0"
                  step="0.1"
                  value={profile.altura}
                  onChange={handleProfileChange}
                  placeholder="Ej. 175"
                />
              </div>

              <div className="field-group">
                <label htmlFor="objetivo">Objetivo</label>
                <input
                  id="objetivo"
                  name="objetivo"
                  type="text"
                  value={profile.objetivo}
                  onChange={handleProfileChange}
                  placeholder="Ej. Definición"
                />
              </div>

              <div className="field-group">
                <label htmlFor="calorias_objetivo">Calorías objetivo</label>
                <input
                  id="calorias_objetivo"
                  name="calorias_objetivo"
                  type="number"
                  min="0"
                  value={profile.calorias_objetivo}
                  onChange={handleProfileChange}
                  placeholder="Ej. 2200"
                />
              </div>

              <div className="profile-password-box">
                <h4>Cambiar contraseña</h4>
                <p>Si no quieres cambiarla, deja estos campos vacíos.</p>

                <div className="field-group">
                  <label htmlFor="password">Nueva contraseña</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={passwordData.password}
                    onChange={handlePasswordChange}
                    placeholder="Nueva contraseña"
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="confirmPassword">Confirmar contraseña</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    placeholder="Repite la nueva contraseña"
                  />
                </div>
              </div>

              <button type="submit" className="profile-save-button" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
