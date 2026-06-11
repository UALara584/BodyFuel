import { useEffect, useMemo, useState } from "react";
import ProfileMenu from "../components/ProfileMenu";
import { fetchFullPlansByUser, fetchTrackingByUser } from "../services/api";

const DAY_KEYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const MACRO_COLORS = {
  proteinas: "var(--primary)",
  carbos: "var(--secondary)",
  grasas: "var(--accent)",
};

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODate(isoDate) {
  return new Date(`${isoDate}T00:00:00`);
}

function addDays(isoDate, amount) {
  const date = parseISODate(isoDate);
  date.setDate(date.getDate() + amount);
  return toISODate(date);
}

function startOfWeek(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getInitialPeriodStart(mode) {
  const today = new Date();
  return toISODate(mode === "week" ? startOfWeek(today) : startOfMonth(today));
}

function getPeriodDays(mode, periodStart) {
  if (mode === "week") {
    return Array.from({ length: 7 }, (_, index) => addDays(periodStart, index));
  }

  const start = parseISODate(periodStart);
  const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const totalDays = Math.round((nextMonth - start) / 86400000);
  return Array.from({ length: totalDays }, (_, index) => addDays(periodStart, index));
}

function movePeriod(periodStart, mode, amount) {
  const date = parseISODate(periodStart);

  if (mode === "week") {
    date.setDate(date.getDate() + amount * 7);
    return toISODate(startOfWeek(date));
  }

  date.setMonth(date.getMonth() + amount, 1);
  return toISODate(startOfMonth(date));
}

function formatPeriodLabel(mode, days) {
  if (mode === "week") {
    const first = parseISODate(days[0]);
    const last = parseISODate(days[days.length - 1]);
    const firstText = `${String(first.getDate()).padStart(2, "0")} ${MONTHS_SHORT[first.getMonth()]}`;
    const lastText = `${String(last.getDate()).padStart(2, "0")} ${MONTHS_SHORT[last.getMonth()]}`;
    return `${firstText} - ${lastText}`;
  }

  return parseISODate(days[0]).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(isoDate) {
  const date = parseISODate(isoDate);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function formatNumber(value, decimals = 0) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

function formatSigned(value, decimals = 1, suffix = "") {
  if (!Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, decimals)}${suffix}`;
}

function linearRegression(points) {
  if (points.length < 2) return null;

  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const denominator = n * sumXX - sumX * sumX;

  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function collectPlanTotals(plans) {
  const totalsByDate = {};

  for (const plan of plans || []) {
    for (const meal of plan.meals || []) {
      const dayIndex = DAY_KEYS.indexOf((meal.dia || "").toLowerCase());
      if (dayIndex < 0) continue;

      const date = addDays(plan.semana_inicio, dayIndex);
      if (!totalsByDate[date]) {
        totalsByDate[date] = { calories: 0, proteinas: 0, carbos: 0, grasas: 0 };
      }

      for (const item of meal.items || []) {
        const qty = Number(item.cantidad || 1);
        const food = item.food;
        const recipe = item.recipe;

        if (food) {
          totalsByDate[date].calories += Number(food.calorias || 0) * qty;
          totalsByDate[date].proteinas += Number(food.proteinas || 0) * qty;
          totalsByDate[date].carbos += Number(food.carbos || 0) * qty;
          totalsByDate[date].grasas += Number(food.grasas || 0) * qty;
        } else if (recipe) {
          totalsByDate[date].calories += Number(recipe.calorias_totales || 0) * qty;
          totalsByDate[date].proteinas += Number(recipe.proteinas || 0) * qty;
          totalsByDate[date].carbos += Number(recipe.carbos || 0) * qty;
          totalsByDate[date].grasas += Number(recipe.grasas || 0) * qty;
        }
      }
    }
  }

  return totalsByDate;
}

function readStoredCompliance(userId) {
  if (!userId) return {};

  try {
    const raw = localStorage.getItem(`bf_compliance_${userId}`);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="card progress-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function EmptyChart({ text }) {
  return <div className="progress-empty-chart">{text}</div>;
}

function WeightTrendChart({ days, points, trend }) {
  if (points.length === 0) {
    return <EmptyChart text="Sin registros de peso en este periodo." />;
  }

  const width = 680;
  const height = 270;
  const left = 44;
  const top = 18;
  const plotWidth = 610;
  const plotHeight = 210;
  const values = points.map((point) => point.value);

  if (trend) {
    values.push(trend.intercept, trend.intercept + trend.slope * (days.length - 1));
  }

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const getX = (dayIndex) => left + (dayIndex / Math.max(days.length - 1, 1)) * plotWidth;
  const getY = (value) => top + ((max - value) / (max - min)) * plotHeight;
  const pointPath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${getX(point.dayIndex)} ${getY(point.value)}`)
    .join(" ");
  const trendPath = trend
    ? `M ${getX(0)} ${getY(trend.intercept)} L ${getX(days.length - 1)} ${getY(
        trend.intercept + trend.slope * (days.length - 1)
      )}`
    : "";

  return (
    <svg className="progress-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tendencia de peso">
      <line x1={left} y1={top} x2={left} y2={top + plotHeight} className="progress-chart-axis" />
      <line x1={left} y1={top + plotHeight} x2={left + plotWidth} y2={top + plotHeight} className="progress-chart-axis" />
      <text x={left - 10} y={top + 8} className="progress-chart-label" textAnchor="end">
        {formatNumber(max, 1)}
      </text>
      <text x={left - 10} y={top + plotHeight} className="progress-chart-label" textAnchor="end">
        {formatNumber(min, 1)}
      </text>
      {trendPath ? <path d={trendPath} className="progress-trend-line" /> : null}
      {pointPath ? <path d={pointPath} className="progress-weight-line" /> : null}
      {points.map((point) => (
        <circle
          key={point.date}
          cx={getX(point.dayIndex)}
          cy={getY(point.value)}
          r="5"
          className="progress-weight-point"
        >
          <title>{`${formatShortDate(point.date)}: ${formatNumber(point.value, 1)} kg`}</title>
        </circle>
      ))}
      {days.map((day, index) => {
        const shouldShow = days.length <= 7 || index % 7 === 0 || index === days.length - 1;
        if (!shouldShow) return null;
        return (
          <text key={day} x={getX(index)} y={height - 12} className="progress-chart-label" textAnchor="middle">
            {formatShortDate(day)}
          </text>
        );
      })}
    </svg>
  );
}

function CaloriesChart({ rows, targetCalories }) {
  const bars = rows.map((row) => ({
    date: row.date,
    value: row.actualCalories ?? row.plannedCalories,
    isActual: row.actualCalories !== null,
  }));
  const values = bars.map((bar) => bar.value).filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) {
    return <EmptyChart text="Sin calorías registradas ni comidas planificadas en este periodo." />;
  }

  const width = 680;
  const height = 270;
  const left = 42;
  const top = 18;
  const plotWidth = 612;
  const plotHeight = 210;
  const maxValue = Math.max(...values, Number(targetCalories || 0), 1);
  const step = plotWidth / bars.length;
  const barWidth = Math.max(4, step * 0.58);
  const getY = (value) => top + ((maxValue - value) / maxValue) * plotHeight;
  const targetY = getY(Number(targetCalories || 0));

  return (
    <svg className="progress-bar-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Calorías por día">
      <line x1={left} y1={top} x2={left} y2={top + plotHeight} className="progress-chart-axis" />
      <line x1={left} y1={top + plotHeight} x2={left + plotWidth} y2={top + plotHeight} className="progress-chart-axis" />
      {targetCalories ? (
        <>
          <line x1={left} x2={left + plotWidth} y1={targetY} y2={targetY} className="progress-target-line" />
          <text x={left + plotWidth - 4} y={targetY - 6} className="progress-chart-label" textAnchor="end">
            objetivo
          </text>
        </>
      ) : null}
      {bars.map((bar, index) => {
        if (!Number.isFinite(bar.value) || bar.value <= 0) return null;
        const barHeight = Math.max(2, top + plotHeight - getY(bar.value));
        const x = left + index * step + (step - barWidth) / 2;
        return (
          <rect
            key={bar.date}
            x={x}
            y={top + plotHeight - barHeight}
            width={barWidth}
            height={barHeight}
            rx="4"
            className={bar.isActual ? "progress-calorie-bar actual" : "progress-calorie-bar planned"}
          >
            <title>{`${formatShortDate(bar.date)}: ${formatNumber(bar.value)} kcal`}</title>
          </rect>
        );
      })}
      {bars.map((bar, index) => {
        const shouldShow = bars.length <= 7 || index % 7 === 0 || index === bars.length - 1;
        if (!shouldShow) return null;
        return (
          <text
            key={`label-${bar.date}`}
            x={left + index * step + step / 2}
            y={height - 12}
            className="progress-chart-label"
            textAnchor="middle"
          >
            {formatShortDate(bar.date)}
          </text>
        );
      })}
    </svg>
  );
}

function MacroStackChart({ groups }) {
  const visibleGroups = groups.filter((group) => group.total > 0);

  if (visibleGroups.length === 0) {
    return <EmptyChart text="Sin macros planificados en este periodo." />;
  }

  const width = 680;
  const height = 270;
  const left = 44;
  const top = 18;
  const plotWidth = 610;
  const plotHeight = 210;
  const maxTotal = Math.max(...groups.map((group) => group.total), 1);
  const step = plotWidth / groups.length;
  const barWidth = Math.max(24, Math.min(64, step * 0.55));

  return (
    <svg className="progress-macro-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Macros planificados">
      <line x1={left} y1={top} x2={left} y2={top + plotHeight} className="progress-chart-axis" />
      <line x1={left} y1={top + plotHeight} x2={left + plotWidth} y2={top + plotHeight} className="progress-chart-axis" />
      {groups.map((group, index) => {
        let yCursor = top + plotHeight;
        const x = left + index * step + (step - barWidth) / 2;
        const segments = [
          ["proteinas", group.proteinas],
          ["carbos", group.carbos],
          ["grasas", group.grasas],
        ];

        return (
          <g key={group.key}>
            {segments.map(([key, value]) => {
              const segmentHeight = (value / maxTotal) * plotHeight;
              yCursor -= segmentHeight;
              if (segmentHeight <= 0) return null;
              return (
                <rect
                  key={key}
                  x={x}
                  y={yCursor}
                  width={barWidth}
                  height={segmentHeight}
                  rx="4"
                  fill={MACRO_COLORS[key]}
                >
                  <title>{`${group.label}: ${formatNumber(value)} g`}</title>
                </rect>
              );
            })}
            <text x={left + index * step + step / 2} y={height - 12} className="progress-chart-label" textAnchor="middle">
              {group.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function AdherenceGrid({ rows }) {
  return (
    <div className="progress-adherence-grid">
      {rows.map((row) => (
        <span
          key={row.date}
          className={`progress-adherence-day ${row.completed ? "done" : ""} ${
            row.isFuture ? "future" : ""
          }`}
          title={`${formatShortDate(row.date)}: ${row.completed ? "completado" : "sin marcar"}`}
        >
          {parseISODate(row.date).getDate()}
        </span>
      ))}
    </div>
  );
}

export default function ProgressPage() {
  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userId = currentUser?.id;
  const targetCalories = Number(currentUser?.calorias_objetivo || 0);
  const todayIso = toISODate(new Date());

  const [rangeMode, setRangeMode] = useState("week");
  const [periodStart, setPeriodStart] = useState(() => getInitialPeriodStart("week"));
  const [trackingEntries, setTrackingEntries] = useState([]);
  const [plans, setPlans] = useState([]);
  const [complianceByDate, setComplianceByDate] = useState(() => readStoredCompliance(userId));
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(userId ? "" : "No hay usuario activo.");

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setComplianceByDate(readStoredCompliance(userId));
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [userId]);

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

    async function loadProgressData() {
      try {
        setLoading(true);
        setError("");
        const [trackingData, planData] = await Promise.all([
          fetchTrackingByUser(userId),
          fetchFullPlansByUser(userId),
        ]);
        if (cancelled) return;
        setTrackingEntries(trackingData || []);
        setPlans(planData || []);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "No se pudo cargar el progreso.");
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    loadProgressData();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const periodDays = useMemo(() => getPeriodDays(rangeMode, periodStart), [rangeMode, periodStart]);
  const periodLabel = useMemo(() => formatPeriodLabel(rangeMode, periodDays), [rangeMode, periodDays]);

  const progress = useMemo(() => {
    const trackingByDate = Object.fromEntries((trackingEntries || []).map((entry) => [entry.fecha, entry]));
    const plannedByDate = collectPlanTotals(plans);
    const rows = periodDays.map((date) => {
      const tracking = trackingByDate[date] || {};
      const planned = plannedByDate[date] || { calories: 0, proteinas: 0, carbos: 0, grasas: 0 };
      const actualCalories = Number(tracking.calorias_consumidas || 0);
      const peso = Number(tracking.peso || 0);

      return {
        date,
        peso: peso > 0 ? peso : null,
        actualCalories: actualCalories > 0 ? actualCalories : null,
        plannedCalories: planned.calories > 0 ? planned.calories : null,
        proteinas: planned.proteinas,
        carbos: planned.carbos,
        grasas: planned.grasas,
        completed: Boolean(complianceByDate[date]),
        isFuture: date > todayIso,
      };
    });

    const weightPoints = rows
      .map((row, index) => ({ date: row.date, value: row.peso, dayIndex: index }))
      .filter((point) => point.value !== null);
    const regressionInput = weightPoints.map((point) => ({ x: point.dayIndex, y: point.value }));
    const weightTrend = linearRegression(regressionInput);
    const periodWeightChange =
      weightPoints.length >= 2 ? weightPoints[weightPoints.length - 1].value - weightPoints[0].value : null;
    const lastWeight = [...trackingEntries]
      .filter((entry) => Number(entry.peso || 0) > 0 && entry.fecha <= todayIso)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .at(-1);

    const eligibleAdherenceRows = rows.filter((row) => !row.isFuture);
    const completedDays = eligibleAdherenceRows.filter((row) => row.completed).length;
    const adherence = eligibleAdherenceRows.length
      ? Math.round((completedDays / eligibleAdherenceRows.length) * 100)
      : 0;

    const macroTotals = rows.reduce(
      (acc, row) => {
        acc.proteinas += row.proteinas;
        acc.carbos += row.carbos;
        acc.grasas += row.grasas;
        return acc;
      },
      { proteinas: 0, carbos: 0, grasas: 0 }
    );
    const macroGramTotal = macroTotals.proteinas + macroTotals.carbos + macroTotals.grasas;
    const macroKcalTotal = macroTotals.proteinas * 4 + macroTotals.carbos * 4 + macroTotals.grasas * 9;
    const macroRatio = macroKcalTotal
      ? {
          proteinas: Math.round(((macroTotals.proteinas * 4) / macroKcalTotal) * 100),
          carbos: Math.round(((macroTotals.carbos * 4) / macroKcalTotal) * 100),
          grasas: Math.round(((macroTotals.grasas * 9) / macroKcalTotal) * 100),
        }
      : null;

    const macroGroups =
      rangeMode === "week"
        ? rows.map((row) => ({
            key: row.date,
            label: formatShortDate(row.date),
            proteinas: row.proteinas,
            carbos: row.carbos,
            grasas: row.grasas,
            total: row.proteinas + row.carbos + row.grasas,
          }))
        : Object.values(
            rows.reduce((acc, row) => {
              const weekKey = toISODate(startOfWeek(parseISODate(row.date)));
              if (!acc[weekKey]) {
                acc[weekKey] = {
                  key: weekKey,
                  label: formatShortDate(weekKey),
                  proteinas: 0,
                  carbos: 0,
                  grasas: 0,
                  total: 0,
                };
              }
              acc[weekKey].proteinas += row.proteinas;
              acc[weekKey].carbos += row.carbos;
              acc[weekKey].grasas += row.grasas;
              acc[weekKey].total += row.proteinas + row.carbos + row.grasas;
              return acc;
            }, {})
          );

    return {
      rows,
      weightPoints,
      weightTrend,
      periodWeightChange,
      lastWeight: lastWeight ? Number(lastWeight.peso) : null,
      adherence,
      completedDays,
      eligibleAdherenceDays: eligibleAdherenceRows.length,
      macroTotals,
      macroRatio,
      macroGramTotal,
      macroGroups,
    };
  }, [complianceByDate, periodDays, plans, rangeMode, todayIso, trackingEntries]);

  const currentPeriodStart = getInitialPeriodStart(rangeMode);
  const nextPeriodStart = movePeriod(periodStart, rangeMode, 1);
  const nextDisabled = nextPeriodStart > currentPeriodStart;

  function handleModeChange(nextMode) {
    setRangeMode(nextMode);
    setPeriodStart(getInitialPeriodStart(nextMode));
  }

  const weeklyWeightSlope = progress.weightTrend ? progress.weightTrend.slope * 7 : null;

  return (
    <div className="page profile-area-page progress-page">
      <div className="profile-dashboard-layout">
        <section className="profile-main-column progress-main-column">
          <div className="page-header progress-page-header">
            <div>
              <h2>Gráficas de progreso</h2>
              <p>Peso, calorías, adherencia y macros por semana o mes.</p>
            </div>

            <div className="progress-period-controls">
              <div className="progress-range-toggle" role="group" aria-label="Periodo">
                <button
                  type="button"
                  className={rangeMode === "week" ? "active" : ""}
                  onClick={() => handleModeChange("week")}
                >
                  Semana
                </button>
                <button
                  type="button"
                  className={rangeMode === "month" ? "active" : ""}
                  onClick={() => handleModeChange("month")}
                >
                  Mes
                </button>
              </div>

              <div className="progress-period-stepper">
                <button type="button" onClick={() => setPeriodStart(movePeriod(periodStart, rangeMode, -1))}>
                  &lt;
                </button>
                <strong>{periodLabel}</strong>
                <button
                  type="button"
                  onClick={() => setPeriodStart(nextPeriodStart)}
                  disabled={nextDisabled}
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>

          {loading ? <p>Cargando progreso...</p> : null}
          {error ? <p className="error-text">{error}</p> : null}

          {!loading && !error ? (
            <>
              <section className="progress-metrics-grid">
                <MetricCard
                  label="Peso actual"
                  value={progress.lastWeight ? `${formatNumber(progress.lastWeight, 1)} kg` : "-"}
                  detail={
                    progress.periodWeightChange !== null
                      ? `${formatSigned(progress.periodWeightChange, 1, " kg")} en el periodo`
                      : "Añade pesos para ver evolución"
                  }
                />
                <MetricCard
                  label="Adherencia"
                  value={`${progress.adherence}%`}
                  detail={`${progress.completedDays} de ${progress.eligibleAdherenceDays} días marcados`}
                />
                <MetricCard
                  label="Macros planificados"
                  value={progress.macroGramTotal ? `${formatNumber(progress.macroGramTotal)} g` : "-"}
                  detail={
                    progress.macroRatio
                      ? `${progress.macroRatio.proteinas}% P / ${progress.macroRatio.carbos}% C / ${progress.macroRatio.grasas}% G`
                      : "Sin comidas con macros"
                  }
                />
              </section>

              <section className="progress-insights">
                <article className="card progress-insight">
                  <span>Tendencia de peso</span>
                  <strong>
                    {weeklyWeightSlope !== null ? formatSigned(weeklyWeightSlope, 2, " kg/sem") : "Sin tendencia"}
                  </strong>
                  <p>{progress.weightPoints.length >= 2 ? "Regresión del periodo seleccionado" : "Registra al menos dos pesos"}</p>
                </article>
                <article className="card progress-insight">
                  <span>Consistencia</span>
                  <strong>{progress.adherence >= 80 ? "Alta" : progress.adherence >= 50 ? "Media" : "Baja"}</strong>
                  <p>{progress.completedDays} días completados en el periodo</p>
                </article>
              </section>

              <section className="progress-chart-grid">
                <article className="card progress-chart-panel">
                  <div className="progress-chart-head">
                    <h3>Peso</h3>
                    <span>Tendencia real</span>
                  </div>
                  <WeightTrendChart days={periodDays} points={progress.weightPoints} trend={progress.weightTrend} />
                </article>

                <article className="card progress-chart-panel">
                  <div className="progress-chart-head">
                    <h3>Calorías</h3>
                    <span>Registradas y planificadas</span>
                  </div>
                  <CaloriesChart rows={progress.rows} targetCalories={targetCalories} />
                </article>

                <article className="card progress-chart-panel">
                  <div className="progress-chart-head">
                    <h3>Macros</h3>
                    <span>Proteínas, carbos y grasas</span>
                  </div>
                  <MacroStackChart groups={progress.macroGroups} />
                  <div className="progress-macro-legend">
                    <span><i className="macro-dot protein" /> Proteínas</span>
                    <span><i className="macro-dot carbs" /> Carbos</span>
                    <span><i className="macro-dot fats" /> Grasas</span>
                  </div>
                </article>

                <article className="card progress-chart-panel progress-adherence-panel">
                  <div className="progress-chart-head">
                    <h3>Adherencia</h3>
                    <span>Calendario de cumplimiento</span>
                  </div>
                  <AdherenceGrid rows={progress.rows} />
                </article>
              </section>
            </>
          ) : null}
        </section>

        <ProfileMenu />
      </div>
    </div>
  );
}
