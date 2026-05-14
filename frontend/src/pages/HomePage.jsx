import { useEffect, useMemo, useState, useCallback } from "react";
import {
  createTracking,
  fetchFullPlan,
  fetchTrackingByUser,
  updateTracking,
} from "../services/api";

function toISODate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return toISODate(date);
}

function isFutureDate(isoDate, todayIso) {
  return isoDate > todayIso;
}

function getCurrentWeekMonday() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  today.setDate(today.getDate() + diff);
  return toISODate(today);
}

function formatShortDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function formatCalendarDay(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function StreakIcon() {
  return (
    <svg className="streak-icon" viewBox="0 0 24 24" aria-hidden="true">
      <g className="streak-icon-glow" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.8 2.8c3.5 2.8 5.4 5.9 5.4 9.1 0 4.5-3.4 8.1-7.7 8.1-4 0-7.1-3.1-7.1-7.2 0-2.9 1.5-5.4 4.4-7.5-.1 2.3.5 4.1 2 5.2.7-3.3 1.7-5.8 3-7.7Z" />
      </g>
      <g fill="currentColor">
        <path className="streak-icon-outer" d="M12.8 2.8c3.5 2.8 5.4 5.9 5.4 9.1 0 4.5-3.4 8.1-7.7 8.1-4 0-7.1-3.1-7.1-7.2 0-2.9 1.5-5.4 4.4-7.5-.1 2.3.5 4.1 2 5.2.7-3.3 1.7-5.8 3-7.7Z" />
        <path className="streak-icon-inner" d="M10.2 18.1c-1-1.2-1.1-2.6-.3-4 .5-1 1.4-1.9 2.7-2.8.2 1.8.8 3.1 1.9 3.8.6.5.9 1.1.9 1.9 0 1.8-1.3 3.1-2.9 3.1-.9 0-1.7-.3-2.3-1Z" />
        <path className="streak-icon-spark" d="M16.8 5.4c1.1.8 1.8 1.8 2 3.1.8-1.2.8-2.4.1-3.7-.5-.8-1.1-1.4-1.9-1.9.1 1.1 0 1.9-.2 2.5Z" />
      </g>
    </svg>
  );
}

const DAY_NAMES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

export default function HomePage() {
  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userName = currentUser?.nombre || "Usuario";
  const initial = userName.charAt(0).toUpperCase() || "U";
  const userId = currentUser?.id;
  const targetCalories = Number(currentUser?.calorias_objetivo || 0);
  const weekStart = getCurrentWeekMonday();

  const complianceStorageKey = useMemo(() => (userId ? `bf_compliance_${userId}` : ""), [userId]);

  const [trackingEntries, setTrackingEntries] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [complianceByDate, setComplianceByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showWeightCalendar, setShowWeightCalendar] = useState(false);
  const [weightDate, setWeightDate] = useState(() => toISODate(new Date()));
  const [weightValue, setWeightValue] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightError, setWeightError] = useState("");
  const [weightSuccess, setWeightSuccess] = useState("");

  // Load compliance data from localStorage on mount
  useEffect(() => {
    if (!complianceStorageKey) {
      setComplianceByDate({});
      return;
    }
    try {
      const raw = localStorage.getItem(complianceStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object") {
        setComplianceByDate(parsed);
      }
    } catch (err) {
      console.error("Error loading compliance data:", err);
      setComplianceByDate({});
    }
  }, [complianceStorageKey]);

  // Save compliance data to localStorage whenever it changes
  useEffect(() => {
    if (!complianceStorageKey) return;
    try {
      localStorage.setItem(complianceStorageKey, JSON.stringify(complianceByDate));
    } catch (err) {
      console.error("Error saving compliance data:", err);
    }
  }, [complianceStorageKey, complianceByDate]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError("No hay usuario activo.");
      return;
    }

    async function loadStats() {
      setLoading(true);
      setError("");
      try {
        const [trackingData, planData] = await Promise.all([
          fetchTrackingByUser(userId),
          fetchFullPlan(userId, weekStart).catch(() => null),
        ]);
        setTrackingEntries(trackingData);
        setWeeklyPlan(planData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [userId, weekStart]);

  useEffect(() => {
    const entryForDate = trackingEntries.find((entry) => entry.fecha === weightDate);
    setWeightValue(entryForDate?.peso ? String(entryForDate.peso) : "");
    setWeightError("");
    setWeightSuccess("");
  }, [trackingEntries, weightDate]);

  const stats = useMemo(() => {
    const sortedTracking = [...trackingEntries].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const todayIso = toISODate(new Date());
    const todayEntry = sortedTracking.find((entry) => entry.fecha === todayIso);

    const weightByDate = Object.fromEntries(
      sortedTracking
        .filter((entry) => Boolean(entry.peso))
        .map((entry) => [entry.fecha, entry])
    );
    const last7WeightDays = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(todayIso, index - 6);
      return {
        date,
        entry: weightByDate[date] || null,
      };
    });
    const last30WeightDays = Array.from({ length: 30 }, (_, index) => {
      const date = addDays(todayIso, index - 29);
      return {
        date,
        entry: weightByDate[date] || null,
      };
    });

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(`${weekStart}T00:00:00`);
      date.setDate(date.getDate() + i);
      return toISODate(date);
    });

    const defaultMacro = { proteinas: 0, carbos: 0, grasas: 0 };
    const weekDayByDate = Object.fromEntries(weekDays.map((date, index) => [date, DAY_NAMES[index]]));
    const macrosByDate = Object.fromEntries(weekDays.map((date) => [date, { ...defaultMacro }]));
    const caloriesByDate = Object.fromEntries(weekDays.map((date) => [date, 0]));

    for (const meal of weeklyPlan?.meals || []) {
      const dayIndex = DAY_NAMES.indexOf((meal.dia || "").toLowerCase());
      if (dayIndex < 0) continue;
      const dayDate = weekDays[dayIndex];

      for (const item of meal.items || []) {
        const qty = Number(item.cantidad || 1);
        if (item.food) {
          caloriesByDate[dayDate] += Number(item.food.calorias || 0) * qty;
          macrosByDate[dayDate].proteinas += Number(item.food.proteinas || 0) * qty;
          macrosByDate[dayDate].carbos += Number(item.food.carbos || 0) * qty;
          macrosByDate[dayDate].grasas += Number(item.food.grasas || 0) * qty;
        } else if (item.recipe) {
          caloriesByDate[dayDate] += Number(item.recipe.calorias_totales || 0) * qty;
          macrosByDate[dayDate].proteinas += Number(item.recipe.proteinas || 0) * qty;
          macrosByDate[dayDate].carbos += Number(item.recipe.carbos || 0) * qty;
          macrosByDate[dayDate].grasas += Number(item.recipe.grasas || 0) * qty;
        }
      }
    }

    const hasTodayMeals = (weeklyPlan?.meals || []).some(
      (meal) => (meal.dia || "").toLowerCase() === weekDayByDate[todayIso]
    );
    const consumedTodayFromPlan = Number(caloriesByDate[todayIso] || 0);
    const consumedToday = hasTodayMeals ? consumedTodayFromPlan : Number(todayEntry?.calorias_consumidas || 0);
    const consumedTodayRounded = Math.round(consumedToday);
    const consumedPercent = targetCalories ? clampPercent((consumedTodayRounded / targetCalories) * 100) : 0;
    const remainingToday = Math.max(Math.round(targetCalories - consumedToday), 0);

    const completedWeekDays = weekDays.filter((date) => Boolean(complianceByDate[date]));
    const completedDaysCount = completedWeekDays.length;
    const adherence = clampPercent((completedDaysCount / 7) * 100);

    let streak = 0;
    let cursor = todayIso;
    while (complianceByDate[cursor]) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }

    return {
      consumedToday: consumedTodayRounded,
      consumedPercent,
      remainingToday,
      weeklyWeightDays: last7WeightDays,
      monthlyWeightDays: last30WeightDays,
      macrosByDate,
      streak,
      adherence,
      weekDays,
      completedDaysCount,
    };
  }, [trackingEntries, weeklyPlan, targetCalories, weekStart, complianceByDate]);

  const toggleCompliance = useCallback((date, checked) => {
    setComplianceByDate((prev) => {
      const updated = { ...prev, [date]: checked };
      return updated;
    });
  }, []);

  async function handleSaveWeight(event) {
    event.preventDefault();
    setWeightError("");
    setWeightSuccess("");

    if (!userId) {
      setWeightError("No hay usuario activo para guardar el peso.");
      return;
    }

    const today = toISODate(new Date());
    if (weightDate > today) {
      setWeightError("No puedes registrar peso en una fecha futura.");
      return;
    }

    const parsedWeight = Number(weightValue);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setWeightError("Introduce un peso válido.");
      return;
    }

    const existingEntry = trackingEntries.find((entry) => entry.fecha === weightDate);
    const caloriesForDay = Number(existingEntry?.calorias_consumidas || 0);

    try {
      setSavingWeight(true);
      const savedEntry = existingEntry
        ? await updateTracking(existingEntry.id, {
            fecha: weightDate,
            peso: parsedWeight,
            calorias_consumidas: caloriesForDay,
          })
        : await createTracking({
            user_id: userId,
            fecha: weightDate,
            peso: parsedWeight,
            calorias_consumidas: 0,
          });

      setTrackingEntries((prevEntries) => {
        const alreadyExists = prevEntries.some((entry) => entry.id === savedEntry.id);
        if (alreadyExists) {
          return prevEntries.map((entry) => (entry.id === savedEntry.id ? savedEntry : entry));
        }

        return [savedEntry, ...prevEntries];
      });
      setWeightSuccess("Peso guardado correctamente.");
    } catch (err) {
      setWeightError(err.message || "No se pudo guardar el peso.");
    } finally {
      setSavingWeight(false);
    }
  }

  function getFlameLevel(streak) {
    if (streak >= 21) return "flame-5";
    if (streak >= 14) return "flame-4";
    if (streak >= 8) return "flame-3";
    if (streak >= 4) return "flame-2";
    if (streak >= 1) return "flame-1";
    return "flame-0";
  }

  const todayIso = toISODate(new Date());

  return (
    <div className="page home-page">
      <section className="home-top">
        <div>
          <p className="home-greeting">Buenos días</p>
          <h2 className="home-user-name">{userName}</h2>
        </div>
        <div className="home-user-badge" aria-hidden="true">
          {initial}
        </div>
      </section>

      {loading ? <p>Cargando estadisticas...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && !error ? (
        <section className="stats-grid">
          <article className="card stat-card">
            <h3>Calorías de hoy</h3>
            <p className="stat-main">{stats.consumedToday} kcal</p>
            <p className="stat-sub">
              Objetivo: {targetCalories || "-"} kcal · Restantes: {stats.remainingToday} kcal
            </p>
            <div className="home-progress-track">
              <div className="home-progress-fill" style={{ width: `${stats.consumedPercent}%` }} />
            </div>
          </article>

          <article className="card stat-card stat-wide home-weight-card">
            <div className="home-weight-head">
              <div>
                <h3>Evolución de peso (7 días)</h3>
                <p className="stat-sub">Registra tu peso diario y revisa la progresión reciente.</p>
              </div>
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => setShowWeightCalendar(true)}
              >
                Ver calendario 30 días
              </button>
            </div>

            <form className="weight-entry-form" onSubmit={handleSaveWeight}>
              <label className="field-group">
                <span>Fecha</span>
                <input
                  type="date"
                  value={weightDate}
                  max={todayIso}
                  onChange={(event) => setWeightDate(event.target.value)}
                />
              </label>

              <label className="field-group">
                <span>Peso (kg)</span>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={weightValue}
                  onChange={(event) => setWeightValue(event.target.value)}
                  placeholder="Ej. 72.4"
                />
              </label>

              <button type="submit" className="submit-button" disabled={savingWeight}>
                {savingWeight ? "Guardando..." : "Guardar peso"}
              </button>
            </form>

            {weightError ? <p className="error-text">{weightError}</p> : null}
            {weightSuccess ? <p className="success-text">{weightSuccess}</p> : null}

            <div className="weight-week-grid">
              {stats.weeklyWeightDays.map((day) => (
                <div key={day.date} className={`weight-day-card ${day.entry ? "has-weight" : ""}`}>
                  <span>{formatShortDate(day.date)}</span>
                  <strong>{day.entry ? `${day.entry.peso} kg` : "--"}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="card stat-card stat-wide">
            <h3>Macros por día (semana actual)</h3>
            <div className="macro-grid">
              {stats.weekDays.map((date) => {
                const day = stats.macrosByDate[date];
                const total = day.proteinas + day.carbos + day.grasas;
                const p = total ? clampPercent((day.proteinas / total) * 100) : 0;
                const c = total ? clampPercent((day.carbos / total) * 100) : 0;
                const g = total ? clampPercent((day.grasas / total) * 100) : 0;
                return (
                  <div key={date} className="macro-day">
                    <strong>{formatShortDate(date)}</strong>
                    <div className="macro-stack">
                      <div className="macro-protein" style={{ width: `${p}%` }} />
                      <div className="macro-carb" style={{ width: `${c}%` }} />
                      <div className="macro-fat" style={{ width: `${g}%` }} />
                    </div>
                    <small>
                      P {Math.round(day.proteinas)}g · C {Math.round(day.carbos)}g · G {Math.round(day.grasas)}g
                    </small>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="card stat-card">
            <h3>Racha cumpliendo la dieta</h3>
            <div className="streak-row">
              <p className="stat-main">{stats.streak} días</p>
              <span className={`streak-flame ${getFlameLevel(stats.streak)}`} aria-hidden="true">
                <StreakIcon />
              </span>
            </div>
            <p className="stat-sub">Días seguidos marcados como cumplidos.</p>
          </article>

          <article className="card stat-card">
            <h3>Adherencia semanal</h3>
            <p className="stat-main">{stats.adherence}%</p>
            <p className="stat-sub">Días cumplidos esta semana: {stats.completedDaysCount}/7.</p>
            <div className="home-progress-track">
              <div className="home-progress-fill" style={{ width: `${stats.adherence}%` }} />
            </div>
          </article>

          <article className="card stat-card stat-wide">
            <h3>Checklist de dieta (semana actual)</h3>
            <div className="compliance-grid">
              {stats.weekDays.map((date) => (
                <label key={date} className="compliance-item">
                  <input
                    type="checkbox"
                    checked={Boolean(complianceByDate[date])}
                    disabled={isFutureDate(date, todayIso)}
                    onChange={(event) => toggleCompliance(date, event.target.checked)}
                  />
                  <span>{formatShortDate(date)}</span>
                </label>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      {showWeightCalendar ? (
        <div className="modal-overlay" onClick={() => setShowWeightCalendar(false)}>
          <div className="modal-card weight-calendar-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Calendario de peso (30 días)</h3>
                <p className="stat-sub">Vista rápida de tus registros diarios.</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowWeightCalendar(false)}
                aria-label="Cerrar calendario de peso"
              >
                ×
              </button>
            </div>

            <div className="weight-calendar-grid">
              {stats.monthlyWeightDays.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  className={`weight-calendar-day ${day.entry ? "has-weight" : ""} ${
                    day.date === weightDate ? "selected" : ""
                  }`}
                  onClick={() => {
                    setWeightDate(day.date);
                    setShowWeightCalendar(false);
                  }}
                >
                  <span>{formatCalendarDay(day.date)}</span>
                  <strong>{day.entry ? `${day.entry.peso} kg` : "--"}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
