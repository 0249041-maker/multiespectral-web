# Multiespectral Web

Plataforma web para trabajo espectral agrícola: sube bandas espectrales (450, 550, 656, 725, 850), calcula índices en el navegador (NDVI, GNDVI, CI_re, SIPI, VARI, etc.), visualízalos con escalas de color y usa **modo avanzado** con cubos multiespectrales (hasta cinco bandas alineadas). Opcionalmente sincroniza datos con **Supabase** para que cubes e imágenes se compartan entre visitantes.

Repositorio: [0249041-maker/multiespectral-web](https://github.com/0249041-maker/multiespectral-web).

## Características

- Panel principal con flujo espectral y vistas tipo dashboard.
- **Cubos espectrales**: bandas R, G, B, RE y NIR alineadas; composiciones RGB natural / multiespectral.
- Cálculo de índices en cliente y visualización con paletas (GNDVI, CI_re, SIPI, VARI, NDVI, etc.).
- **Detección de fresas** en el cliente con modelo ONNX (**ONNX Runtime Web**).
- **Madurez estimada** por índices espectrales según tabla GNDVI / CI_re (ver abajo); umbrales ajustables en modo avanzado y persistencia opcional en `localStorage`.
- Almacenamiento local (IndexedDB) y, si configuras Supabase, **cubos e imágenes compartidos** entre usuarios.

## Clasificación de madurez (fresa)

La app clasifica cada detección usando una **tabla de verdad** con la media de **GNDVI** y **CI_re** (`CIre = NIR/RE − 1`) dentro del recorte del fruto:

| GNDVI | CI_re | Estado      |
| ----- | ----- | ----------- |
| Bajo  | Bajo  | Inmadura    |
| Alto  | Bajo  | Madura      |
| Alto  | Alto  | Sobremadura |

“Alto” se define respecto a umbrales configurables (por defecto: **GNDVI ≥ 0.6**, **CI_re ≥ 0.3**). Hay una **regla graduada** alrededor de cada umbral (`gndviTransitionWidth`, `cireTransitionWidth`) para suavizar el paso entre clases cerca del corte.

Implementación: `src/lib/strawberryMaturity.js`. En **Modo avanzado** puedes editar estos valores y restablecer los predeterminados.

## Stack

| Área          | Tecnología                         |
| ------------- | ---------------------------------- |
| UI            | React 18, Tailwind CSS             |
| Build         | Vite 6, `@vitejs/plugin-react-swc` |
| Backend SaaS  | Supabase (anon + Storage)          |
| ML en cliente | ONNX Runtime Web                   |

## Requisitos

- **Node.js** 18 o superior recomendado.
- **Supabase** solo si quieres datos compartidos en la nube (opcional para uso 100 % local).

## Inicio rápido

```bash
git clone https://github.com/0249041-maker/multiespectral-web.git
cd multiespectral-web
npm install
```

Crea un archivo `.env` en la raíz **solo si** vas a usar Supabase (ver tabla más abajo). Luego:

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173).

### Scripts npm

| Comando           | Descripción                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Servidor de desarrollo (Vite)        |
| `npm run build`   | Build de producción en `dist/`       |
| `npm run preview` | Sirve el build localmente (prueba)   |

## Variables de entorno (Vite)

Solo se exponen variables con prefijo `VITE_`:

| Variable                      | Uso |
| ----------------------------- | --- |
| `VITE_SUPABASE_URL`           | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY`      | Clave anónima pública (nombre debe terminar en **`KEY`**) |
| `VITE_SUPABASE_SPECTRAL_BUCKET` | *(Opcional)* Bucket de Storage; si no se define, usa el valor por defecto del código |

Sin estas variables, la app funciona en modo **solo este navegador**.

---

## Compartir cubes entre usuarios

Para que cualquier visitante vea los mismos cubes e imágenes:

1. Configura Supabase en `.env`:

   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_anon_key
   ```

   Opcional: `VITE_SUPABASE_SPECTRAL_BUCKET=capture_image` si tu bucket tiene otro nombre.

2. En Supabase → SQL Editor, ejecuta el script [`supabase/configurar_acceso_publico.sql`](supabase/configurar_acceso_publico.sql).

3. Reinicia la app (`npm run dev`).

---

## Vercel

El `.env` local **no** se sube a Vercel. Configura las mismas variables en el proyecto → **Settings** → **Environment Variables** (al menos **Production**), luego **Redeploy** para que el build las incluya.

---

## Estructura del repositorio (resumen)

```
multiespectral-web/
├── src/
│   ├── lib/                    # Cálculos espectrales, madurez, Supabase
│   │   └── strawberryMaturity.js
│   ├── pages/                  # Vistas (p. ej. modo avanzado)
│   └── components/
├── supabase/                   # SQL de políticas y acceso público
├── index.html
├── vite.config.js
└── package.json
```
