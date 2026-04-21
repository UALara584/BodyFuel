import { useEffect, useMemo, useState } from "react";
import {
  createMeal,
  createMealItem,
  createPlan,
  deleteMealItem,
  fetchFoods,
  fetchFullPlan,
  fetchRecipes,
} from "../services/api";

const DAYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const HOURS = Array.from({ length: 16 }, (_, index) => `${String(index + 7).padStart(2, "0")}:00`);

function getCurrentWeekMonday() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  today.setDate(today.getDate() + diff);
  return today.toISOString().slice(0, 10);
}

function guessMealType(hourValue) {
  const hour = Number(hourValue.split(":")[0] || 0);
  if (hour < 11) return "desayuno";
  if (hour < 14) return "almuerzo";
  if (hour < 17) return "comida";
  if (hour < 20) return "merienda";
  return "cena";
}

function normalizeDay(dayValue) {
  return (dayValue || "").toLowerCase();
}

export default function PlanPage() {
  const [plan, setPlan] = useState(null);
  const [foods, setFoods] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dropping, setDropping] = useState(false);
  const [error, setError] = useState("");
  const [activeDropDay, setActiveDropDay] = useState("");
  const [activeDropHour, setActiveDropHour] = useState("");

  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userId = currentUser?.id;
  const weekStart = getCurrentWeekMonday();

  async function loadPlanAndLibrary() {
    setLoading(true);
    setError("");

    try {
      const [foodsData, recipesData] = await Promise.all([fetchFoods(), fetchRecipes()]);
      setFoods(foodsData);
      setRecipes(recipesData);

      let fullPlan;
      try {
        fullPlan = await fetchFullPlan(userId, weekStart);
      } catch (planError) {
        if (!planError.message.includes("Plan no encontrado")) {
          throw planError;
        }

        await createPlan({
          user_id: userId,
          semana_inicio: weekStart,
        });

        fullPlan = await fetchFullPlan(userId, weekStart);
      }

      setPlan(fullPlan);
    } catch (err) {
      setError(err.message);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError("No hay usuario activo.");
      return;
    }

    loadPlanAndLibrary();
  }, [userId]);

  const draggableLibrary = useMemo(
    () => [
      ...foods.map((food) => ({ kind: "food", id: food.id, nombre: food.nombre })),
      ...recipes.map((recipe) => ({ kind: "recipe", id: recipe.id, nombre: recipe.nombre })),
    ],
    [foods, recipes]
  );

  const mealsByDay = useMemo(() => {
    const grouped = Object.fromEntries(DAYS.map((day) => [day, []]));
    if (!plan?.meals) return grouped;

    for (const meal of plan.meals) {
      const key = normalizeDay(meal.dia);
      if (!grouped[key]) continue;
      grouped[key].push(meal);
    }

    for (const day of DAYS) {
      grouped[day].sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
    }

    return grouped;
  }, [plan]);

  async function handleDrop(day, hour, event) {
    event.preventDefault();
    setActiveDropDay("");
    setActiveDropHour("");
    setError("");

    const raw = event.dataTransfer.getData("application/json");
    if (!raw || !plan) return;

    let dragged;
    try {
      dragged = JSON.parse(raw);
    } catch {
      return;
    }

    try {
      setDropping(true);

      const mealType = guessMealType(hour);
      const existingMeal = (mealsByDay[day] || []).find(
        (meal) => meal.hora === hour && normalizeDay(meal.dia) === day
      );

      const meal = existingMeal
        ? existingMeal
        : await createMeal({
            weekly_plan_id: plan.id,
            dia: day,
            tipo_comida: mealType,
            hora: hour,
          });

      await createMealItem({
        meal_id: meal.id,
        food_id: dragged.kind === "food" ? dragged.id : null,
        recipe_id: dragged.kind === "recipe" ? dragged.id : null,
        cantidad: 1,
        notas: dragged.kind === "food" ? "Añadido desde calendario" : "Receta añadida desde calendario",
      });

      await loadPlanAndLibrary();
    } catch (err) {
      setError(err.message);
    } finally {
      setDropping(false);
    }
  }

  function handleDragStart(item, event) {
    event.dataTransfer.setData("application/json", JSON.stringify(item));
    event.dataTransfer.effectAllowed = "copy";
  }

  async function handleDeleteItem(itemId) {
    try {
      setError("");
      await deleteMealItem(itemId);
      await loadPlanAndLibrary();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <p>Cargando plan semanal...</p>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Plan semanal</h2>
        <p>Arrastra alimentos o recetas al día y hora exacta que quieras.</p>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="plan-board">
        <aside className="card plan-library">
          <h3>Comidas disponibles</h3>
          <p>Arrastra un elemento al día y hora deseados.</p>

          <div className="plan-draggable-list">
            {draggableLibrary.length === 0 ? (
              <p className="item-note">No hay alimentos ni recetas todavía.</p>
            ) : (
              draggableLibrary.map((item) => (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  draggable
                  className="plan-draggable-item"
                  onDragStart={(event) => handleDragStart(item, event)}
                >
                  <strong>{item.nombre}</strong>
                  <span>{item.kind === "food" ? "Alimento" : "Receta"}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="card plan-calendar-week">
          <header className="week-header">
            <div className="week-header-spacer" />
            {DAYS.map((day) => (
              <div key={day} className="week-day-title">
                {day.slice(0, 1).toUpperCase()}
                <span>{day.slice(1, 3)}</span>
              </div>
            ))}
          </header>

          <div className="week-grid">
            {HOURS.map((hour) => (
              <div key={hour} className="week-row">
                <div className="week-hour">{hour}</div>
                {DAYS.map((day) => {
                  const meal = (mealsByDay[day] || []).find((entry) => entry.hora === hour);
                  const isActive = activeDropDay === day && activeDropHour === hour;

                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={`week-cell ${isActive ? "drag-active" : ""}`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setActiveDropDay(day);
                        setActiveDropHour(hour);
                      }}
                      onDragLeave={() => {
                        setActiveDropDay("");
                        setActiveDropHour("");
                      }}
                      onDrop={(event) => handleDrop(day, hour, event)}
                    >
                      {meal?.items?.map((item) => (
                        <div key={item.id} className="week-pill">
                          <span>{item.food?.nombre || item.recipe?.nombre}</span>
                          <button
                            type="button"
                            className="week-pill-delete"
                            aria-label="Eliminar comida del calendario"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteItem(item.id);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </section>

      {dropping ? <p>Guardando en el plan...</p> : null}
    </div>
  );
}