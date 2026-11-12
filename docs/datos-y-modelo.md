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

`schema.sql` define una base nueva llamada **gastronomia_turistica_academica**, con 22 tablas, sin planes y con experiencias gastronómicas. `database/demo-inicial.sql` contiene esa estructura más la semilla. Puede ejecutarse desde MySQL Workbench o el cliente MySQL, sin usar ni borrar `gastronomia_turistica_db`. Una base anterior necesita las migraciones correspondientes: [sin planes](Cambio_sin_planes.md), asesoría y [experiencias](Experiencias_gastronomicas.md); repetir CREATE TABLE IF NOT EXISTS no cambia columnas existentes.

En la configuración local, usar `DB_NAME=gastronomia_turistica_academica`. La conexión MySQL requiere un servidor iniciado y permisos para crear esa base. La carga no se ha de confundir con la vista de demostración del navegador.

Los `CREATE TABLE IF NOT EXISTS` y `INSERT IGNORE` permiten repetir el mismo archivo sin duplicar los identificadores de la semilla. **Repetirlo no refresca las fechas ni sobrescribe cambios existentes.** La adaptación sin planes conserva los identificadores del archivo anterior; una regeneración completa puede asignar identificadores distintos. Usar semillas regeneradas únicamente en una base vacía; no mezclarlas con datos existentes, aunque compartan fecha de corte. Para otra base, ajustar `CREATE DATABASE`/`USE` y la configuración. Después de importar, revisar los avisos de MySQL y los conteos de tablas. No se incluyen comandos de borrado automático en la carga.

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

## Reglas del modelo vigente — 10 de noviembre de 2026

Por decisión del grupo se retiran las suscripciones. La revisión del 11 de noviembre tiene **22 tablas principales y 31 claves foráneas**, incluidas **Visita**, **AccesoSistema**, **Experiencia** y **ReservaExperiencia**. Se ajustaron los archivos nativos de EERCASE y Oracle Data Modeler y se contrastaron con la base. Las exportaciones revisadas están en [modelo entidad–relación](modelos/Modelo_entidad_relacion.jpg) y [modelo relacional](modelos/Modelo_relacional.pdf). El borrador de Word aún debe incorporar las experiencias en la etapa de entrega final.

1. `Visita` pertenece a un Restaurante; puede corresponder a una Reserva y a un Usuario. Solo se registra una visita por reserva. Debe validar que las mesas reservadas pertenezcan al restaurante, que la fecha coincida y que los asistentes no excedan la capacidad conjunta. El aplicativo debe hacer esta validación además de las FK.
2. `AccesoSistema` pertenece a un Usuario y registra fecha y hora en Colombia.
3. Un Restaurante pertenece a una Zona y a un Propietario. No necesita membresía para recibir reservas o pedidos.
4. Un Pago corresponde **obligatoriamente a un Pedido** mediante `pagos.id_pedido NOT NULL`. Un pedido puede tener varios pagos; se conserva la relación ABONA del conceptual. El cliente del pago debe coincidir con el del pedido y el medio de pago debe existir. Los abonos aprobados no pueden superar el total del pedido. Si se reintenta un pago con la misma referencia y los mismos datos se devuelve el pago registrado. Los pagos siguen siendo una simulación académica, sin cobro por pasarela externa.
5. Se conservan las unicidades `(id_restaurante,numero_mesa)` y `(id_usuario,id_restaurante)` en Reseña. Son decisiones de negocio que se deben confirmar con la profesora.
6. Cada Pedido debe contener detalle del mismo Restaurante y su total debe coincidir con la suma de cantidad por precio. La aplicación calcula el total con los precios del menú.
7. Municipio tiene una relación de uno a muchos con Zona. Restaurante guarda su dirección y Mesa conserva el sector dentro del restaurante.
8. Las reservas tienen al menos una mesa. La pareja de claves en `reserva_mesas` impide asignaciones repetidas. Las mesas deben pertenecer al mismo restaurante. Las reservas pendientes o confirmadas bloquean su horario durante dos horas.
9. Tipo de servicio, estado de pedido y estado de reserva son catálogos. Los estados se administran mediante sus flujos respectivos.

Las horas `DATETIME` de las dos tablas de medición se almacenan como hora local de Colombia. La semilla establece `time_zone='-05:00'` al importar sus columnas `TIMESTAMP` existentes.

Los recordatorios se derivan de las reservas activas de las próximas 24 horas y se guardan en `notificaciones`. La revisión utiliza un bloqueo de la base y comprueba el aviso ya enviado para evitar duplicados. El servidor debe permanecer activo para ejecutarla cada minuto.

## Especialización de Usuario — 11 de noviembre de 2026

El blanco distingue Cliente, PropietarioRestaurante y Administrador como subtipos totales y disjuntos de Usuario. Se conservan en la tabla usuarios mediante tipo_usuario (cliente, restaurante, administrador). Los subtipos heredan id_usuario y no agregan tablas ni claves foráneas. Hay 20 entidades independientes y tres subtipos dibujados; el esquema sigue con 22 tablas principales y 31 FK. Véase [Herencia de Usuario](Herencia_usuarios.md).
