function getDefaultApiBaseUrl() {
  const hostname = window.location.hostname === "0.0.0.0" ? "localhost" : window.location.hostname;
  return `${window.location.protocol}//${hostname}:8000`;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || getDefaultApiBaseUrl();

async function handleResponse(response, errorMessage) {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${errorMessage}: ${errorText}`);
  }
  return response.json();
}

export async function searchChatUsers(userId, query = "") {
  const params = new URLSearchParams({ user_id: userId });
  if (query.trim()) {
    params.append("q", query.trim());
  }

  const response = await fetch(`${API_BASE_URL}/chats/users/search?${params.toString()}`);
  return handleResponse(response, "Error al buscar usuarios para chat");
}

export async function fetchChatConversations(userId) {
  const response = await fetch(`${API_BASE_URL}/chats/conversations/${userId}`);
  return handleResponse(response, "Error al cargar conversaciones");
}

export async function createOrGetChatConversation(userId, otherUserId) {
  const response = await fetch(`${API_BASE_URL}/chats/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      other_user_id: otherUserId,
    }),
  });

  return handleResponse(response, "Error al iniciar conversacion");
}

export async function fetchChatMessages(conversationId, userId) {
  const params = new URLSearchParams({ user_id: userId });
  const response = await fetch(
    `${API_BASE_URL}/chats/conversations/${conversationId}/messages?${params.toString()}`
  );
  return handleResponse(response, "Error al cargar mensajes");
}

export async function sendChatMessage(conversationId, messageData) {
  const response = await fetch(`${API_BASE_URL}/chats/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messageData),
  });

  return handleResponse(response, "Error al enviar mensaje");
}

export async function markChatConversationRead(conversationId, userId) {
  const response = await fetch(`${API_BASE_URL}/chats/conversations/${conversationId}/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId }),
  });

  return handleResponse(response, "Error al marcar conversacion como leida");
}
