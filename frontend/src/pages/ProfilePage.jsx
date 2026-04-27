import { useEffect, useState } from "react";
import {
  fetchFriends,
  fetchUserById,
  respondFriendInvitation,
  searchUsersForFriends,
  sendFriendInvitation,
  updateUser,
} from "../services/api";

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
  const [friendsData, setFriendsData] = useState({
    friends: [],
    incoming: [],
    outgoing: [],
  });
  const [friendSearchTerm, setFriendSearchTerm] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState("");
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [showProfileSection, setShowProfileSection] = useState(true);
  const [showFriendsSection, setShowFriendsSection] = useState(false);

  async function loadFriends(currentUserId) {
    try {
      setFriendsLoading(true);
      setFriendsError("");
      const data = await fetchFriends(currentUserId);
      setFriendsData(data);
    } catch (err) {
      const message = err.message || "";
      if (message.includes('{"detail":"Not Found"}')) {
        setFriendsError(
          "El backend activo no tiene el módulo de amigos. Reinicia el backend para habilitarlo."
        );
      } else {
        setFriendsError(message);
      }
    } finally {
      setFriendsLoading(false);
    }
  }

  useEffect(() => {
    async function loadProfileAndFriends() {
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

    loadProfileAndFriends();
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

  function handleFriendSearchInput(event) {
    setFriendSearchTerm(event.target.value);
  }

  async function handleFriendSearch(event) {
    event.preventDefault();
    setFriendsError("");

    const term = friendSearchTerm.trim();
    if (term.length < 2) {
      setFriendsError("Escribe al menos 2 caracteres para buscar.");
      return;
    }

    try {
      setFriendActionLoading(true);
      const results = await searchUsersForFriends(userId, term);
      setFriendSearchResults(results);
    } catch (err) {
      setFriendsError(err.message);
    } finally {
      setFriendActionLoading(false);
    }
  }

  async function handleSendInvitation(targetUserId) {
    try {
      setFriendActionLoading(true);
      setFriendsError("");
      await sendFriendInvitation(userId, targetUserId);
      setFriendSearchResults((prev) => prev.filter((candidate) => candidate.id !== targetUserId));
      await loadFriends(userId);
    } catch (err) {
      setFriendsError(err.message);
    } finally {
      setFriendActionLoading(false);
    }
  }

  async function handleAcceptInvitation(invitationId) {
    try {
      setFriendActionLoading(true);
      setFriendsError("");
      await respondFriendInvitation(invitationId, userId, true);
      await loadFriends(userId);
    } catch (err) {
      setFriendsError(err.message);
    } finally {
      setFriendActionLoading(false);
    }
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
        <button
          type="button"
          className="profile-friends-toggle"
          onClick={() => setShowProfileSection((prev) => !prev)}
          aria-expanded={showProfileSection}
        >
          <span>Datos actuales</span>
          <span>{showProfileSection ? "Ocultar" : "Mostrar"}</span>
        </button>

        {showProfileSection ? (
          <>
            <div className="profile-summary-head">
              <div>
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
          </>
        ) : null}
      </section>

      <section className="card profile-friends-panel">
        <button
          type="button"
          className="profile-friends-toggle"
          onClick={() => setShowFriendsSection((prev) => !prev)}
          aria-expanded={showFriendsSection}
        >
          <span>Amigos</span>
          <span>{showFriendsSection ? "Ocultar" : "Mostrar"}</span>
        </button>

        {showFriendsSection ? (
          <>
            <div className="profile-summary-head">
              <div>
                <h3>Buscar personas</h3>
                <p>Busca usuarios por nombre o correo para invitarlos a tu red.</p>
              </div>
            </div>

            {friendsError ? <p className="error-text">{friendsError}</p> : null}

            <form className="search-form profile-friends-search" onSubmit={handleFriendSearch}>
              <input
                type="text"
                value={friendSearchTerm}
                onChange={handleFriendSearchInput}
                placeholder="Buscar por nombre o correo"
              />
              <button type="submit" disabled={friendActionLoading || !userId}>
                Buscar
              </button>
            </form>

            {friendSearchResults.length > 0 ? (
              <div className="profile-friends-search-results">
                {friendSearchResults.map((candidate) => (
                  <div key={candidate.id} className="profile-friend-row">
                    <div>
                      <strong>{candidate.nombre}</strong>
                      <p>{candidate.email}</p>
                    </div>
                    <button
                      type="button"
                      className="profile-edit-button"
                      onClick={() => handleSendInvitation(candidate.id)}
                      disabled={friendActionLoading}
                    >
                      Invitar
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <section className="card profile-friends-panel">
              <div className="profile-summary-head">
                <div>
                  <h3>Mis amigos</h3>
                  <p>Personas que ya aceptaron tu invitación o tú aceptaste la suya.</p>
                </div>
                <button
                  type="button"
                  className="profile-edit-button"
                  disabled={!userId || friendActionLoading}
                  onClick={() => loadFriends(userId)}
                >
                  Actualizar
                </button>
              </div>

              {friendsLoading ? (
                <p>Cargando amigos...</p>
              ) : friendsData.friends.length === 0 ? (
                <p className="item-note">Todavía no tienes amigos agregados.</p>
              ) : (
                <div className="profile-friends-search-results">
                  {friendsData.friends.map((friend) => (
                    <div key={friend.id} className="profile-friend-row">
                      <div>
                        <strong>{friend.nombre}</strong>
                        <p>{friend.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card profile-friends-panel">
              <div className="profile-summary-head">
                <div>
                  <h3>Invitaciones recibidas</h3>
                  <p>Acepta solicitudes para añadir nuevos amigos.</p>
                </div>
                <button
                  type="button"
                  className="profile-edit-button"
                  disabled={!userId || friendActionLoading}
                  onClick={() => loadFriends(userId)}
                >
                  Actualizar
                </button>
              </div>

              {friendsLoading ? (
                <p>Cargando invitaciones...</p>
              ) : friendsData.incoming.length === 0 ? (
                <p className="item-note">No tienes invitaciones pendientes.</p>
              ) : (
                <div className="profile-friends-search-results">
                  {friendsData.incoming.map((invitation) => (
                    <div key={invitation.invitation_id} className="profile-friend-row">
                      <div>
                        <strong>{invitation.user.nombre}</strong>
                        <p>{invitation.user.email}</p>
                      </div>
                      <button
                        type="button"
                        className="profile-edit-button"
                        disabled={friendActionLoading}
                        onClick={() => handleAcceptInvitation(invitation.invitation_id)}
                      >
                        Aceptar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
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
