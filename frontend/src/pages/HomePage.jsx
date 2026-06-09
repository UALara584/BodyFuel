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

function formatWeekdayShort(isoDate) {
  const label = new Date(`${isoDate}T00:00:00`).toLocaleDateString("es-ES", {
    weekday: "short",
  });
  return label.replace(".", "").slice(0, 3);
}

function formatCalendarDay(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

function getMonthStart(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  return toISODate(new Date(date.getFullYear(), date.getMonth(), 1));
}

function moveMonth(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00`);
  return toISODate(new Date(date.getFullYear(), date.getMonth() + amount, 1));
}

function getMonthCalendarCells(monthStart) {
  const firstDay = new Date(`${monthStart}T00:00:00`);
  const nextMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 1);
  const totalDays = Math.round((nextMonth - firstDay) / 86400000);
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
  const dates = Array.from({ length: totalDays }, (_, index) => addDays(monthStart, index));
  const cells = [...Array(leadingEmptyDays).fill(null), ...dates];
  const trailingEmptyDays = (7 - (cells.length % 7)) % 7;

  return [...cells, ...Array(trailingEmptyDays).fill(null)];
}

function formatMonthLabel(monthStart) {
  return new Date(`${monthStart}T00:00:00`).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readStoredCompliance(storageKey) {
  if (!storageKey) return {};

  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    console.error("Error loading compliance data:", err);
    return {};
  }
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
  const userId = currentUser?.id;
  const targetCalories = Number(currentUser?.calorias_objetivo || 0);
  const weekStart = getCurrentWeekMonday();

  const complianceStorageKey = useMemo(() => (userId ? `bf_compliance_${userId}` : ""), [userId]);

  const [trackingEntries, setTrackingEntries] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [complianceVersion, setComplianceVersion] = useState(0);
  const complianceByDate = useMemo(
    () => {
      void complianceVersion;
      return readStoredCompliance(complianceStorageKey);
    },
    [complianceStorageKey, complianceVersion]
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showWeightCalendar, setShowWeightCalendar] = useState(false);
  const [showStreakCalendar, setShowStreakCalendar] = useState(false);
  const [streakMonthStart, setStreakMonthStart] = useState(() => getMonthStart(toISODate(new Date())));
  const [weightDate, setWeightDate] = useState(() => toISODate(new Date()));
  const [weightValue, setWeightValue] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightError, setWeightError] = useState("");
  const [weightSuccess, setWeightSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      const timerId = window.setTimeout(() => {
        if (cancelled) return;
        setLoading(false);
        setError("No hay usuario activo.");
      }, 0);

      return () => {
        cancelled = true;
        window.clearTimeout(timerId);
      };
    }

    async function loadStats() {
      setLoading(true);
      setError("");
      try {
        const [trackingData, planData] = await Promise.all([
          fetchTrackingByUser(userId),
          fetchFullPlan(userId, weekStart).catch(() => null),
        ]);
        if (cancelled) return;
        setTrackingEntries(trackingData);
        setWeeklyPlan(planData);
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [userId, weekStart]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const entryForDate = trackingEntries.find((entry) => entry.fecha === weightDate);
      setWeightValue(entryForDate?.peso ? String(entryForDate.peso) : "");
      setWeightError("");
      setWeightSuccess("");
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [trackingEntries, weightDate]);

  useEffect(() => {
    if (!showStreakCalendar) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setShowStreakCalendar(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showStreakCalendar]);

  const todayIso = toISODate(new Date());

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

    const currentStreakDates = [];
    let cursor = todayIso;
    while (complianceByDate[cursor]) {
      currentStreakDates.push(cursor);
      cursor = addDays(cursor, -1);
    }

    return {
      consumedToday: consumedTodayRounded,
      consumedPercent,
      remainingToday,
      weeklyWeightDays: last7WeightDays,
      monthlyWeightDays: last30WeightDays,
      macrosByDate,
      streak: currentStreakDates.length,
      currentStreakDates,
      adherence,
      weekDays,
      completedDaysCount,
    };
  }, [trackingEntries, weeklyPlan, targetCalories, weekStart, complianceByDate]);

  const currentMonthStart = getMonthStart(todayIso);
  const streakCalendarCells = useMemo(
    () => getMonthCalendarCells(streakMonthStart),
    [streakMonthStart]
  );
  const currentStreakDates = useMemo(
    () => new Set(stats.currentStreakDates),
    [stats.currentStreakDates]
  );
  const completedDaysInStreakMonth = useMemo(
    () =>
      streakCalendarCells.filter(
        (date) => date && date <= todayIso && Boolean(complianceByDate[date])
      ).length,
    [complianceByDate, streakCalendarCells, todayIso]
  );
  const weightChartDays = useMemo(() => {
    const values = stats.weeklyWeightDays
      .map((day) => Number(day.entry?.peso || 0))
      .filter((value) => value > 0);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const range = Math.max(max - min, 1);

    return stats.weeklyWeightDays.map((day, index) => {
      const weight = Number(day.entry?.peso || 0);
      const fallbackHeight = 34 + ((index * 13) % 36);
      const height = weight ? 46 + ((weight - min) / range) * 48 : fallbackHeight;

      return {
        ...day,
        height: Math.round(height),
      };
    });
  }, [stats.weeklyWeightDays]);

  const toggleCompliance = useCallback((date, checked) => {
    if (!complianceStorageKey) return;

    const updated = { ...readStoredCompliance(complianceStorageKey) };

    if (checked) {
      updated[date] = true;
    } else {
      delete updated[date];
    }

    try {
      localStorage.setItem(complianceStorageKey, JSON.stringify(updated));
      setComplianceVersion((version) => version + 1);
    } catch (err) {
      console.error("Error saving compliance data:", err);
    }
  }, [complianceStorageKey]);

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

  return (
    <div className="page home-page">
      <div className="home-mobile-greeting">
        <p>Buenos días</p>
        <h2>{userName}</h2>
      </div>

      {loading ? <div className="dashboard-loading">Cargando estadísticas...</div> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && !error ? (
        <section className="dashboard-grid">
          <article className="dashboard-card dashboard-calories-card">
            <div className="dashboard-card-heading">
              <h3>Calorías de hoy</h3>
              <span className="dashboard-bolt" aria-hidden="true">ϟ</span>
            </div>

            <div
              className="calorie-ring"
              style={{ "--dashboard-progress": `${stats.consumedPercent * 3.6}deg` }}
              aria-label={`${stats.consumedPercent}% del objetivo diario`}
            >
              <div className="calorie-ring-inner">
                <strong>{stats.consumedToday}</strong>
                <span>KCAL</span>
              </div>
            </div>

            <div className="calorie-summary">
              <div>
                <span>Objetivo</span>
                <strong>{targetCalories || "-"} kcal</strong>
              </div>
              <div>
                <span>Restante</span>
                <strong>{stats.remainingToday} kcal</strong>
              </div>
            </div>
          </article>

          <article className="dashboard-card dashboard-weight-card">
            <div className="dashboard-card-heading dashboard-weight-heading">
              <div>
                <h3>Evolución de peso (7 días)</h3>
                <p>Registra tu progreso diario</p>
              </div>
              <button type="button" onClick={() => setShowWeightCalendar(true)}>
                Ver calendario 30 días
              </button>
            </div>

            <div className="dashboard-weight-chart" aria-label="Gráfico de peso de los últimos 7 días">
              {weightChartDays.map((day) => (
                <div key={day.date} className="dashboard-weight-column">
                  <span className="dashboard-weight-value">
                    {day.entry ? `${day.entry.peso} kg` : "--"}
                  </span>
                  <div
                    className={`dashboard-weight-bar ${day.date === todayIso ? "today" : ""} ${
                      day.entry ? "has-value" : ""
                    }`}
                    style={{ height: `${day.height}%` }}
                  />
                  <small>{formatShortDate(day.date)}</small>
                </div>
              ))}
            </div>

            <form className="dashboard-weight-form" onSubmit={handleSaveWeight}>
              <label>
                <span>Fecha</span>
                <input
                  type="date"
                  value={weightDate}
                  max={todayIso}
                  onChange={(event) => setWeightDate(event.target.value)}
                />
              </label>

              <label>
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

              <button type="submit" disabled={savingWeight}>
                {savingWeight ? "Guardando..." : "Guardar peso"}
              </button>
            </form>

            {weightError ? <p className="error-text">{weightError}</p> : null}
            {weightSuccess ? <p className="success-text">{weightSuccess}</p> : null}
          </article>

          <article className="dashboard-card dashboard-macros-card">
            <div className="dashboard-card-heading">
              <h3>Macros por día</h3>
              <span className="dashboard-period-pill">Semana actual</span>
            </div>

            <div className="dashboard-macro-grid">
              {stats.weekDays.map((date) => {
                const day = stats.macrosByDate[date];
                const maxMacro = Math.max(day.proteinas, day.carbos, day.grasas, 1);
                const isToday = date === todayIso;

                return (
                  <div key={date} className={`dashboard-macro-day ${isToday ? "today" : ""}`}>
                    <strong>{formatShortDate(date)}</strong>
                    <div className="dashboard-macro-bars">
                      <i>
                        <span
                          className="protein"
                          style={{ width: `${clampPercent((day.proteinas / maxMacro) * 100)}%` }}
                        />
                      </i>
                      <i>
                        <span
                          className="carbs"
                          style={{ width: `${clampPercent((day.carbos / maxMacro) * 100)}%` }}
                        />
                      </i>
                      <i>
                        <span
                          className="fats"
                          style={{ width: `${clampPercent((day.grasas / maxMacro) * 100)}%` }}
                        />
                      </i>
                    </div>
                    <small>
                      {Math.round(day.proteinas)}g · {Math.round(day.carbos)}g · {Math.round(day.grasas)}g
                    </small>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="dashboard-card dashboard-streak-card">
            <div>
              <div className="dashboard-card-heading">
                <h3>Racha actual</h3>
                <button
                  type="button"
                  onClick={() => {
                    setStreakMonthStart(currentMonthStart);
                    setShowStreakCalendar(true);
                  }}
                >
                  Ver calendario
                </button>
              </div>

              <div className="dashboard-streak-main">
                <span className={`streak-flame ${getFlameLevel(stats.streak)}`} aria-hidden="true">
                  <StreakIcon />
                </span>
                <div>
                  <strong>{stats.streak} días</strong>
                  <p>Días seguidos cumplidos</p>
                </div>
              </div>
            </div>

            <div className="dashboard-adherence">
              <div>
                <h3>Adherencia semanal</h3>
                <strong>{stats.adherence}%</strong>
              </div>
              <div className="home-progress-track">
                <div className="home-progress-fill" style={{ width: `${stats.adherence}%` }} />
              </div>
              <p>Días cumplidos esta semana: {stats.completedDaysCount}/7.</p>
            </div>
          </article>

          <article className="dashboard-card dashboard-checklist-card">
            <div className="dashboard-card-heading">
              <h3>Checklist de dieta (semana actual)</h3>
              <span className="dashboard-check-icon" aria-hidden="true">✓</span>
            </div>
            <div className="dashboard-compliance-grid">
              {stats.weekDays.map((date) => {
                const completed = Boolean(complianceByDate[date]);
                const isToday = date === todayIso;

                return (
                  <label
                    key={date}
                    className={`dashboard-compliance-item ${completed ? "completed" : ""} ${
                      isToday ? "today" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={completed}
                      disabled={isFutureDate(date, todayIso)}
                      onChange={(event) => toggleCompliance(date, event.target.checked)}
                    />
                    <span>
                      <strong>{formatShortDate(date)}</strong>
                      <small>{formatWeekdayShort(date)}</small>
                    </span>
                  </label>
                );
              })}
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

      {showStreakCalendar ? (
        <div className="modal-overlay" onClick={() => setShowStreakCalendar(false)}>
          <div
            className="modal-card streak-calendar-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="streak-calendar-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 id="streak-calendar-title">Calendario de racha</h3>
                <p className="stat-sub">Consulta y actualiza los días que has cumplido tu dieta.</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowStreakCalendar(false)}
                aria-label="Cerrar calendario de racha"
              >
                ×
              </button>
            </div>

            <div className="streak-calendar-summary">
              <div>
                <span>Racha actual</span>
                <strong>{stats.streak} días</strong>
              </div>
              <div>
                <span>Completados en el mes</span>
                <strong>{completedDaysInStreakMonth}</strong>
              </div>
            </div>

            <div className="streak-month-navigation">
              <button
                type="button"
                onClick={() => setStreakMonthStart((month) => moveMonth(month, -1))}
                aria-label="Ver mes anterior"
              >
                &lt;
              </button>
              <strong>{formatMonthLabel(streakMonthStart)}</strong>
              <button
                type="button"
                onClick={() => setStreakMonthStart((month) => moveMonth(month, 1))}
                disabled={streakMonthStart >= currentMonthStart}
                aria-label="Ver mes siguiente"
              >
                &gt;
              </button>
            </div>

            <div className="streak-weekdays" aria-hidden="true">
              {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="streak-calendar-grid">
              {streakCalendarCells.map((date, index) => {
                if (!date) {
                  return <span key={`empty-${index}`} className="streak-calendar-empty" aria-hidden="true" />;
                }

                const completed = Boolean(complianceByDate[date]);
                const isCurrentStreak = currentStreakDates.has(date);
                const isFuture = date > todayIso;
                const isToday = date === todayIso;

                return (
                  <button
                    key={date}
                    type="button"
                    className={`streak-calendar-day ${completed ? "completed" : ""} ${
                      isCurrentStreak ? "current-streak" : ""
                    } ${isFuture ? "future" : ""} ${isToday ? "today" : ""}`}
                    disabled={isFuture}
                    aria-pressed={completed}
                    aria-label={`${formatCalendarDay(date)}: ${
                      completed ? "día cumplido" : "día sin cumplir"
                    }`}
                    onClick={() => toggleCompliance(date, !completed)}
                  >
                    <span>{new Date(`${date}T00:00:00`).getDate()}</span>
                  </button>
                );
              })}
            </div>

            <div className="streak-calendar-legend">
              <span><i className="current" /> Racha actual</span>
              <span><i className="completed" /> Cumplido anteriormente</span>
              <span><i className="pending" /> Sin cumplir</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
