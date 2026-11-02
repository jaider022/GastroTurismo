# GastroTurismo — Restaurantes y gastronomía turística

Proyecto final de Bases de Datos I, únicamente caso de restaurantes.

El listado vigente de tareas terminadas, parciales y pendientes está en [Seguimiento del proyecto](docs/Seguimiento_proyecto.md). Se actualiza al cerrar cada mejora.

La clasificación de los diez reportes exigidos y sus criterios de cálculo están en [Reportes académicos](docs/Reportes_academicos.md).

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
- Edición de mesas y administración de platos desde pantalla, con disponibilidad del menú y conservación de platos usados en pedidos.

## Versión 3 — cierre de la entrega (2 de noviembre de 2026)

- **Experiencias gastronómicas** (catas, clases de cocina, tours, maridajes, desayunos): CRUD para propietarios, inscripción con cupo controlado en transacción y **pago en línea** para clientes, cancelación y registro de asistencia.
- **Planes con vigencia**: tabla `suscripciones`; contratar, renovar o cambiar de plan con pago en línea. Al vencer, el restaurante vuelve al plan Básico automáticamente.
- **Recordatorios personalizados**: tabla `recordatorios`; el cliente elige la anticipación de su reserva (24 h, 3 h, 1 h o ninguno) y crea recordatorios propios. El servidor los convierte en notificaciones cada minuto.
- **Reglas en servidor**: reservas sin fechas pasadas, en horario 6:00–22:59, sin exceder la mesa y con una reserva activa por mesa y día; transiciones válidas de reservas y pedidos; pagos que coinciden con el total del pedido.
- **Permisos por rol y propiedad** en restaurantes, mesas, platos, reservas, pedidos, reseñas y experiencias. Los listados de reservas y pedidos se filtran por rol en el servidor.
- 20 tablas en total. Modelos actualizados en `docs/modelos/*_v3.png` (fuente Mermaid `.mmd`).

Para una base existente de 16 tablas: `database/migracion-v3.sql`. Para empezar limpio: `npm run db:recrear` (solo borra `gastronomia_turistica_academica`).

## Reproducir

`npm run db:cargar` carga database/demo-inicial.sql en la base académica. Conserva registros existentes; no migra una base antigua.

`npm run datos:generar -- --fecha=2026-10-27` regenera archivos de ejemplo, sin reemplazar automáticamente la base ni el navegador.

`npm test` ejecuta pruebas. Para pruebas reales establece GASTRO_MYSQL_TEST=1 y ejecuta `node --test tests/mysql.integration.test.js`. Solo usa la base académica y elimina sus registros de prueba.

Si MySQL no conecta hay una demostración separada; la fuente se indica en pantalla y en los reportes.

## Pendientes finales

Ejecutar `npm run db:recrear` y `GASTRO_MYSQL_TEST=1 node --test tests/mysql.integration.test.js` en XAMPP, recorrer la aplicación con los tres roles, trasladar las cuatro entidades nuevas al diagrama de EERCASE si la profesora lo exige en esa herramienta y preparar la sustentación.

Reglas detalladas: docs/datos-y-modelo.md.
