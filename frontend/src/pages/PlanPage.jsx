import { useEffect, useState } from "react";
import { createMeal, fetchFullPlan } from "../services/api";

export default function PlanPage() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    dia: "lunes",
    tipo_comida: "desayuno",
    hora: "08:30",
  });

  const USER_ID = 1;
  const WEEK_START = "2026-04-20";
  const PLAN_ID = 1;

  async function loadPlan() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchFullPlan(USER_ID, WEEK_START);
      setPlan(data);
    } catch (err) {
      setError(err.message);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlan();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      await createMeal({
        weekly_plan_id: PLAN_ID,
        dia: formData.dia,
        tipo_comida: formData.tipo_comida,
        hora: formData.hora,
      });

      await loadPlan();

      setFormData({
        dia: "lunes",
        tipo_comida: "desayuno",
        hora: "08:30",
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Plan semanal</h2>
        <p>Vista general de comidas y elementos del plan.</p>
      </div>

      <div className="card form-card">
        <h3>Añadir comida</h3>

        <form onSubmit={handleSubmit} className="meal-form">
          <select name="dia" value={formData.dia} onChange={handleChange}>
            <option value="lunes">Lunes</option>
            <option value="martes">Martes</option>
            <option value="miercoles">Miércoles</option>
            <option value="jueves">Jueves</option>
            <option value="viernes">Viernes</option>
            <option value="sabado">Sábado</option>
            <option value="domingo">Domingo</option>
          </select>

          <select
            name="tipo_comida"
            value={formData.tipo_comida}
            onChange={handleChange}
          >
            <option value="desayuno">Desayuno</option>
            <option value="almuerzo">Almuerzo</option>
            <option value="comida">Comida</option>
            <option value="merienda">Merienda</option>
            <option value="cena">Cena</option>
          </select>

          <input
            type="time"
            name="hora"
            value={formData.hora}
            onChange={handleChange}
          />

          <button type="submit">Añadir comida</button>
        </form>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && !plan && (
        <div className="card">
          <p>No se ha encontrado el plan semanal.</p>
        </div>
      )}

      {!loading && !error && plan && (
        <div className="grid-cards">
          {plan.meals.length === 0 ? (
            <div className="card">
              <p>No hay comidas en este plan.</p>
            </div>
          ) : (
            plan.meals.map((meal) => (
              <div key={meal.id} className="card">
                <h3>
                  {meal.dia} · {meal.tipo_comida}
                </h3>
                <p>
                  <strong>Hora:</strong> {meal.hora}
                </p>

                {meal.items.length === 0 ? (
                  <p>Sin elementos todavía.</p>
                ) : (
                  <ul className="item-list">
                    {meal.items.map((item) => (
                      <li key={item.id}>
                        <strong>{item.food?.nombre || item.recipe?.nombre}</strong>
                        <span> · cantidad: {item.cantidad}</span>
                        {item.notas ? (
                          <div className="item-note">{item.notas}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}