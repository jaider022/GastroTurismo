# Datos, asistencia e ingresos a la aplicación

La aplicación incorpora datos **ficticios y coherentes** para pruebas académicas: nombres completos, teléfonos de diez dígitos, restaurantes de ejemplo del Quindío, reservas, pedidos y pagos. Los correos usan el dominio reservado `.example`. No son registros de clientes reales.

## Generación reproducible

Desde la carpeta del proyecto:

```powershell
node scripts/generar-datos.js --fecha=2026-10-27
node --test tests/dataset.test.js
```

Sin `--fecha`, toma la fecha actual de Colombia. La misma fecha siempre produce los mismos registros. Incluye los dos meses anteriores completos, el mes actual hasta el día indicado y doce reservas futuras para practicar. No genera asistencias ni accesos posteriores al corte.

El comando produce `public/demo-data.json`, `database/seed.sql` y `database/demo-inicial.sql`. No se conecta a MySQL ni altera la base existente.

## Base MySQL separada

`schema.sql` define una base nueva llamada **gastronomia_turistica_academica**, con 20 tablas (versión 3: experiencias, inscripciones_experiencia, suscripciones y recordatorios). `database/demo-inicial.sql` contiene esa estructura más la semilla. Puede ejecutarse desde MySQL Workbench o el cliente MySQL, sin usar ni borrar `gastronomia_turistica_db`.

En la configuración local, usar `DB_NAME=gastronomia_turistica_academica`. La conexión MySQL requiere un servidor iniciado y permisos para crear esa base. La carga no se ha de confundir con la vista de demostración del navegador.

Los `CREATE TABLE IF NOT EXISTS` y `INSERT IGNORE` permiten repetir el mismo archivo sin duplicar los identificadores de la semilla. **Repetirlo no refresca las fechas ni sobrescribe cambios existentes.** Para una nueva fecha de semilla, generar otra base académica vacía, con nombre distinto, y ajustar `CREATE DATABASE`/`USE`; no mezclar semillas de fechas diferentes en la misma base. Después de importar, revisar los avisos de MySQL y los conteos de tablas. No se incluyen comandos de borrado automático.

Credenciales exclusivamente de demostración:

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | admin@gastroturismo.example | Gastro2026! |
| Restaurante | restaurante@gastroturismo.example | Gastro2026! |
| Cliente | cliente@gastroturismo.example | Gastro2026! |

## Qué se cuenta

- **Comensales atendidos:** suma de `visitas.cantidad_personas` por fecha de ingreso. Una reserva cancelada o una persona esperada no cuenta como asistencia. Admite llegadas sin reserva, con `id_reserva` nulo. No es un conteo de personas físicas únicas; una misma persona puede asistir varias veces.
- **Ingresos a la aplicación:** cada acceso autenticado exitoso genera una fila en `accesos_sistema`. Se distinguen cantidad de accesos y usuarios diferentes. Abrir la página, fallar la contraseña o recargar la vista no equivale a un acceso exitoso nuevo.
- El mes anterior completo y el mes actual a la fecha tienen distinta duración. El reporte debe identificar los periodos y ofrecer comparación al mismo día cuando se quiera medir evolución.

## Ajustes que deben trasladarse a los diagramas

El esquema inicial tenía 14 tablas. Los nuevos requisitos necesitan **Visita** y **AccesoSistema**, por lo que esta versión tiene **16**. Los diagramas anteriores no incluyen aún estas dos tablas y deben actualizarse en una sesión de modelado posterior; no se han modificado silenciosamente.

1. `Visita` pertenece a un Restaurante; puede corresponder a una Reserva y a un Usuario. Solo se registra una visita por reserva. Debe validar que la mesa reservada pertenezca al restaurante, que la fecha coincida y que los asistentes no excedan la capacidad. El aplicativo debe hacer esta validación además de las FK.
2. `AccesoSistema` pertenece a un Usuario y registra fecha y hora en Colombia.
3. Se adopta temporalmente la regla del PDF relacional: todo Restaurante tiene Plan. `restaurantes.id_plan` es obligatorio y no se borra un plan referenciado.
4. Un Pago corresponde **a un Pedido o a un Plan, exclusivamente**. Ambas FK permiten nulo individualmente, pero un `CHECK` exige exactamente una. Al mantener históricos de pagos no se borra el pedido o plan referenciado. Esta regla debe alinearse con el conceptual.
5. Se conservan las unicidades `(id_restaurante,numero_mesa)` y `(id_usuario,id_restaurante)` en Reseña. Son decisiones de negocio que se deben confirmar con la profesora.
6. Cada Pedido debe contener detalle del mismo Restaurante y su total debe coincidir con la suma de cantidad por precio. La semilla lo verifica; la aplicación debe validarlo en sus transacciones.

Las horas `DATETIME` de las dos tablas de medición se almacenan como hora local de Colombia. La semilla establece `time_zone='-05:00'` al importar sus columnas `TIMESTAMP` existentes.

## Versión 3: cuatro tablas nuevas

7. `Experiencia` pertenece a un Restaurante; `Inscripcion` une Usuario (cliente) y Experiencia, una por pareja. La suma de personas no canceladas no supera `cupo_maximo` (se valida con bloqueo en transacción).
8. `Pago` corresponde exactamente a uno de: Pedido, Plan o Inscripción (`CHECK` con suma de condiciones). Las FK de concepto usan `ON UPDATE RESTRICT` porque MySQL 8 no admite `CHECK` sobre columnas con acciones en cascada.
9. `Suscripcion` registra el plan contratado por un Restaurante con `fecha_inicio`/`fecha_fin` y el pago que la respalda (nulo para el plan Básico gratuito). `restaurantes.id_plan` guarda el plan vigente y vuelve a Básico al vencer.
10. `Recordatorio` pertenece a un Usuario y opcionalmente a una Reserva, Inscripción o Suscripción. Al llegar `fecha_programada` se crea una Notificación y queda `enviado = TRUE`.
