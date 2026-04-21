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