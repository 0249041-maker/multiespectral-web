# Multiespectral Web

Plataforma web de visualización multiespectral agrícola: sube bandas R y NIR, calcula índices (por ejemplo NDVI) en el navegador y visualízalos con escala de colores. Incluye modo avanzado con cubos espectrales, composiciones RGB y sincronización opcional con **Supabase** para que los datos se compartan entre visitantes.

## Características

- Panel principal con flujo de trabajo espectral y vista tipo dashboard.
- Cálculo de NDVI y visualización con paletas; composiciones espectrales y paneles avanzados.
- Detección asistida (modelo en el cliente con **ONNX Runtime**).
- Almacenamiento local y, si configuras Supabase, **cubos e imágenes compartidos** para todos los usuarios.

## Stack

| Área        | Tecnología                          |
| ----------- | ----------------------------------- |
| UI          | React 18, Tailwind CSS              |
| Build       | Vite 6, `@vitejs/plugin-react-swc`  |
| Backend SaaS| Supabase (Auth anónima + Storage)   |
| ML en cliente | ONNX Runtime Web                 |

## Requisitos

- **Node.js** 18+ recomendado  
- Cuenta **Supabase** solo si quieres datos compartidos en la nube (opcional para desarrollo local puro)

## Inicio rápido

```bash
git clone <URL-de-tu-repo-en-GitHub>
cd mi-proyecto-web   # o el nombre de carpeta que te dé el clone
npm install
```

Crea un archivo `.env` en la raíz del proyecto **solo si** vas a usar Supabase (ver tabla más abajo). Luego:

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173).

### Scripts npm

| Comando        | Descripción                          |
| -------------- | ------------------------------------ |
| `npm run dev`  | Servidor de desarrollo (Vite)        |
| `npm run build`| Build de producción en `dist/`       |
| `npm run preview` | Sirve el build localmente (prueba) |

## Variables de entorno (Vite)

Vite solo expone variables que empiezan por `VITE_`. Nombres que usa la app:

| Variable | Uso |
| -------- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase (`https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima pública (el nombre debe terminar en **`KEY`**) |
| `VITE_SUPABASE_SPECTRAL_BUCKET` | *(Opcional)* Nombre del bucket en Storage; por defecto se usa el configurado en código si no lo pones |

Sin estas variables, la app funciona en modo **solo este navegador** (datos locales).

---

## Compartir cubes entre usuarios (cualquiera los ve)

Para que **cualquier persona** que abra la página vea todos los cubes y que las imágenes no desaparezcan:

1. **Configura Supabase** en `.env`:

   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_anon_key
   ```

   El nombre de la segunda variable debe ser exactamente **`VITE_SUPABASE_ANON_KEY`** (termina en **KEY**). Opcional: `VITE_SUPABASE_SPECTRAL_BUCKET=capture_image` si tu bucket en Storage tiene otro nombre.

2. **Ejecuta el script de acceso público** en Supabase → SQL Editor:

   - Abre [`supabase/configurar_acceso_publico.sql`](supabase/configurar_acceso_publico.sql)
   - Copia todo el contenido y pégalo en una nueva consulta
   - Ejecuta (Run)

3. Reinicia la app (`npm run dev`).

Con eso, los cubes y las imágenes se guardan en Supabase Storage y la base de datos, y **cualquier visitante** los verá al cargar la página.

---

## Vercel (muy importante)

El `.env` de tu computadora **no** llega a Vercel. Si no configuras variables ahí, la web publicada **no tendrá Supabase** y verás el aviso de “solo este navegador”.

1. Entra a [vercel.com](https://vercel.com) → tu proyecto → **Settings** → **Environment Variables**.
2. Añade exactamente estos nombres (Vite los necesita con el prefijo `VITE_`):

   | Nombre | Valor |
   |--------|--------|
   | `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | tu anon key (nombre exacto, con **KEY** al final) |

3. Marca al menos **Production** (y Preview si quieres).
4. Ve a **Deployments** → en el último deploy, menú **⋯** → **Redeploy** (sin usar caché si quieres forzar).

Sin el redeploy, el build sigue sin esas variables y la página seguirá igual que antes.

---

## Estructura del repo (resumen)

```
mi-proyecto-web/
├── src/                 # React: páginas, componentes, librerías espectrales
├── supabase/            # SQL (acceso público, migraciones opcionales)
├── index.html
├── vite.config.js
└── package.json
```
