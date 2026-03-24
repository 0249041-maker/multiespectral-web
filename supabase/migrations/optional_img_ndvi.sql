-- Opcional: guardar la URL del PNG de NDVI generado en la app.
-- Ejecuta esto en Supabase → SQL Editor si quieres persistir img_ndvi en la tabla.

alter table capture_images
add column if not exists img_ndvi text;

comment on column capture_images.img_ndvi is 'URL pública (Storage) del mapa NDVI generado en cliente';
