import { useEffect, useMemo, useState } from "react";
import { fetchFullPlan, fetchTrackingByUser } from "../services/api";

function toISODate(value) {
  return value.toISOString().slice(0, 10);
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

export default function HomePage() {
  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userName = currentUser?.nombre || "Usuario";
  const initial = userName.charAt(0).toUpperCase() || "U";
  const userId = currentUser?.id;
  const targetCalories = Number(currentUser?.calorias_objetivo || 0);
  const weekStart = getCurrentWeekMonday();

  const [trackingEntries, setTrackingEntries] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    const consumedToday = Number(todayEntry?.calorias_consumidas || 0);
    const consumedPercent = targetCalories ? clampPercent((consumedToday / targetCalories) * 100) : 0;
    const remainingToday = Math.max(targetCalories - consumedToday, 0);

    const last7Weights = sortedTracking.filter((entry) => Boolean(entry.peso)).slice(-7);
    const last30Weights = sortedTracking.filter((entry) => Boolean(entry.peso)).slice(-30);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(`${weekStart}T00:00:00`);
      date.setDate(date.getDate() + i);
      return toISODate(date);
    });

    const defaultMacro = { proteinas: 0, carbos: 0, grasas: 0 };
    const macrosByDate = Object.fromEntries(weekDays.map((date) => [date, { ...defaultMacro }]));

    for (const meal of weeklyPlan?.meals || []) {
      const dayIndex = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"].indexOf(
        (meal.dia || "").toLowerCase()
      );
      if (dayIndex < 0) continue;
      const dayDate = weekDays[dayIndex];

      for (const item of meal.items || []) {
        const qty = Number(item.cantidad || 1);
        if (item.food) {
          macrosByDate[dayDate].proteinas += Number(item.food.proteinas || 0) * qty;
          macrosByDate[dayDate].carbos += Number(item.food.carbos || 0) * qty;
          macrosByDate[dayDate].grasas += Number(item.food.grasas || 0) * qty;
       } else if (item.recipe) {
  macrosByDate[dayDate].proteinas += Number(item.recipe.proteinas || 0) * qty;
  macrosByDate[dayDate].carbos += Number(item.recipe.carbos || 0) * qty;
  macrosByDate[dayDate].grasas += Number(item.recipe.grasas || 0) * qty;
}
      }
    }

    let streak = 0;
    for (let i = sortedTracking.length - 1; i >= 0; i -= 1) {
      const consumed = Number(sortedTracking[i].calorias_consumidas || 0);
      const min = targetCalories * 0.9;
      const max = targetCalories * 1.1;
      if (targetCalories > 0 && consumed >= min && consumed <= max) {
        streak += 1;
      } else {
        break;
      }
    }

    const weekTracking = sortedTracking.filter((entry) => weekDays.includes(entry.fecha));
    const compliantDays = weekTracking.filter((entry) => {
      const consumed = Number(entry.calorias_consumidas || 0);
      const min = targetCalories * 0.9;
      const max = targetCalories * 1.1;
      return targetCalories > 0 && consumed >= min && consumed <= max;
    }).length;
    const adherence = clampPercent((compliantDays / 7) * 100);

    return {
      consumedToday,
      consumedPercent,
      remainingToday,
      weeklyWeight: last7Weights,
      monthlyWeight: last30Weights,
      macrosByDate,
      streak,
      adherence,
      weekDays,
    };
  }, [trackingEntries, weeklyPlan, targetCalories, weekStart]);

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

      {loading ? <p>Cargando estadísticas...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && !error ? (
        <section className="stats-grid">
          <article className="card stat-card">
            <h3>Calorías de hoy</h3>
            <p className="stat-main">{stats.consumedToday} kcal</p>
            <p className="stat-sub">Objetivo: {targetCalories || "-"} kcal · Restantes: {stats.remainingToday} kcal</p>
            <div className="home-progress-track">
              <div className="home-progress-fill" style={{ width: `${stats.consumedPercent}%` }} />
            </div>
          </article>

          <article className="card stat-card">
            <h3>Evolución de peso (7 días)</h3>
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
            <h3>Evolución de peso (30 días)</h3>
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
                    <small>P {Math.round(day.proteinas)}g · C {Math.round(day.carbos)}g · G {Math.round(day.grasas)}g</small>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="card stat-card">
            <h3>Racha cumpliendo el plan</h3>
            <p className="stat-main">{stats.streak} días</p>
            <p className="stat-sub">Días consecutivos dentro del objetivo calórico.</p>
          </article>

          <article className="card stat-card">
            <h3>Adherencia semanal</h3>
            <p className="stat-main">{stats.adherence}%</p>
            <p className="stat-sub">Porcentaje de días de la semana en rango objetivo.</p>
            <div className="home-progress-track">
              <div className="home-progress-fill" style={{ width: `${stats.adherence}%` }} />
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}