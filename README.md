# GastroTurismo — Restaurantes y gastronomía turística

Proyecto final de Bases de Datos I, únicamente caso de restaurantes.

El listado vigente de tareas terminadas, parciales y pendientes está en [Seguimiento del proyecto](docs/Seguimiento_proyecto.md). Se actualiza al cerrar cada mejora.

## Ensayar en este equipo

1. Abre esta carpeta en Antigravity.
2. Ejecuta `npm run start:local`, o abre `iniciar.cmd`.
3. Entra en http://localhost:3001.
4. Cuenta: admin@gastroturismo.example. Contraseña de ejemplo: Gastro2026!

También existen cliente@gastroturismo.example y restaurante@gastroturismo.example con la misma contraseña de ejemplo. Son identidades ficticias.

El archivo .env configura la base nueva gastronomia_turistica_academica en3307. Este equipo utiliza MariaDB compatible con MySQL de XAMPP. El iniciador puede encender esa instancia. database/entorno-local.json contiene la ubicación del motor y sus datos en este equipo.

## Avance implementado

- Datos coherentes de agosto a octubre2026: nombres, teléfonos, fechas e importes.
- Las14tablas iniciales y dos adicionales: visitas (asistencia real) y accesos_sistema (ingresos exitosos).
- Registro de asistencia con o sin reserva, validación de restaurante, fecha, capacidad y duplicados.
- Diez reportes originales y dos nuevos: comensales por mes e ingresos/usuarios distintos de la aplicación.
- Corte, comparación de mismos días o mes anterior completo, y filtro de restaurante para comensales.
- Exportación de reportes con criterios; impresión como PDF si faltan bibliotecas externas.
- Sesión mediante cookie, cierre de sesión y protección de contraseñas; migración de claves antiguas al ingresar.
- Pedidos calculados con precios del menú y pagos correspondientes a pedido o plan.
- Vista previa y descarga de comprobantes/facturas comparten los datos consultados y el total registrado del pedido.

## Reproducir

`npm run db:cargar` carga database/demo-inicial.sql en la base académica. Conserva registros existentes; no migra una base antigua.

`npm run datos:generar -- --fecha=2026-10-27` regenera archivos de ejemplo, sin reemplazar automáticamente la base ni el navegador.

`npm test` ejecuta pruebas. Para pruebas reales establece GASTRO_MYSQL_TEST=1 y ejecuta `node --test tests/mysql.integration.test.js`. Solo usa la base académica y elimina sus registros de prueba.

Si MySQL no conecta hay una demostración separada; la fuente se indica en pantalla y en los reportes.

## Pendientes finales

Actualizar diagramas Oracle/EERCASE con visitas, accesos y regla de pagos. Revisar alcance con profesora, permisos por rol y CRUD antiguos, probar plantillas con MySQL y completar la presentación final. Esta versión es un avance funcional comprobado; no significa que toda la entrega esté terminada.

Reglas detalladas: docs/datos-y-modelo.md.
