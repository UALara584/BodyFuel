# 📱 BodyFuel - Guía Simplificada

## ¿Qué es BodyFuel?

BodyFuel es una **aplicación web de gestión nutricional** que te ayuda a controlar tu alimentación. Permite crear planes de comidas, buscar información de alimentos, seguir recetas saludables y conectar con amigos.

---

## 🏗️ Arquitectura General

La aplicación está dividida en **4 componentes principales**:

### 1. **Frontend (React + Vite)**
- Interfaz de usuario interactiva
- Ubicación: `frontend/`
- Puerto: 3000
- Tecnología: React (JavaScript moderno), Vite (empaquetador rápido)

### 2. **Backend (FastAPI + Python)**
- API REST que gestiona datos
- Ubicación: `backend/`
- Puerto: 8000
- Tecnología: FastAPI (framework web rápido para Python)

### 3. **Base de Datos (PostgreSQL)**
- Almacena usuarios, alimentos, comidas, recetas, planes
- Puerto: 5432
- Volumen persistente para mantener datos entre reinicios

### 4. **Servicios Adicionales**
- **Redis**: Caché para mejorar velocidad
- **Scraper de Vitonica**: Descarga automáticamente recetas de vitonica.com

---

## 🔄 Cómo Funciona

```
┌─────────────┐
│   Frontend  │  (Lo que ves en el navegador)
│  (React)    │
└──────┬──────┘
       │ HTTP Requests
       ▼
┌─────────────┐      ┌──────────────┐
│   Backend   │◄────►│   PostgreSQL │
│  (FastAPI)  │      │  (Datos)     │
└──────┬──────┘      └──────────────┘
       │
       ├──► Edamam API (Búsqueda de alimentos)
       │
       └──► Redis (Caché)
```

### Flujo de uso:
1. **Usuario ingresa a la app** → El navegador carga el frontend
2. **Usuario busca alimentos** → Frontend envía solicitud al backend
3. **Backend consulta**:
   - Base de datos local (si existen)
   - API externa de Edamam (si no están en BD)
4. **Backend devuelve resultados** → Frontend los muestra
5. **Usuario crea plan** → Se guarda en la BD

---

## 📋 Componentes Principales

### **Frontend** (`frontend/src/`)
| Página | Función |
|--------|---------|
| `HomePage.jsx` | Inicio y dashboard |
| `FoodsPage.jsx` | Buscar y gestionar alimentos |
| `RecipesPage.jsx` | Ver recetas saludables |
| `PlanPage.jsx` | Crear planes de comida |
| `ChatsPage.jsx` | Mensajería entre usuarios |
| `FriendsPage.jsx` | Gestionar amigos |
| `ProfilePage.jsx` | Perfil de usuario |
| `ProgressPage.jsx` | Ver progreso nutricional |

### **Backend** (`backend/app/`)
| Ruta | Función |
|-----|---------|
| `/users/` | Gestión de usuarios (login, registro) |
| `/foods/` | Crear, editar, eliminar alimentos |
| `/external-foods/` | Búsqueda en API externa (Edamam) |
| `/meals/` | Gestión de comidas |
| `/recipes/` | Catálogo de recetas |
| `/plans/` | Planes de comida semanales |
| `/chats/` | Sistema de mensajería |
| `/friends/` | Gestión de amistades |

---

## 🛠️ Tecnologías Utilizadas

### **Frontend**
- React 18
- Vite (empaquetador)
- ESLint (control de calidad)

### **Backend**
- FastAPI (framework web)
- SQLAlchemy (ORM para BD)
- Pydantic (validación de datos)

### **Base de Datos**
- PostgreSQL 15
- SQLAlchemy ORM

### **Servicios Externos**
- **Edamam Food API**: Búsqueda de información nutricional de alimentos
- **Vitonica.com**: Scraping automático de recetas saludables

### **Infraestructura**
- Docker & Docker Compose (contenedores)
- Redis (caché)

---

## 📦 APIs Externas

### **Edamam Food API**
- **Propósito**: Obtener información nutricional completa de alimentos
- **Datos que proporciona**: 
  - Calorías
  - Proteínas, carbohidratos, grasas
  - Categoría del alimento
  - Imágenes
- **Configuración**: Variables de entorno en `.env`
  ```
  EDAMAM_APP_ID=tu_id
  EDAMAM_APP_KEY=tu_key
  ```

### **Web Scraping (Vitonica)**
- **Propósito**: Recolectar recetas saludables automáticamente
- **Fuente**: https://www.vitonica.com/categoria/recetas-saludables/
- **Frecuencia**: Se ejecuta automáticamente en el contenedor Docker
- **Datos extraídos**:
  - Nombre de receta
  - Ingredientes
  - Instrucciones
  - Tipo de dieta (keto, vegana, etc.)

---

## 🚀 Características Principales

✅ **Gestión de alimentos**
- Crear alimentos personalizados
- Importar desde API externa (Edamam)
- Marcar favoritos
- Buscar por nombre

✅ **Planes de comida**
- Crear planes semanales
- Asignar alimentos a comidas
- Calcular macros automáticamente

✅ **Recetas**
- Ver recetas recopiladas automáticamente
- Filtrar por tipo de dieta
- Ver ingredientes y modo de preparación

✅ **Red social**
- Conectar con otros usuarios
- Enviar mensajes privados
- Ver progreso de amigos

✅ **Seguimiento**
- Ver progreso nutricional
- Gráficas de consumo
- Historial de comidas

---

## 🐳 Cómo Ejecutar la Aplicación

### **Requisitos previos**
- Docker y Docker Compose instalados
- Credenciales de Edamam (ver sección de configuración)

### **Pasos**

1. **Configurar variables de entorno**
   ```bash
   # Ir a la raíz del proyecto
   cd BodyFuel
   
   # Crear archivo .env con:
   POSTGRES_USER=bodyfuel
   POSTGRES_PASSWORD=bodyfuel
   POSTGRES_DB=bodyfuel
   EDAMAM_APP_ID=tu_id_real
   EDAMAM_APP_KEY=tu_key_real
   LLM_API_KEY=tu_key_si_usas_llm
   VITE_API_BASE_URL=http://localhost:8000
   ```

2. **Iniciar la aplicación**
   ```bash
   docker-compose up --build
   ```

3. **Acceder**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - Docs API: http://localhost:8000/docs

4. **Detener**
   ```bash
   docker-compose down
   ```

---

## 📊 Estructura de Base de Datos

```
┌─────────────────────────────────────┐
│          PostgreSQL BD              │
├─────────────────────────────────────┤
│ • users        (Usuarios)           │
│ • foods        (Alimentos)          │
│ • meals        (Comidas)            │
│ • meal_items   (Items en comidas)   │
│ • recipes      (Recetas)            │
│ • weekly_plans (Planes semanales)   │
│ • friendships  (Amistades)          │
│ • chats        (Conversaciones)     │
│ • messages     (Mensajes)           │
└─────────────────────────────────────┘
```

---

## 🔑 Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `POSTGRES_USER` | Usuario de BD |
| `POSTGRES_PASSWORD` | Contraseña de BD |
| `POSTGRES_DB` | Nombre de la BD |
| `EDAMAM_APP_ID` | ID de Edamam |
| `EDAMAM_APP_KEY` | API Key de Edamam |
| `LLM_API_URL` | URL de LLM (si usas IA) |
| `LLM_API_KEY` | Key de LLM |
| `VITE_API_BASE_URL` | URL del backend |

---

## 🎯 Resumen

**BodyFuel** es una aplicación completa de gestión nutricional que:
- ✅ Permite buscar alimentos en BD local o API externa
- ✅ Gestiona planes de comidas personalizados
- ✅ Recopila recetas automáticamente de la web
- ✅ Conecta usuarios en una red social
- ✅ Rastrea progreso nutricional
- ✅ Todo empaquetado en Docker para fácil ejecución

**Tecnología**: React + FastAPI + PostgreSQL + Docker

---

**¡Lista para usar! 🚀**
