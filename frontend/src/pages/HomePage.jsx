export default function HomePage() {
  return (
    <div className="page">
      <h2>Inicio</h2>

      <div className="hero-card">
        <h3>Bienvenido a BodyFuel</h3>
        <p>
          Gestiona alimentos, recetas y tu planificación semanal desde una sola
          aplicación.
        </p>
      </div>

      <div className="grid-cards">
        <div className="card">
          <h3>Alimentos</h3>
          <p>Consulta calorías y macronutrientes de cada alimento.</p>
        </div>

        <div className="card">
          <h3>Recetas</h3>
          <p>Guarda recetas saludables y clasifícalas por tipo de dieta.</p>
        </div>

        <div className="card">
          <h3>Plan semanal</h3>
          <p>Organiza tus comidas por día y horario.</p>
        </div>

        <div className="card">
          <h3>Seguimiento</h3>
          <p>Más adelante añadiremos edición y registro desde el frontend.</p>
        </div>
      </div>
    </div>
  );
}