# Modelo de Base de Datos - NutriPlan

## Resumen General

Base de datos relacional para la aplicación **NutriPlan**, orientada a gestión de dietas, planificación semanal y seguimiento nutricional.

---

# Diagrama de Relaciones (resumen)

* Un **usuario** tiene muchos **planes semanales**.
* Un **usuario** tiene muchos **registros de seguimiento**.
* Un **plan semanal** tiene muchas **comidas**.
* Una **comida** tiene muchos **elementos de comida**.
* Un **elemento de comida** puede referenciar un **alimento** o una **receta**.

---

# Tablas

## 1. users

Guarda la información principal del usuario.

| Campo             | Tipo         | Descripción               |
| ----------------- | ------------ | ------------------------- |
| id                | INTEGER PK   | Identificador único       |
| nombre            | VARCHAR(100) | Nombre del usuario        |
| edad              | INTEGER      | Edad                      |
| peso              | DECIMAL(5,2) | Peso actual en kg         |
| altura            | DECIMAL(5,2) | Altura en cm              |
| objetivo          | VARCHAR(30)  | perder / ganar / mantener |
| calorias_objetivo | INTEGER      | Meta diaria de calorías   |

### Relaciones

* 1:N con `weekly_plans`
* 1:N con `tracking`

---

## 2. foods

Alimentos individuales con datos nutricionales.

| Campo     | Tipo         | Descripción             |
| --------- | ------------ | ----------------------- |
| id        | INTEGER PK   | Identificador           |
| nombre    | VARCHAR(150) | Nombre del alimento     |
| calorias  | DECIMAL(8,2) | kcal por ración         |
| proteinas | DECIMAL(8,2) | gramos                  |
| carbos    | DECIMAL(8,2) | gramos                  |
| grasas    | DECIMAL(8,2) | gramos                  |
| fuente    | VARCHAR(100) | manual / API / scraping |

### Relaciones

* 1:N con `meal_items`

---

## 3. recipes

Recetas completas importadas o creadas manualmente.

| Campo              | Tipo         | Descripción             |
| ------------------ | ------------ | ----------------------- |
| id                 | INTEGER PK   | Identificador           |
| nombre             | VARCHAR(150) | Nombre receta           |
| ingredientes       | TEXT         | Lista ingredientes      |
| calorias_totales   | DECIMAL(8,2) | kcal totales            |
| tiempo_preparacion | INTEGER      | Minutos                 |
| tipo_dieta         | VARCHAR(50)  | vegano, keto, etc       |
| fuente_url         | TEXT         | URL original            |
| origen             | VARCHAR(50)  | scraping / manual / API |

### Relaciones

* 1:N con `meal_items`

---

## 4. weekly_plans

Plan semanal de un usuario.

| Campo         | Tipo       | Descripción         |
| ------------- | ---------- | ------------------- |
| id            | INTEGER PK | Identificador       |
| user_id       | INTEGER FK | Usuario propietario |
| semana_inicio | DATE       | Fecha inicio semana |

### Relaciones

* N:1 con `users`
* 1:N con `meals`

---

## 5. meals

Comidas planificadas dentro de una semana.

| Campo          | Tipo        | Descripción                                |
| -------------- | ----------- | ------------------------------------------ |
| id             | INTEGER PK  | Identificador                              |
| weekly_plan_id | INTEGER FK  | Plan semanal                               |
| dia            | VARCHAR(15) | lunes, martes...                           |
| tipo_comida    | VARCHAR(30) | desayuno, almuerzo, comida, merienda, cena |
| hora           | TIME        | Hora programada                            |

### Relaciones

* N:1 con `weekly_plans`
* 1:N con `meal_items`

---

## 6. meal_items

Elementos dentro de una comida (alimento o receta).

| Campo     | Tipo            | Descripción       |
| --------- | --------------- | ----------------- |
| id        | INTEGER PK      | Identificador     |
| meal_id   | INTEGER FK      | Comida asociada   |
| food_id   | INTEGER FK NULL | Alimento asociado |
| recipe_id | INTEGER FK NULL | Receta asociada   |
| cantidad  | DECIMAL(8,2)    | Cantidad/ración   |
| notas     | TEXT            | Comentarios       |

### Reglas

* `food_id` o `recipe_id` debe tener valor.
* Ambos pueden no usarse simultáneamente según diseño.

### Relaciones

* N:1 con `meals`
* N:1 con `foods`
* N:1 con `recipes`

---

## 7. tracking

Histórico de progreso del usuario.

| Campo               | Tipo         | Descripción      |
| ------------------- | ------------ | ---------------- |
| id                  | INTEGER PK   | Identificador    |
| user_id             | INTEGER FK   | Usuario          |
| fecha               | DATE         | Día del registro |
| peso                | DECIMAL(5,2) | Peso kg          |
| calorias_consumidas | INTEGER      | kcal consumidas  |

### Relaciones

* N:1 con `users`

---

# Relaciones SQL resumidas

```text
users (1) -------- (N) weekly_plans
users (1) -------- (N) tracking
weekly_plans (1) - (N) meals
meals (1) ------- (N) meal_items
foods (1) ------- (N) meal_items
recipes (1) ----- (N) meal_items
```

---

# Orden recomendado de creación de tablas

1. users
2. foods
3. recipes
4. weekly_plans
5. meals
6. meal_items
7. tracking

---

# Observaciones Técnicas

* Base de datos recomendada: PostgreSQL.
* Añadir índices en claves foráneas.
* Añadir índice por `nombre` en `foods` y `recipes`.
* Añadir restricción única `(user_id, semana_inicio)` en `weekly_plans`.
* Añadir restricción única `(user_id, fecha)` opcional en `tracking`.
