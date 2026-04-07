# Multiespectral Web

Plataforma de visualización multiespectral agrícola. Sube imágenes R y NIR, calcula NDVI en el navegador y visualiza con escala de colores.

## Compartir cubes entre usuarios (cualquiera los ve)

Para que **cualquier persona** que abra la página vea todos los cubes y que las imágenes no desaparezcan:

1. **Configura Supabase** en `.env`:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_anon_key
   ```
   El nombre de la segunda variable debe ser exactamente **`VITE_SUPABASE_ANON_KEY`** (termina en **KEY**). Opcional: `VITE_SUPABASE_SPECTRAL_BUCKET=capture_image` si tu bucket en Storage tiene otro nombre.

2. **Ejecuta el script de acceso público** en Supabase → SQL Editor:
   - Abre `supabase/configurar_acceso_publico.sql`
   - Copia todo el contenido y pégalo en una nueva consulta
   - Ejecuta (Run)

3. Reinicia la app (`npm run dev`).

Con eso, los cubes y las imágenes se guardan en Supabase Storage y la base de datos, y **cualquier visitante** los verá al cargar la página.

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