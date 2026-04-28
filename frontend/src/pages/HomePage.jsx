import { useEffect, useMemo, useState } from "react";
import { fetchFullPlan, fetchTrackingByUser } from "../services/api";

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

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

const DAY_NAMES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

export default function HomePage() {
  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userName = currentUser?.nombre || "Usuario";
  const initial = userName.charAt(0).toUpperCase() || "U";
  const userId = currentUser?.id;
  const targetCalories = Number(currentUser?.calorias_objetivo || 0);
  const weekStart = getCurrentWeekMonday();
  const complianceStorageKey = userId ? `bf_compliance_${userId}` : "";

  const [trackingEntries, setTrackingEntries] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [complianceByDate, setComplianceByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!complianceStorageKey) {
      setComplianceByDate({});
      return;
    }
    try {
      const raw = localStorage.getItem(complianceStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      setComplianceByDate(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setComplianceByDate({});
    }
  }, [complianceStorageKey]);

  useEffect(() => {
    if (!complianceStorageKey) return;
    localStorage.setItem(complianceStorageKey, JSON.stringify(complianceByDate));
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

  const stats = useMemo(() => {
    const sortedTracking = [...trackingEntries].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const todayIso = toISODate(new Date());
    const todayEntry = sortedTracking.find((entry) => entry.fecha === todayIso);

    const last7Weights = sortedTracking.filter((entry) => Boolean(entry.peso)).slice(-7);
    const last30Weights = sortedTracking.filter((entry) => Boolean(entry.peso)).slice(-30);

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
      weeklyWeight: last7Weights,
      monthlyWeight: last30Weights,
      macrosByDate,
      streak,
      adherence,
      weekDays,
      completedDaysCount,
    };
  }, [trackingEntries, weeklyPlan, targetCalories, weekStart, complianceByDate]);

  function toggleCompliance(date, checked) {
    setComplianceByDate((prev) => ({
      ...prev,
      [date]: checked,
    }));
  }

  function getFlameLevel(streak) {
    if (streak >= 14) return "flame-4";
    if (streak >= 7) return "flame-3";
    if (streak >= 3) return "flame-2";
    if (streak >= 1) return "flame-1";
    return "flame-0";
  }

  const todayIso = toISODate(new Date());

  return (
    <div className="page home-page">
      <section className="home-top">
        <div>
          <p className="home-greeting">Buenos dias</p>
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
            <h3>Calorias de hoy</h3>
            <p className="stat-main">{stats.consumedToday} kcal</p>
            <p className="stat-sub">
              Objetivo: {targetCalories || "-"} kcal · Restantes: {stats.remainingToday} kcal
            </p>
            <div className="home-progress-track">
              <div className="home-progress-fill" style={{ width: `${stats.consumedPercent}%` }} />
            </div>
          </article>

          <article className="card stat-card">
            <h3>Evolucion de peso (7 dias)</h3>
            <div className="simple-chart">
              {stats.weeklyWeight.length === 0 ? (
                <p className="item-note">Sin registros de peso.</p>
              ) : (
                stats.weeklyWeight.map((entry) => (
                  <div key={entry.id} className="chart-point">
                    <span>{entry.peso} kg</span>
                    <small>{formatShortDate(entry.fecha)}</small>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="card stat-card">
            <h3>Evolucion de peso (30 dias)</h3>
            <div className="simple-chart simple-chart-compact">
              {stats.monthlyWeight.length === 0 ? (
                <p className="item-note">Sin registros mensuales.</p>
              ) : (
                stats.monthlyWeight.map((entry) => (
                  <div key={`m-${entry.id}`} className="chart-bar-wrap" title={`${entry.peso} kg · ${entry.fecha}`}>
                    <div className="chart-bar" style={{ height: `${clampPercent((entry.peso / 120) * 100)}%` }} />
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="card stat-card stat-wide">
            <h3>Macros por dia (semana actual)</h3>
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
              <p className="stat-main">{stats.streak} dias</p>
              <span className={`streak-flame ${getFlameLevel(stats.streak)}`} aria-hidden="true">
                🔥
              </span>
            </div>
            <p className="stat-sub">Dias seguidos marcados como cumplidos.</p>
          </article>

          <article className="card stat-card">
            <h3>Adherencia semanal</h3>
            <p className="stat-main">{stats.adherence}%</p>
            <p className="stat-sub">Dias cumplidos esta semana: {stats.completedDaysCount}/7.</p>
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
    </div>
  );
}
