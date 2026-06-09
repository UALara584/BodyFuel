/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserAvatar } from "../components/UserAvatar";
import {
  clearPlan,
  cloneSharedPlanToMyPlans,
  createMeal,
  createMealItem,
  createPlan,
  deletePlan,
  deleteMealItem,
  fetchFoods,
  fetchFullPlan,
  fetchFullPlansByUser,
  fetchRecipes,
  fetchSharedFullPlan,
  updatePlanName,
} from "../services/api";
import { fetchChatConversations, sendChatMessage } from "../services/chatApi";
import { exportPlanToPDF } from "../utils/pdfExport";

const DAYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const HOURS = Array.from({ length: 16 }, (_, index) => `${String(index + 7).padStart(2, "0")}:00`);

function getCurrentWeekMonday() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  today.setDate(today.getDate() + diff);
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const date = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextAvailableWeek(plans) {
  const usedWeeks = new Set((plans || []).map((plan) => plan.semana_inicio));
  const candidate = new Date(`${getCurrentWeekMonday()}T00:00:00`);

  while (usedWeeks.has(formatDateInput(candidate))) {
    candidate.setDate(candidate.getDate() + 7);
  }

  return formatDateInput(candidate);
}

function formatPlanWeek(weekStart) {
  if (!weekStart) return "Semana sin fecha";
  return new Date(`${weekStart}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

function truncateScrapingRecipeName(name, maxLength = 28) {
  const cleanName = (name || "Receta").trim().replace(/\s+/g, " ");

  if (cleanName.length <= maxLength) {
    return cleanName;
  }

  return `${cleanName.slice(0, maxLength).trim()}...`;
}

function addItemToPlan(currentPlan, day, hour, meal, item) {
  if (!currentPlan) return currentPlan;

  const meals = [...(currentPlan.meals || [])];
  const mealIndex = meals.findIndex(
    (entry) => normalizeDay(entry.dia) === day && entry.hora === hour
  );

  if (mealIndex === -1) {
    meals.push({ ...meal, items: [item] });
  } else {
    meals[mealIndex] = {
      ...meals[mealIndex],
      items: [...(meals[mealIndex].items || []), item],
    };
  }

  return { ...currentPlan, meals };
}

function confirmPlanItem(currentPlan, pendingMealId, pendingItemId, savedMeal, savedItem) {
  if (!currentPlan) return currentPlan;

  return {
    ...currentPlan,
    meals: (currentPlan.meals || []).map((meal) =>
      meal.id === pendingMealId
        ? {
            ...meal,
            id: savedMeal.id,
            items: (meal.items || []).map((item) =>
              item.id === pendingItemId ? savedItem : item
            ),
          }
        : meal
    ),
  };
}

function removeItemFromPlan(currentPlan, itemId, removePendingMeal = false) {
  if (!currentPlan) return currentPlan;

  return {
    ...currentPlan,
    meals: (currentPlan.meals || []).flatMap((meal) => {
      const items = (meal.items || []).filter((item) => item.id !== itemId);
      if (removePendingMeal && items.length === 0 && String(meal.id).startsWith("pending-meal-")) {
        return [];
      }
      return [{ ...meal, items }];
    }),
  };
}

export default function PlanPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [savedPlans, setSavedPlans] = useState([]);
  const [foods, setFoods] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeDropDay, setActiveDropDay] = useState("");
  const [activeDropHour, setActiveDropHour] = useState("");

  const [showFoods, setShowFoods] = useState(true);
  const [showRecipes, setShowRecipes] = useState(false);
  const [showManualRecipes, setShowManualRecipes] = useState(false);
  const [showScrapingRecipes, setShowScrapingRecipes] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState("");
  const [shareConversations, setShareConversations] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState("");
  const [sharingConversationId, setSharingConversationId] = useState(null);
  const [showSharePlan, setShowSharePlan] = useState(false);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanWeek, setNewPlanWeek] = useState("");
  const [planNameDraft, setPlanNameDraft] = useState("");
  const [planActionLoading, setPlanActionLoading] = useState("");
  const [planActionError, setPlanActionError] = useState("");
  const [planActionSuccess, setPlanActionSuccess] = useState("");
  const [planPendingDelete, setPlanPendingDelete] = useState(null);
  const [showClearPlan, setShowClearPlan] = useState(false);
  const pendingItemCounterRef = useRef(0);

  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userId = currentUser?.id;
  const searchParams = new URLSearchParams(location.search);
  const weekFromQuery = searchParams.get("week");
  const sharedPlanParam = searchParams.get("sharedPlan");
  const sharedPlanId = sharedPlanParam && /^\d+$/.test(sharedPlanParam)
    ? Number(sharedPlanParam)
    : null;
  const weekStart = weekFromQuery || getCurrentWeekMonday();
  const isReadOnlySharedPlan = Boolean(sharedPlanId && plan?.user_id !== userId);

  function updateCurrentPlan(updater) {
    const currentPlanId = plan?.id;
    if (!currentPlanId) return;

    setPlan((current) => (current?.id === currentPlanId ? updater(current) : current));
    setSavedPlans((current) =>
      current.map((savedPlan) =>
        savedPlan.id === currentPlanId ? updater(savedPlan) : savedPlan
      )
    );
  }

  async function loadPlanAndLibrary() {
    setLoading(true);
    setError("");
    setFoods([]);
    setRecipes([]);
    setSavedPlans([]);

    try {
      let fullPlan;
      if (sharedPlanId) {
        fullPlan = await fetchSharedFullPlan(sharedPlanId, userId);

        if (fullPlan.user_id === userId) {
          const [foodsData, recipesData, plansData] = await Promise.all([
            fetchFoods("", userId),
            fetchRecipes("", "", userId),
            fetchFullPlansByUser(userId),
          ]);
          setFoods(foodsData);
          setRecipes(recipesData);
          setSavedPlans(plansData || []);
        }
      } else {
        const [foodsData, recipesData, plansData] = await Promise.all([
          fetchFoods("", userId),
          fetchRecipes("", "", userId),
          fetchFullPlansByUser(userId),
        ]);
        setFoods(foodsData);
        setRecipes(recipesData);
        setSavedPlans(plansData || []);

        try {
          fullPlan = await fetchFullPlan(userId, weekStart);
        } catch (planError) {
          if (!planError.message.includes("Plan no encontrado")) {
            throw planError;
          }

          if (!weekFromQuery && plansData.length > 0) {
            const latestPlan = plansData[plansData.length - 1];
            navigate(`/plan?week=${latestPlan.semana_inicio}`, { replace: true });
            return;
          }

          fullPlan = null;
        }
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
  }, [userId, weekStart, sharedPlanId]);

  useEffect(() => {
    setPlanNameDraft(plan?.nombre || "");
  }, [plan?.id, plan?.nombre]);

  const manualRecipes = useMemo(
    () => recipes.filter((recipe) => (recipe.origen || "").toLowerCase() === "manual"),
    [recipes]
  );

  const scrapingRecipes = useMemo(
    () => recipes.filter((recipe) => (recipe.origen || "").toLowerCase() !== "manual"),
    [recipes]
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
    if (!raw || !plan || isReadOnlySharedPlan) return;

    let dragged;
    try {
      dragged = JSON.parse(raw);
    } catch {
      return;
    }

    let pendingItemId = "";
    let existingMeal = null;

    try {
      const mealType = guessMealType(hour);
      existingMeal = (mealsByDay[day] || []).find(
        (meal) => meal.hora === hour && normalizeDay(meal.dia) === day
      );
      pendingItemCounterRef.current += 1;
      const pendingToken = `${plan.id}-${pendingItemCounterRef.current}`;
      const pendingMealId = existingMeal?.id || `pending-meal-${pendingToken}`;
      pendingItemId = `pending-item-${pendingToken}`;
      const selectedFood =
        dragged.kind === "food"
          ? foods.find((food) => food.id === dragged.id) || {
              id: dragged.id,
              nombre: dragged.nombre,
            }
          : null;
      const selectedRecipe =
        dragged.kind === "recipe"
          ? recipes.find((recipe) => recipe.id === dragged.id) || {
              id: dragged.id,
              nombre: dragged.nombre,
            }
          : null;
      const pendingMeal = existingMeal || {
        id: pendingMealId,
        weekly_plan_id: plan.id,
        dia: day,
        tipo_comida: mealType,
        hora: hour,
      };
      const pendingItem = {
        id: pendingItemId,
        meal_id: pendingMealId,
        food_id: selectedFood?.id || null,
        recipe_id: selectedRecipe?.id || null,
        cantidad: 1,
        notas:
          dragged.kind === "food"
            ? "Añadido desde calendario"
            : "Receta añadida desde calendario",
        food: selectedFood,
        recipe: selectedRecipe,
        pending: true,
      };

      updateCurrentPlan((current) =>
        addItemToPlan(current, day, hour, pendingMeal, pendingItem)
      );

      const meal = existingMeal
        ? existingMeal
        : await createMeal({
            weekly_plan_id: plan.id,
            dia: day,
            tipo_comida: mealType,
            hora: hour,
          });

      const createdItem = await createMealItem({
        meal_id: meal.id,
        food_id: selectedFood?.id || null,
        recipe_id: selectedRecipe?.id || null,
        cantidad: 1,
        notas: pendingItem.notas,
      });

      updateCurrentPlan((current) =>
        confirmPlanItem(current, pendingMealId, pendingItemId, meal, {
          ...createdItem,
          food: selectedFood,
          recipe: selectedRecipe,
          pending: false,
        })
      );
    } catch (err) {
      if (pendingItemId) {
        updateCurrentPlan((current) =>
          removeItemFromPlan(current, pendingItemId, !existingMeal)
        );
      }
      setError(err.message);
    }
  }

  function handleDragStart(item, event) {
    event.dataTransfer.setData("application/json", JSON.stringify(item));
    event.dataTransfer.effectAllowed = "copy";
  }

  async function handleDeleteItem(itemId) {
    if (isReadOnlySharedPlan) return;

    const sourceMeal = (plan?.meals || []).find((meal) =>
      (meal.items || []).some((item) => item.id === itemId)
    );
    const sourceItem = sourceMeal?.items?.find((item) => item.id === itemId);
    if (!sourceMeal || !sourceItem || sourceItem.pending) return;

    try {
      setError("");
      updateCurrentPlan((current) => removeItemFromPlan(current, itemId));
      await deleteMealItem(itemId);
    } catch (err) {
      updateCurrentPlan((current) =>
        addItemToPlan(
          current,
          normalizeDay(sourceMeal.dia),
          sourceMeal.hora,
          sourceMeal,
          sourceItem
        )
      );
      setError(err.message);
    }
  }

  async function handleExportPDF() {
    try {
      setExportLoading(true);
      setExportError("");
      if (!plan) {
        throw new Error("No hay plan disponible para exportar");
      }
      await exportPlanToPDF(plan, currentUser?.nombre || "Usuario", weekStart);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExportLoading(false);
    }
  }

  async function openSharePlanModal() {
    setShowSharePlan(true);
    setShareError("");
    setShareSuccess("");
    setShareConversations([]);

    try {
      setShareLoading(true);
      const conversations = await fetchChatConversations(userId);
      setShareConversations(conversations || []);
    } catch (err) {
      setShareError(err.message || "No se pudieron cargar tus chats.");
    } finally {
      setShareLoading(false);
    }
  }

  function closeSharePlanModal() {
    setShowSharePlan(false);
    setShareError("");
    setSharingConversationId(null);
  }

  async function handleSharePlan(conversation) {
    if (!plan) return;

    try {
      setShareError("");
      setShareSuccess("");
      setSharingConversationId(conversation.id);
      await sendChatMessage(conversation.id, {
        user_id: userId,
        message_type: "weekly_plan_share",
        weekly_plan_id: plan.id,
      });
      setShareSuccess(`Plan semanal compartido con ${conversation.other_user.nombre}.`);
      closeSharePlanModal();
    } catch (err) {
      setShareError(err.message || "No se pudo compartir el plan semanal.");
    } finally {
      setSharingConversationId(null);
    }
  }

  function openCreatePlanModal() {
    setNewPlanName("");
    setNewPlanWeek(getNextAvailableWeek(savedPlans));
    setPlanActionError("");
    setShowCreatePlan(true);
  }

  async function handleCreatePlan(event) {
    event.preventDefault();
    const nombre = newPlanName.trim();

    if (!nombre || !newPlanWeek) return;

    try {
      setPlanActionLoading("create");
      setPlanActionError("");
      setPlanActionSuccess("");
      await createPlan({
        user_id: userId,
        nombre,
        semana_inicio: newPlanWeek,
      });
      setShowCreatePlan(false);
      setPlanActionSuccess(`"${nombre}" se ha creado correctamente.`);
      if (newPlanWeek === weekStart) {
        await loadPlanAndLibrary();
      } else {
        navigate(`/plan?week=${newPlanWeek}`);
      }
    } catch (err) {
      setPlanActionError(err.message || "No se pudo crear el plan.");
    } finally {
      setPlanActionLoading("");
    }
  }

  async function handleSaveSharedPlan() {
    if (!plan || !sharedPlanId || !isReadOnlySharedPlan) return;

    try {
      setPlanActionLoading("clone");
      setPlanActionError("");
      setPlanActionSuccess("");
      const savedPlan = await cloneSharedPlanToMyPlans(sharedPlanId, userId);
      setPlanActionSuccess(
        `Plan guardado en la semana del ${formatPlanWeek(savedPlan.semana_inicio)}.`
      );
      navigate(`/plan?week=${savedPlan.semana_inicio}`, { replace: true });
    } catch (err) {
      setPlanActionError(err.message || "No se pudo guardar el plan compartido.");
    } finally {
      setPlanActionLoading("");
    }
  }

  async function handleRenamePlan(event) {
    event.preventDefault();
    const nombre = planNameDraft.trim();

    if (!plan || !nombre || isReadOnlySharedPlan) return;

    try {
      setPlanActionLoading("rename");
      setPlanActionError("");
      setPlanActionSuccess("");
      const updatedPlan = await updatePlanName(plan.id, userId, nombre);
      setPlan((current) => ({ ...current, nombre: updatedPlan.nombre }));
      setSavedPlans((current) =>
        current.map((savedPlan) =>
          savedPlan.id === plan.id ? { ...savedPlan, nombre: updatedPlan.nombre } : savedPlan
        )
      );
      setPlanActionSuccess("Nombre del plan actualizado.");
    } catch (err) {
      setPlanActionError(err.message || "No se pudo cambiar el nombre.");
    } finally {
      setPlanActionLoading("");
    }
  }

  async function handleClearPlan() {
    if (!plan || isReadOnlySharedPlan) return;

    try {
      setPlanActionLoading("clear");
      setPlanActionError("");
      setPlanActionSuccess("");
      await clearPlan(plan.id, userId);
      setShowClearPlan(false);
      setPlanActionSuccess("El plan está vacío y listo para empezar de nuevo.");
      await loadPlanAndLibrary();
    } catch (err) {
      setPlanActionError(err.message || "No se pudo vaciar el plan.");
    } finally {
      setPlanActionLoading("");
    }
  }

  async function handleDeletePlan() {
    if (!planPendingDelete) return;

    try {
      setPlanActionLoading("delete");
      setPlanActionError("");
      setPlanActionSuccess("");
      await deletePlan(planPendingDelete.id, userId);

      const remainingPlans = savedPlans.filter(
        (savedPlan) => savedPlan.id !== planPendingDelete.id
      );
      const deletedCurrentPlan = plan?.id === planPendingDelete.id;
      setPlanPendingDelete(null);
      setSavedPlans(remainingPlans);
      setPlanActionSuccess("Plan eliminado.");

      if (deletedCurrentPlan) {
        if (remainingPlans.length > 0) {
          const nextPlan = remainingPlans[remainingPlans.length - 1];
          navigate(`/plan?week=${nextPlan.semana_inicio}`, { replace: true });
        } else {
          setPlan(null);
          navigate("/plan", { replace: true });
        }
      }
    } catch (err) {
      setPlanActionError(err.message || "No se pudo eliminar el plan.");
    } finally {
      setPlanActionLoading("");
    }
  }

  if (loading) {
    return <p>Cargando plan semanal...</p>;
  }

  return (
    <div className="page plan-page">
      <div className="page-header plan-workspace-header">
        <div className="plan-title-group">
          <h2>
            {isReadOnlySharedPlan
              ? plan?.nombre || "Plan semanal compartido"
              : plan?.nombre || "Planes semanales"}
          </h2>
          {plan ? <span className="plan-active-badge">Plan activo</span> : null}
          <p className="plan-header-description">
            {isReadOnlySharedPlan
              ? "Puedes consultar este plan, pero solo su propietario puede modificarlo."
              : "Guarda, organiza y reutiliza tus planes semanales desde un mismo lugar."}
          </p>
        </div>
        <div className="plan-header-actions">
          {isReadOnlySharedPlan && plan ? (
            <button
              type="button"
              className="plan-action-button plan-action-button-primary"
              onClick={handleSaveSharedPlan}
              disabled={planActionLoading === "clone"}
            >
              {planActionLoading === "clone" ? "Guardando..." : "Guardar plan"}
            </button>
          ) : null}
          {!isReadOnlySharedPlan && plan ? (
            <button
              type="button"
              className="plan-action-button secondary-action-button"
              onClick={openSharePlanModal}
              disabled={!plan}
            >
              Compartir plan
            </button>
          ) : null}
          {!isReadOnlySharedPlan && plan ? (
            <button
              type="button"
              className="plan-action-button delete-button"
              onClick={() => {
                setPlanActionError("");
                setShowClearPlan(true);
              }}
            >
              Vaciar
            </button>
          ) : null}
          {plan ? (
            <button
              type="button"
              className="plan-action-button profile-edit-button"
              onClick={handleExportPDF}
              disabled={exportLoading}
            >
              {exportLoading ? "Generando..." : "Exportar PDF"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {exportError ? <p className="error-text">{exportError}</p> : null}
      {shareSuccess ? <p className="success-text">{shareSuccess}</p> : null}
      {planActionError ? <p className="error-text">{planActionError}</p> : null}
      {planActionSuccess ? <p className="success-text">{planActionSuccess}</p> : null}

      {!isReadOnlySharedPlan ? (
        <section className="card saved-plans-panel">
          <div className="saved-plans-header">
            <div>
              <h3>Mis planes guardados</h3>
              <p>Abre un plan, cambia su nombre o crea uno para otra semana.</p>
            </div>
            <button
              type="button"
              className="secondary-action-button saved-plan-create-button"
              onClick={openCreatePlanModal}
            >
              <span aria-hidden="true">+</span>
              Crear plan
            </button>
          </div>

          {savedPlans.length === 0 ? (
            <p className="item-note">Todavía no tienes planes guardados.</p>
          ) : (
            <div className="saved-plans-list">
              {savedPlans.map((savedPlan) => (
                <div
                  key={savedPlan.id}
                  className={`saved-plan-item ${plan?.id === savedPlan.id ? "active" : ""}`}
                >
                  <span className="saved-plan-status" aria-hidden="true">
                    {plan?.id === savedPlan.id ? "✓" : "↶"}
                  </span>
                  <button
                    type="button"
                    className="saved-plan-open"
                    onClick={() => navigate(`/plan?week=${savedPlan.semana_inicio}`)}
                  >
                    <strong>{savedPlan.nombre || "Plan semanal"}</strong>
                    <span className="saved-plan-meta">
                      <span>{formatPlanWeek(savedPlan.semana_inicio)}</span>
                      <small>{savedPlan.meals?.length || 0} comidas</small>
                    </span>
                  </button>
                  {plan?.id !== savedPlan.id ? (
                    <button
                      type="button"
                      className="saved-plan-load"
                      onClick={() => navigate(`/plan?week=${savedPlan.semana_inicio}`)}
                    >
                      Cargar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="saved-plan-delete"
                    aria-label={`Eliminar ${savedPlan.nombre || "plan semanal"}`}
                    onClick={() => {
                      setPlanActionError("");
                      setPlanPendingDelete(savedPlan);
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}

          {plan ? (
            <form className="plan-name-form" onSubmit={handleRenamePlan}>
              <label htmlFor="plan-name">Nombre del plan actual</label>
              <div>
                <input
                  id="plan-name"
                  type="text"
                  maxLength={120}
                  value={planNameDraft}
                  onChange={(event) => setPlanNameDraft(event.target.value)}
                />
                <button
                  type="submit"
                  className="secondary-action-button"
                  disabled={
                    !planNameDraft.trim() ||
                    planNameDraft.trim() === (plan.nombre || "").trim() ||
                    planActionLoading === "rename"
                  }
                >
                  {planActionLoading === "rename" ? "Guardando..." : "Guardar nombre"}
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      {plan ? (
        <>
          <section className={`plan-board ${isReadOnlySharedPlan ? "plan-board-read-only" : ""}`}>
        {!isReadOnlySharedPlan ? (
          <aside className="card plan-library">
          <h3>Comidas disponibles</h3>
          <p>Organiza por categorías y arrastra al horario deseado.</p>

          <div className="plan-library-sections">
            <div className="plan-library-section">
              <button
                type="button"
                className="plan-section-toggle"
                onClick={() => setShowFoods((prev) => !prev)}
              >
                <span>Alimentos</span>
                <span>{showFoods ? "−" : "+"}</span>
              </button>

              {showFoods && (
                <div className="plan-draggable-list">
                  {foods.length === 0 ? (
                    <p className="item-note">No hay alimentos disponibles.</p>
                  ) : (
                    foods.map((food) => (
                      <button
                        key={`food-${food.id}`}
                        type="button"
                        draggable
                        className="plan-draggable-item"
                        onDragStart={(event) =>
                          handleDragStart(
                            { kind: "food", id: food.id, nombre: food.nombre },
                            event
                          )
                        }
                      >
                        <strong>{food.nombre}</strong>
                        <span>Alimento</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="plan-library-section">
              <button
                type="button"
                className="plan-section-toggle"
                onClick={() => setShowRecipes((prev) => !prev)}
              >
                <span>Recetas</span>
                <span>{showRecipes ? "−" : "+"}</span>
              </button>

              {showRecipes && (
                <div className="plan-subsections">
                  <div className="plan-library-subsection">
                    <button
                      type="button"
                      className="plan-subsection-toggle"
                      onClick={() => setShowManualRecipes((prev) => !prev)}
                    >
                      <span>Mis recetas</span>
                      <span>{showManualRecipes ? "−" : "+"}</span>
                    </button>

                    {showManualRecipes && (
                      <div className="plan-draggable-list">
                        {manualRecipes.length === 0 ? (
                          <p className="item-note">No tienes recetas manuales todavía.</p>
                        ) : (
                          manualRecipes.map((recipe) => (
                            <button
                              key={`manual-recipe-${recipe.id}`}
                              type="button"
                              draggable
                              className="plan-draggable-item"
                              onDragStart={(event) =>
                                handleDragStart(
                                  { kind: "recipe", id: recipe.id, nombre: recipe.nombre },
                                  event
                                )
                              }
                            >
                              <strong>{recipe.nombre}</strong>
                              <span>Mi receta</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="plan-library-subsection">
                    <button
                      type="button"
                      className="plan-subsection-toggle"
                      onClick={() => setShowScrapingRecipes((prev) => !prev)}
                    >
                      <span>Recetas scraping</span>
                      <span>{showScrapingRecipes ? "−" : "+"}</span>
                    </button>

                    {showScrapingRecipes && (
                      <div className="plan-draggable-list">
                        {scrapingRecipes.length === 0 ? (
                          <p className="item-note">No hay recetas scrapeadas disponibles.</p>
                        ) : (
                          scrapingRecipes.map((recipe) => (
                            <button
                              key={`scraping-recipe-${recipe.id}`}
                              type="button"
                              draggable
                              className="plan-draggable-item plan-draggable-item-compact"
                              title={recipe.nombre}
                              onDragStart={(event) =>
                                handleDragStart(
                                  { kind: "recipe", id: recipe.id, nombre: recipe.nombre },
                                  event
                                )
                              }
                            >
                              <strong>{truncateScrapingRecipeName(recipe.nombre)}</strong>
                              <span>Receta scraping</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          </aside>
        ) : null}

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
                      onDragOver={
                        isReadOnlySharedPlan
                          ? undefined
                          : (event) => {
                              event.preventDefault();
                              setActiveDropDay(day);
                              setActiveDropHour(hour);
                            }
                      }
                      onDragLeave={
                        isReadOnlySharedPlan
                          ? undefined
                          : () => {
                              setActiveDropDay("");
                              setActiveDropHour("");
                            }
                      }
                      onDrop={
                        isReadOnlySharedPlan
                          ? undefined
                          : (event) => handleDrop(day, hour, event)
                      }
                    >
                      {meal?.items?.map((item) => (
                        <div
                          key={item.id}
                          className={`week-pill ${item.pending ? "week-pill-pending" : ""}`}
                        >
                          <span>{item.food?.nombre || item.recipe?.nombre}</span>
                          {!isReadOnlySharedPlan && !item.pending ? (
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
                          ) : null}
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

        </>
      ) : !sharedPlanId ? (
        <section className="card plan-empty-state">
          <h3>Empieza tu primer plan semanal</h3>
          <p>Asigna un nombre y una semana para empezar a organizar tus comidas.</p>
          <button
            type="button"
            className="plan-action-button plan-action-button-primary"
            onClick={openCreatePlanModal}
          >
            Crear un plan
          </button>
        </section>
      ) : null}

      {showCreatePlan && (
        <div className="modal-overlay" onClick={() => setShowCreatePlan(false)}>
          <form
            className="modal-card plan-create-modal"
            onSubmit={handleCreatePlan}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Crear plan semanal</h3>
              <button
                className="close-button"
                type="button"
                onClick={() => setShowCreatePlan(false)}
                aria-label="Cerrar creación de plan"
              >
                x
              </button>
            </div>

            <label htmlFor="new-plan-name">Nombre del plan</label>
            <input
              id="new-plan-name"
              type="text"
              maxLength={120}
              value={newPlanName}
              onChange={(event) => setNewPlanName(event.target.value)}
              placeholder="Ej. Semana de fuerza"
              autoFocus
            />

            <label htmlFor="new-plan-week">Semana de inicio</label>
            <input
              id="new-plan-week"
              type="date"
              value={newPlanWeek}
              onChange={(event) => setNewPlanWeek(event.target.value)}
            />

            {planActionError ? <p className="error-text">{planActionError}</p> : null}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => setShowCreatePlan(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="submit-button"
                disabled={
                  !newPlanName.trim() ||
                  !newPlanWeek ||
                  planActionLoading === "create"
                }
              >
                {planActionLoading === "create" ? "Creando..." : "Crear plan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {planPendingDelete && (
        <div className="modal-overlay" onClick={() => setPlanPendingDelete(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Eliminar plan</h3>
              <button
                className="close-button"
                type="button"
                onClick={() => setPlanPendingDelete(null)}
                aria-label="Cerrar confirmación"
              >
                x
              </button>
            </div>
            <p>
              Se eliminará <strong>{planPendingDelete.nombre}</strong> y todo su contenido.
              Esta acción no se puede deshacer.
            </p>
            {planActionError ? <p className="error-text">{planActionError}</p> : null}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => setPlanPendingDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="delete-button"
                onClick={handleDeletePlan}
                disabled={planActionLoading === "delete"}
              >
                {planActionLoading === "delete" ? "Eliminando..." : "Eliminar plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearPlan && plan && (
        <div className="modal-overlay" onClick={() => setShowClearPlan(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Vaciar plan semanal</h3>
              <button
                className="close-button"
                type="button"
                onClick={() => setShowClearPlan(false)}
                aria-label="Cerrar confirmación"
              >
                x
              </button>
            </div>
            <p>
              Se quitarán todas las comidas de <strong>{plan.nombre}</strong>. El plan y su
              nombre seguirán guardados para que puedas empezar de nuevo.
            </p>
            {planActionError ? <p className="error-text">{planActionError}</p> : null}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => setShowClearPlan(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="delete-button"
                onClick={handleClearPlan}
                disabled={planActionLoading === "clear"}
              >
                {planActionLoading === "clear" ? "Vaciando..." : "Vaciar plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSharePlan && (
        <div className="modal-overlay" onClick={closeSharePlanModal}>
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Compartir plan semanal</h3>
              <button
                className="close-button"
                type="button"
                onClick={closeSharePlanModal}
                aria-label="Cerrar selector de chats"
              >
                x
              </button>
            </div>

            {shareLoading ? <p>Cargando chats...</p> : null}
            {shareError ? <p className="error-text">{shareError}</p> : null}

            <div className="chat-picker-list">
              {!shareLoading && shareConversations.length === 0 ? (
                <p className="item-note">No tienes conversaciones. Crea una desde Chats.</p>
              ) : null}

              {shareConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className="chat-picker-item"
                  onClick={() => handleSharePlan(conversation)}
                  disabled={sharingConversationId === conversation.id}
                >
                  <UserAvatar
                    avatar={conversation.other_user.avatar}
                    name={conversation.other_user.nombre}
                    className="chat-avatar"
                  />
                  <span>
                    <strong>{conversation.other_user.nombre}</strong>
                    <small>
                      {sharingConversationId === conversation.id
                        ? "Compartiendo..."
                        : `Semana ${weekStart}`}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
