# Multiespectral Web

Plataforma de visualización multiespectral agrícola. Sube imágenes R y NIR, calcula NDVI en el navegador y visualiza con escala de colores.

## Compartir cubes entre usuarios (cualquiera los ve)

Para que **cualquier persona** que abra la página vea todos los cubes y que las imágenes no desaparezcan:

1. **Configura Supabase** en `.env`:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_anon_key
   ```

2. **Ejecuta el script de acceso público** en Supabase → SQL Editor:
   - Abre `supabase/configurar_acceso_publico.sql`
   - Copia todo el contenido y pégalo en una nueva consulta
   - Ejecuta (Run)

3. Reinicia la app (`npm run dev`).

Con eso, los cubes y las imágenes se guardan en Supabase Storage y la base de datos, y **cualquier visitante** los verá al cargar la página.