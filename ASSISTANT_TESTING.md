# BodyFuel Assistant - Testing Guide

## Setup and Launch

### 1. Start the application with Docker
```bash
docker-compose up --build
```

This will:
- Start PostgreSQL database
- Start Redis cache
- Build and start the FastAPI backend (port 8000)
- Build and start the React frontend (port 3000)
- Start the scraper service

### 2. Access the application
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### 3. Navigate to Assistant
- Log in or register an account
- Click on "Asistente" in the navigation menu

## Test Cases

### Test 1: Basic Food Query
**Input:** "Qué macros tiene el pollo?"
**Expected:** Returns information about chicken (pechuga de pollo) with calories, protein, carbs, fats per 100g

### Test 2: Gram-Based Query
**Input:** "Macros de 150g de avena"
**Expected:** Returns scaled values:
- Calorias: 583.5 kcal (389 * 150/100)
- Proteinas: 25.4 g (16.9 * 150/100)
- Carbos: 99.5 g (66.3 * 150/100)
- Grasas: 10.4 g (6.9 * 150/100)

### Test 3: Food Comparison
**Input:** "Compara arroz vs quinoa"
**Expected:** Side-by-side comparison of nutritional values

### Test 4: Ranking by Protein
**Input:** "Alimentos con más proteína"
**Expected:** Top foods ranked by protein content

### Test 5: Low Calorie Query
**Input:** "Qué alimentos tienen menos calorías"
**Expected:** Foods ranked by calorie content (lowest first)

### Test 6: Recipe Query
**Input:** "Dame recetas"
**Expected:** Suggestions for available recipes

### Test 7: Specific Metric Query
**Input:** "Cuántas proteínas tiene el huevo"
**Expected:** Focused answer with just protein value (13.0g per 100g)

## Database Content

The assistant now has access to 100+ foods organized by category:
- **Cereals**: Avena, Arroz blanco, Arroz integral, Pasta, Pan, etc.
- **Meats**: Pollo, Res, Cerdo, Pavo, Cordero
- **Fish**: Salmón, Atún, Trucha, Bacalao, Merluza, etc.
- **Eggs**: Huevo entero, Claras, Yema
- **Dairy**: Yogur, Queso, Leche
- **Fruits**: Plátano, Manzana, Naranja, Fresas, etc.
- **Vegetables**: Brócoli, Tomate, Pepino, Lechuga, etc.
- **Legumes**: Lentejas, Garbanzos, Judías, Soja
- **Nuts**: Almendras, Avellanas, Cacahuetes, Pistachos, etc.
- **Fats**: Aceites, Mantequilla, Aguacate

## Troubleshooting

### Assistant returns "no data" error
- Check that Docker containers are running
- Verify database has been populated (check with postgres client)
- Check backend logs: `docker logs bodyfuel_backend`

### Slow responses
- Backend is querying the database - this is normal
- If using external LLM (GPT API), it may add latency
- Check `LLM_API_URL` and `LLM_API_KEY` environment variables

### Foods not found
- Ensure search term matches food name
- Try shorter queries
- Use Spanish food names (e.g., "pollo" not "chicken")

## API Endpoints

### Get Foods
```
GET /foods/?nombre=pollo
```

### Chat with Assistant
```
POST /assistant/chat
{
  "message": "Macros de 150g de avena",
  "user_id": 1,
  "max_results": 5
}
```

### Get History
```
GET /assistant/history/1?limit=50
```

### Clear History
```
DELETE /assistant/history/1
```

## Features Implemented

✅ Natural language query processing
✅ Multiple query type detection (grams, comparison, ranking, etc.)
✅ Macro scaling calculations
✅ Food name matching with fuzzy search
✅ Chat history per user
✅ Support for external LLM integration
✅ Fallback responses with suggestions
✅ Recipe recommendations
