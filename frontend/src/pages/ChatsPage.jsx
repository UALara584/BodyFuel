/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchFullPlansByUser, fetchRecipes } from "../services/api";
import {
  createOrGetChatConversation,
  fetchChatConversations,
  fetchChatMessages,
  markChatConversationRead,
  searchChatUsers,
  sendChatMessage,
} from "../services/chatApi";

function formatChatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  if (isToday) {
    return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function formatPlanRange(plan) {
  if (!plan?.semana_inicio || !plan?.semana_fin) return "Semana sin fecha";

  const start = new Date(plan.semana_inicio);
  const end = new Date(plan.semana_fin);
  const formatOptions = { day: "2-digit", month: "short" };

  return `${start.toLocaleDateString("es-ES", formatOptions)} - ${end.toLocaleDateString("es-ES", formatOptions)}`;
}

function getMessagePreview(message) {
  if (!message) return "Conversacion iniciada";
  if (message.message_type === "recipe_share") {
    return `Receta: ${message.recipe?.nombre || "receta compartida"}`;
  }
  if (message.message_type === "weekly_plan_share") {
    return "Plan semanal compartido";
  }
  return message.content || "Mensaje";
}

function getInitials(name) {
  return (name || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function notifyChatCountersChanged() {
  window.dispatchEvent(new Event("bf:chats-updated"));
}

function RecipeShareCard({ recipe, onOpen }) {
  if (!recipe) return null;

  return (
    <div className="chat-share-card">
      {recipe.imagen_url ? (
        <img src={recipe.imagen_url} alt="" className="chat-share-image" />
      ) : null}
      <div className="chat-share-content">
        <span>Receta compartida</span>
        <strong>{recipe.nombre}</strong>
        <div className="chat-share-meta">
          {recipe.tiempo_preparacion ? <small>{recipe.tiempo_preparacion} min</small> : null}
          {recipe.calorias_totales !== null && recipe.calorias_totales !== undefined ? (
            <small>{Number(recipe.calorias_totales).toFixed(0)} kcal</small>
          ) : null}
          {recipe.proteinas !== null && recipe.proteinas !== undefined ? (
            <small>{Number(recipe.proteinas).toFixed(1)} g prot.</small>
          ) : null}
        </div>
        <button type="button" className="secondary-action-button" onClick={onOpen}>
          Abrir receta
        </button>
      </div>
    </div>
  );
}

function PlanShareCard({ plan, onOpen }) {
  if (!plan) return null;

  return (
    <div className="chat-share-card">
      <div className="chat-share-content">
        <span>Plan semanal compartido</span>
        <strong>{plan.nombre || "Plan semanal"}</strong>
        <div className="chat-share-meta">
          <small>{formatPlanRange(plan)}</small>
          <small>{plan.meal_count} comidas</small>
          <small>{plan.recipe_count} recetas</small>
          <small>{plan.food_count} alimentos</small>
        </div>
        <button type="button" className="secondary-action-button" onClick={onOpen}>
          Abrir plan
        </button>
      </div>
    </div>
  );
}

function getPlanOptionSummary(plan) {
  const meals = plan.meals || [];
  const recipeIds = new Set();
  const foodIds = new Set();

  for (const meal of meals) {
    for (const item of meal.items || []) {
      if (item.recipe?.id) recipeIds.add(item.recipe.id);
      if (item.food?.id) foodIds.add(item.food.id);
    }
  }

  return {
    mealCount: meals.length,
    recipeCount: recipeIds.size,
    foodCount: foodIds.size,
  };
}

export default function ChatsPage() {
  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userId = currentUser?.id ?? null;
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const activeConversationId = conversationId ? Number(conversationId) : null;
  const messagesEndRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [conversationLoading, setConversationLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [messageText, setMessageText] = useState("");

  const [showNewConversation, setShowNewConversation] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [userSearchError, setUserSearchError] = useState("");

  const [shareType, setShareType] = useState("");
  const [shareOptions, setShareOptions] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  async function loadConversations() {
    if (!userId) return;

    try {
      setConversationLoading(true);
      setError("");
      const data = await fetchChatConversations(userId);
      setConversations(data || []);
      notifyChatCountersChanged();
    } catch (err) {
      setError(err.message || "No se pudieron cargar las conversaciones.");
    } finally {
      setConversationLoading(false);
    }
  }

  async function loadMessages() {
    if (!userId || !activeConversationId) {
      setMessages([]);
      return;
    }

    try {
      setMessagesLoading(true);
      setMessagesError("");
      const data = await fetchChatMessages(activeConversationId, userId);
      setMessages(data || []);
      await markChatConversationRead(activeConversationId, userId);
      notifyChatCountersChanged();
      await loadConversations();
    } catch (err) {
      setMessagesError(err.message || "No se pudieron cargar los mensajes.");
    } finally {
      setMessagesLoading(false);
    }
  }

  useEffect(() => {
    loadConversations();
  }, [userId]);

  useEffect(() => {
    loadMessages();
  }, [activeConversationId, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function handleSearchUsers(event) {
    event.preventDefault();
    if (!userId) return;

    try {
      setUserSearchLoading(true);
      setUserSearchError("");
      const data = await searchChatUsers(userId, userQuery);
      setUserResults(data || []);
    } catch (err) {
      setUserSearchError(err.message || "No se pudieron buscar usuarios.");
    } finally {
      setUserSearchLoading(false);
    }
  }

  async function handleStartConversation(user) {
    try {
      setUserSearchError("");
      const conversation = await createOrGetChatConversation(userId, user.id);
      setShowNewConversation(false);
      setUserQuery("");
      setUserResults([]);
      await loadConversations();
      navigate(`/chats/${conversation.id}`);
    } catch (err) {
      setUserSearchError(err.message || "No se pudo iniciar la conversacion.");
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    const content = messageText.trim();

    if (!content || !activeConversationId || !userId) return;

    try {
      setMessagesError("");
      await sendChatMessage(activeConversationId, {
        user_id: userId,
        content,
        message_type: "text",
      });
      setMessageText("");
      await loadMessages();
      await loadConversations();
      notifyChatCountersChanged();
    } catch (err) {
      setMessagesError(err.message || "No se pudo enviar el mensaje.");
    }
  }

  async function openSharePicker(type) {
    if (!userId) return;
    setShareType(type);
    setShareError("");
    setShareOptions([]);

    try {
      setShareLoading(true);
      if (type === "recipe") {
        const recipes = await fetchRecipes("", "", userId);
        setShareOptions(recipes || []);
      } else {
        const plans = await fetchFullPlansByUser(userId);
        setShareOptions(plans || []);
      }
    } catch (err) {
      setShareError(err.message || "No se pudieron cargar las opciones.");
    } finally {
      setShareLoading(false);
    }
  }

  function closeSharePicker() {
    setShareType("");
    setShareOptions([]);
    setShareError("");
  }

  async function handleShareItem(item) {
    if (!activeConversationId || !userId) return;

    try {
      setShareError("");
      await sendChatMessage(activeConversationId, {
        user_id: userId,
        message_type: shareType === "recipe" ? "recipe_share" : "weekly_plan_share",
        recipe_id: shareType === "recipe" ? item.id : null,
        weekly_plan_id: shareType === "plan" ? item.id : null,
      });
      closeSharePicker();
      await loadMessages();
      await loadConversations();
      notifyChatCountersChanged();
    } catch (err) {
      setShareError(err.message || "No se pudo compartir.");
    }
  }

  function renderMessage(message) {
    const isMine = message.sender?.id === userId;

    return (
      <div
        key={message.id}
        className={`chat-message-row ${isMine ? "chat-message-row-mine" : "chat-message-row-other"}`}
      >
        <div className={`chat-message-bubble ${isMine ? "mine" : "other"}`}>
          {!isMine ? <span className="chat-message-author">{message.sender?.nombre}</span> : null}
          {message.message_type === "text" ? (
            <p>{message.content}</p>
          ) : message.message_type === "recipe_share" ? (
            <RecipeShareCard
              recipe={message.recipe}
              onOpen={() => setSelectedRecipe(message.recipe)}
            />
          ) : (
            <PlanShareCard
              plan={message.weekly_plan}
              onOpen={() => navigate(`/plan?week=${message.weekly_plan?.semana_inicio || ""}`)}
            />
          )}
          <small>{formatChatDate(message.created_at)}</small>
        </div>
      </div>
    );
  }

  return (
    <div className="page chats-page">
      <div className="page-header page-header-row">
        <div>
          <h2>Chats</h2>
          <p>Habla con otros usuarios y comparte recetas o planes semanales.</p>
        </div>
        <button
          className="add-button"
          type="button"
          onClick={() => setShowNewConversation(true)}
          aria-label="Iniciar chat"
        >
          +
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <section className={`chats-layout ${activeConversationId ? "has-active-chat" : ""}`}>
        <aside className="card chats-list-panel">
          <div className="chats-list-header">
            <h3>Conversaciones</h3>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => setShowNewConversation(true)}
            >
              Nuevo chat
            </button>
          </div>

          {conversationLoading ? <p>Cargando conversaciones...</p> : null}

          {!conversationLoading && conversations.length === 0 ? (
            <div className="chat-empty-state">
              <strong>Aun no tienes conversaciones.</strong>
              <p>Busca un amigo para empezar a chatear.</p>
            </div>
          ) : null}

          <div className="chat-conversation-list">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`chat-conversation-item ${
                  conversation.id === activeConversationId ? "active" : ""
                }`}
                onClick={() => navigate(`/chats/${conversation.id}`)}
              >
                <span className="chat-avatar">{getInitials(conversation.other_user?.nombre)}</span>
                <span className="chat-conversation-main">
                  <strong>{conversation.other_user?.nombre}</strong>
                  <small>{getMessagePreview(conversation.last_message)}</small>
                </span>
                <span className="chat-conversation-meta">
                  <small>{formatChatDate(conversation.last_message_at)}</small>
                  {conversation.unread_count > 0 ? (
                    <span className="chat-unread-count">{conversation.unread_count}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="card chat-thread-panel">
          {!activeConversationId ? (
            <div className="chat-thread-empty">
              <strong>Selecciona una conversacion</strong>
              <p>Tambien puedes iniciar una nueva desde el boton superior.</p>
            </div>
          ) : (
            <>
              <header className="chat-thread-header">
                <button
                  type="button"
                  className="chat-back-button"
                  onClick={() => navigate("/chats")}
                  aria-label="Volver a conversaciones"
                >
                  &lt;
                </button>
                <span className="chat-avatar">{getInitials(selectedConversation?.other_user?.nombre)}</span>
                <div>
                  <h3>{selectedConversation?.other_user?.nombre || "Chat"}</h3>
                  <p>Comparte mensajes, recetas y planes semanales.</p>
                </div>
              </header>

              <div className="chat-share-actions">
                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={() => openSharePicker("recipe")}
                >
                  Compartir receta
                </button>
                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={() => openSharePicker("plan")}
                >
                  Compartir plan semanal
                </button>
              </div>

              {messagesError ? <p className="error-text">{messagesError}</p> : null}

              <div className="chat-messages">
                {messagesLoading ? <p>Cargando mensajes...</p> : null}
                {!messagesLoading && messages.length === 0 ? (
                  <div className="chat-empty-state">
                    <strong>No hay mensajes todavia.</strong>
                    <p>Escribe el primero para empezar la conversacion.</p>
                  </div>
                ) : null}
                {messages.map((message) => renderMessage(message))}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-compose-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Escribe un mensaje"
                />
                <button type="submit" className="submit-button" disabled={!messageText.trim()}>
                  Enviar
                </button>
              </form>
            </>
          )}
        </section>
      </section>

      {showNewConversation && (
        <div className="modal-overlay" onClick={() => setShowNewConversation(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Nuevo chat</h3>
              <button
                className="close-button"
                type="button"
                onClick={() => setShowNewConversation(false)}
                aria-label="Cerrar modal"
              >
                x
              </button>
            </div>

            <form className="search-form" onSubmit={handleSearchUsers}>
              <input
                type="text"
                value={userQuery}
                onChange={(event) => setUserQuery(event.target.value)}
                placeholder="Buscar por nombre o email"
              />
              <button type="submit">{userSearchLoading ? "Buscando..." : "Buscar"}</button>
            </form>

            {userSearchError ? <p className="error-text">{userSearchError}</p> : null}

            <div className="chat-picker-list">
              {userResults.length === 0 ? (
                <p className="item-note">Busca un usuario para empezar a chatear.</p>
              ) : (
                userResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="chat-picker-item"
                    onClick={() => handleStartConversation(user)}
                  >
                    <span className="chat-avatar">{getInitials(user.nombre)}</span>
                    <span>
                      <strong>{user.nombre}</strong>
                      <small>{user.email}</small>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {shareType && (
        <div className="modal-overlay" onClick={closeSharePicker}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{shareType === "recipe" ? "Compartir receta" : "Compartir plan semanal"}</h3>
              <button
                className="close-button"
                type="button"
                onClick={closeSharePicker}
                aria-label="Cerrar selector"
              >
                x
              </button>
            </div>

            {shareLoading ? <p>Cargando opciones...</p> : null}
            {shareError ? <p className="error-text">{shareError}</p> : null}

            <div className="chat-picker-list">
              {!shareLoading && shareOptions.length === 0 ? (
                <p className="item-note">
                  {shareType === "recipe"
                    ? "No tienes recetas para compartir."
                    : "No tienes planes semanales para compartir."}
                </p>
              ) : null}

              {shareOptions.map((item) => {
                const planSummary = shareType === "plan" ? getPlanOptionSummary(item) : null;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="chat-picker-item"
                    onClick={() => handleShareItem(item)}
                  >
                    <span>
                      <strong>{shareType === "recipe" ? item.nombre : "Plan semanal"}</strong>
                      <small>
                        {shareType === "recipe"
                          ? `${Number(item.calorias_totales || 0).toFixed(0)} kcal`
                          : `${item.semana_inicio} - ${planSummary.mealCount} comidas - ${planSummary.recipeCount} recetas`}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedRecipe && (
        <div className="modal-overlay" onClick={() => setSelectedRecipe(null)}>
          <div className="modal-card recipe-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedRecipe.nombre}</h3>
              <button
                className="close-button"
                type="button"
                onClick={() => setSelectedRecipe(null)}
                aria-label="Cerrar receta"
              >
                x
              </button>
            </div>

            <div className="recipe-detail-content">
              <div className="recipe-detail-macros">
                <div className="macro-item">
                  <strong>Calorias</strong>
                  <span>{Number(selectedRecipe.calorias_totales || 0).toFixed(1)} kcal</span>
                </div>
                <div className="macro-item">
                  <strong>Proteinas</strong>
                  <span>{Number(selectedRecipe.proteinas || 0).toFixed(1)} g</span>
                </div>
                <div className="macro-item">
                  <strong>Carbos</strong>
                  <span>{Number(selectedRecipe.carbos || 0).toFixed(1)} g</span>
                </div>
                <div className="macro-item">
                  <strong>Grasas</strong>
                  <span>{Number(selectedRecipe.grasas || 0).toFixed(1)} g</span>
                </div>
              </div>
              {selectedRecipe.tiempo_preparacion ? (
                <p>
                  <strong>Tiempo:</strong> {selectedRecipe.tiempo_preparacion} minutos
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
