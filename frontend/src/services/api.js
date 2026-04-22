const API_BASE_URL = "http://localhost:8000";

async function handleResponse(response, errorMessage) {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${errorMessage}: ${errorText}`);
  }
  return response.json();
}

export async function fetchFoods(nombre = "") {
  const url = nombre
    ? `${API_BASE_URL}/foods/?nombre=${encodeURIComponent(nombre)}`
    : `${API_BASE_URL}/foods/`;

  const response = await fetch(url);
  return handleResponse(response, "Error al obtener alimentos");
}

export async function fetchRecipes(nombre = "", tipoDieta = "") {
  const params = new URLSearchParams();

  if (nombre) params.append("nombre", nombre);
  if (tipoDieta) params.append("tipo_dieta", tipoDieta);

  const query = params.toString();
  const url = query
    ? `${API_BASE_URL}/recipes/?${query}`
    : `${API_BASE_URL}/recipes/`;

  const response = await fetch(url);
  return handleResponse(response, "Error al obtener recetas");
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