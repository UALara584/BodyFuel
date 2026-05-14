import { useCallback, useEffect, useState } from "react";
import ProfileMenu from "../components/ProfileMenu";
import {
  fetchFriends,
  respondFriendInvitation,
  searchUsersForFriends,
  sendFriendInvitation,
} from "../services/api";

export default function FriendsPage() {
  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userId = currentUser?.id;
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

  const loadFriends = useCallback(async (currentUserId) => {
    if (!currentUserId) {
      setFriendsLoading(false);
      setFriendsError("No hay usuario activo.");
      return;
    }

    try {
      setFriendsLoading(true);
      setFriendsError("");
      const data = await fetchFriends(currentUserId);
      setFriendsData(data);
    } catch (err) {
      const message = err.message || "";
      if (message.includes('{"detail":"Not Found"}')) {
        setFriendsError(
          "El backend activo no tiene el modulo de amigos. Reinicia el backend para habilitarlo."
        );
      } else {
        setFriendsError(message);
      }
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      loadFriends(userId);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [loadFriends, userId]);

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

  return (
    <div className="page profile-area-page friends-page">
      <div className="profile-dashboard-layout">
        <section className="profile-main-column">
          <div className="page-header">
            <h2>Amigos</h2>
            <p>Gestiona tu red dentro de BodyFuel.</p>
          </div>

          {friendsError ? <p className="error-text">{friendsError}</p> : null}

          <section className="profile-friends-panel profile-section-panel">
            <div className="profile-summary-head">
              <div>
                <h3>Buscar personas</h3>
                <p>Busca usuarios por nombre o correo para invitarlos a tu red.</p>
              </div>
            </div>

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
          </section>

          <section className="profile-friends-panel profile-section-panel">
            <div className="profile-summary-head">
              <div>
                <h3>Mis amigos</h3>
                <p>Personas que ya aceptaron tu invitación o tu aceptaste la suya.</p>
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
              <p className="item-note">Todavia no tienes amigos agregados.</p>
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

          <section className="profile-friends-panel profile-section-panel">
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
        </section>

        <ProfileMenu />
      </div>
    </div>
  );
}
