# Frontend BodyFuel

Aplicacion React + Vite para la interfaz de BodyFuel.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

Por defecto, el frontend llama al backend en `http://localhost:8000`. Puedes cambiarlo con la variable:

```env
VITE_API_BASE_URL=http://localhost:8000
```

En Docker esta variable se define desde `docker-compose.yml`.

## PWA

El frontend incluye `manifest.webmanifest`, iconos y `sw.js` para que BodyFuel se pueda añadir a la pantalla de inicio del movil como aplicacion web instalable.
