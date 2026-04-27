const API_BASE_URL = "http://localhost:8000";

async function handleResponse(response, errorMessage) {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${errorMessage}: ${errorText}`);
  }
  return response.json();
}

export async function fetchFoods(nombre = "", userId = null) {
  const params = new URLSearchParams();

  if (nombre) {
    params.append("nombre", nombre);
  }

  if (userId !== null && userId !== undefined) {
    params.append("user_id", userId);
  }

  const response = await fetch(`${API_BASE_URL}/foods/?${params.toString()}`);
  return handleResponse(response, "Error al cargar alimentos");
}

export async function fetchRecipes(nombre = "", tipoDieta = "", userId = null) {
  const params = new URLSearchParams();

  if (nombre) params.append("nombre", nombre);
  if (tipoDieta) params.append("tipo_dieta", tipoDieta);
  if (userId !== null && userId !== undefined) params.append("user_id", userId);

  const query = params.toString();
  const url = query
    ? `${API_BASE_URL}/recipes/?${query}`
    : `${API_BASE_URL}/recipes/`;

  const response = await fetch(url);
  return handleResponse(response, "Error al obtener recetas");
}

export async function deleteRecipe(recipeId) {
  const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al eliminar receta: ${errorText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

export async function fetchFullPlan(userId, weekStart) {
  const response = await fetch(`${API_BASE_URL}/plans/${userId}/${weekStart}/full`);
  return handleResponse(response, "Error al obtener el plan semanal");
}

export async function createPlan(planData) {
  const response = await fetch(`${API_BASE_URL}/plans/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(planData),
  });

  return handleResponse(response, "Error al crear el plan semanal");
}

export async function createMeal(mealData) {
  const response = await fetch(`${API_BASE_URL}/meals/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mealData),
  });

  return handleResponse(response, "Error al crear comida");
}

export async function createMealItem(mealItemData) {
  const response = await fetch(`${API_BASE_URL}/meal-items/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mealItemData),
  });

  return handleResponse(response, "Error al añadir elemento a la comida");
}

export async function deleteMealItem(itemId) {
  const response = await fetch(`${API_BASE_URL}/meal-items/${itemId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al eliminar elemento: ${errorText}`);
  }

  return null;
}

export async function createFood(foodData) {
  const response = await fetch(`${API_BASE_URL}/foods/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(foodData),
  });

  return handleResponse(response, "Error al crear alimento");
}

export async function deleteFood(foodId) {
  const response = await fetch(`${API_BASE_URL}/foods/${foodId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al eliminar alimento: ${errorText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

export async function fetchUsers() {
  const response = await fetch(`${API_BASE_URL}/users/`);
  return handleResponse(response, "Error al obtener usuarios");
}

export async function fetchUserById(userId) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}`);
  return handleResponse(response, "Error al obtener usuario");
}

export async function fetchTrackingByUser(userId) {
  const response = await fetch(`${API_BASE_URL}/tracking/${userId}`);
  return handleResponse(response, "Error al obtener seguimiento");
}

export async function registerUser(userData) {
  const response = await fetch(`${API_BASE_URL}/users/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  return handleResponse(response, "Error al registrar usuario");
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export async function registerUserWithCredentials({
  email,
  password,
  nombre,
  edad,
  peso,
  altura,
  objetivo,
  calorias_objetivo,
}) {
  const normalizedEmail = normalizeEmail(email);

  return registerUser({
    email: normalizedEmail,
    password,
    nombre,
    edad,
    peso,
    altura,
    objetivo,
    calorias_objetivo,
  });
}

export async function loginUserWithCredentials({ email, password }) {
  const response = await fetch(`${API_BASE_URL}/users/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: normalizeEmail(email),
      password,
    }),
  });

  return handleResponse(response, "Correo o contraseña incorrectos");
}

export async function updateUser(userId, userData) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  return handleResponse(response, "Error al actualizar usuario");
}

export async function askNutritionAssistant(message, userId) {
  const response = await fetch(`${API_BASE_URL}/assistant/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, user_id: userId ?? null }),
  });

  return handleResponse(response, "Error al consultar el asistente");
}

export async function fetchAssistantHistory(userId, limit = 80) {
  const response = await fetch(`${API_BASE_URL}/assistant/history/${userId}?limit=${limit}`);
  return handleResponse(response, "Error al cargar historial del asistente");
}

export async function clearAssistantHistory(userId) {
  const response = await fetch(`${API_BASE_URL}/assistant/history/${userId}`, {
    method: "DELETE",
  });

  return handleResponse(response, "Error al limpiar historial del asistente");
}

export async function createRecipe(recipeData) {
  const response = await fetch(`${API_BASE_URL}/recipes/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(recipeData),
  });

  return handleResponse(response, "Error al crear receta");
}

export async function fetchExternalFoods(query) {
  const response = await fetch(
    `${API_BASE_URL}/external-foods/?q=${encodeURIComponent(query)}`
  );

  return handleResponse(response, "Error al buscar alimentos en API externa");
}

export async function importFoodFromApi(foodData) {
  const response = await fetch(`${API_BASE_URL}/foods/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(foodData),
  });

  return handleResponse(response, "Error al guardar alimento desde API");
}
export async function createRecipeWithItems(recipeData) {
  const response = await fetch(`${API_BASE_URL}/recipes/with-items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(recipeData),
  });

  return handleResponse(response, "Error al crear receta con alimentos");
}

export async function fetchFriends(userId) {
  const response = await fetch(`${API_BASE_URL}/friends/${userId}`);
  return handleResponse(response, "Error al obtener amigos");
}

export async function searchUsersForFriends(userId, query) {
  const response = await fetch(
    `${API_BASE_URL}/friends/${userId}/search?q=${encodeURIComponent(query)}`
  );

  if (response.status === 404) {
    const allUsers = await fetchUsers();
    const normalizedQuery = query.trim().toLowerCase();
    return allUsers
      .filter((user) => user.id !== userId)
      .filter((user) => {
        const name = (user.nombre || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        return name.includes(normalizedQuery) || email.includes(normalizedQuery);
      })
      .slice(0, 15);
  }

  return handleResponse(response, "Error al buscar usuarios");
}

export async function sendFriendInvitation(requesterId, addresseeId) {
  const response = await fetch(`${API_BASE_URL}/friends/invitations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requester_id: requesterId,
      addressee_id: addresseeId,
    }),
  });

  if (response.status === 404) {
    throw new Error(
      "Invitaciones de amigos no disponibles ahora mismo. Reinicia el backend para habilitarlas."
    );
  }

  return handleResponse(response, "Error al enviar invitación");
}

export async function respondFriendInvitation(invitationId, userId, accept) {
  const response = await fetch(`${API_BASE_URL}/friends/invitations/${invitationId}/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      accept,
    }),
  });

  if (response.status === 404) {
    throw new Error(
      "Responder invitaciones no está disponible ahora mismo. Reinicia el backend para habilitarlo."
    );
  }

  return handleResponse(response, "Error al responder invitación");
}