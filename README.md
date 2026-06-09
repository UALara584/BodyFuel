# BodyFuel

BodyFuel es una aplicacion web de nutricion para gestionar alimentos, recetas, planificacion semanal, progreso, amistades, chats y asistente nutricional.

## Requisitos

- Docker
- Docker Compose clasico (`docker-compose`) o Docker Compose v2 (`docker compose`)
- Credenciales de Edamam para la busqueda externa de alimentos

## Configuracion

1. Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

En Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

2. Edita `.env` y completa:

```env
EDAMAM_APP_ID=tu_app_id_de_edamam
EDAMAM_APP_KEY=tu_app_key_de_edamam
```

El archivo `.env` esta ignorado por Git para no publicar credenciales.

Deja `VITE_API_BASE_URL` vacio si vas a abrir la app desde otro dispositivo de la misma red, por ejemplo un movil conectado al hotspot. Asi el frontend usara automaticamente el mismo host con el puerto `8000`.

## Ejecucion con Docker

```bash
docker-compose up --build
```

Si tu instalacion usa Compose v2:

```bash
docker compose up --build
```

Servicios principales:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Documentacion FastAPI: http://localhost:8000/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

El servicio `scraper` se ejecuta dentro del compose, espera a que la base de datos este lista y carga recetas externas desde Vitonica.

## Instalacion en movil como app

BodyFuel incluye manifiesto web, iconos y service worker para poder instalarse como PWA cuando se abre desde una URL accesible para el movil.

En Android:

1. Abre la URL de BodyFuel en Chrome.
2. Toca el menu del navegador.
3. Elige `Instalar app` o `Añadir a pantalla de inicio`.

En iPhone:

1. Abre la URL de BodyFuel en Safari.
2. Toca el boton de compartir.
3. Elige `Añadir a pantalla de inicio`.

Nota: para instalarla en el movil, el telefono tiene que poder acceder a la URL donde este publicada la aplicacion. En una entrega local, si la Wi-Fi bloquea conexiones entre dispositivos, hay que publicarla en un hosting o usar una red que permita acceder al ordenador.

## Componentes

- `frontend/`: aplicacion React + Vite.
- `backend/`: API REST con FastAPI y SQLAlchemy.
- `scraper/`: scraper Python con Requests y BeautifulSoup.
- `docker-compose.yml`: orquestacion completa de frontend, backend, base de datos, Redis y scraper.

## Cumplimiento de requisitos del proyecto

| Requisito | Estado |
| --- | --- |
| Dockerfiles para ejecutar componentes | Cumple |
| API externa de terceros | Cumple: Edamam Food Database API |
| Scraping externo | Cumple: recetas desde Vitonica |
| API REST de consulta en backend | Cumple: endpoints `GET` |
| API REST de modificacion en backend | Cumple: endpoints `POST`, `PUT` y `DELETE` |
| Listados en frontend | Cumple |
| Edicion de elementos en frontend | Cumple |
| docker-compose completo | Cumple |

## Flujo rapido de prueba

1. Arranca el proyecto con `docker-compose up --build`.
2. Abre http://localhost:3000.
3. Registra un usuario o inicia sesion.
4. Revisa alimentos y recetas.
5. Busca alimentos externos con Edamam desde la pantalla de alimentos.
6. Edita una receta o el perfil.
7. Comprueba la API en http://localhost:8000/docs.
