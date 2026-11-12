# Experiencias gastronómicas

Integración del 11 de noviembre de 2026. Corresponde al punto 18 del [seguimiento](Seguimiento_proyecto.md) y al componente de experiencias del caso escogido en la guía de la profesora.

## Cómo probarlo y explicarlo

1. Iniciar la aplicación habitual y entrar con una cuenta de restaurante. En **Experiencias**, publicar una cata o un taller indicando restaurante, descripción, fecha, duración, cupos y precio por persona.
2. Entrar como cliente. Consultar las actividades, filtrar por restaurante o fecha y elegir **Reservar cupos**. La pantalla muestra cuántos quedan y el total para el grupo.
3. Confirmar la cantidad. La reserva queda confirmada y el pago queda para el restaurante. No se solicita tarjeta ni se registra un pago online al reservar.
4. Consultar **Mis cupos reservados**. Se conservan la fecha, las personas y el precio unitario de la reserva. Si el restaurante cambia su tarifa, las reservas anteriores mantienen su importe.
5. Cuando se reciba el dinero en el restaurante, entrar como su propietario y elegir **Registrar pago**. Seleccionar efectivo, datáfono u otro medio presencial del catálogo y confirmar el importe recibido. El cliente podrá consultar el pago, el medio y la fecha.
6. Para demostrar una cancelación, usar una reserva futura que aún no se haya cobrado. Al cancelarla se liberan los cupos y se conserva su historial.

La base habitual conserva las tres actividades anteriores y tiene tres próximas actividades de ejemplo: cata de café, taller de cocina y degustación de chocolate. Las reservas que se hicieron para comprobar el módulo quedaron en la base de revisión y se retiraron al terminar; no se inventaron reservas ni cobros nuevos en la base habitual.

## Reglas implementadas

| Situación | Comportamiento |
|---|---|
| Publicación | Solo administrador o propietario del restaurante; fecha futura, duración de 1 a 1.440 minutos, precio no negativo y cupos dentro de su capacidad. |
| Último cupo solicitado al mismo tiempo | Las escrituras se coordinan mediante una transacción y bloqueo de la actividad. Solo se confirma una reserva si quedan cupos. |
| Reintento de una confirmación | La misma referencia de reserva devuelve el registro existente y no vuelve a descontar cupos. |
| Precio cambiado mientras se confirma | La pantalla envía el precio que mostró. El servidor rechaza un precio desactualizado y solicita actualizar la actividad antes de confirmar. |
| Cambio de fecha con clientes reservados | Se conserva la fecha y duración. Se permite editar otros datos y aumentar cupos sin superar el aforo; no se reduce por debajo de las personas reservadas. |
| Reducción del aforo del restaurante | Se rechaza si deja una experiencia futura con más cupos que el nuevo aforo. Primero debe ajustarse la actividad. |
| Pago recibido | El personal autorizado registra el total de esa reserva y un medio presencial. Se conservan usuario que lo registró, fecha y método. Repetir la misma confirmación no duplica el cobro. |
| Cancelación de una reserva | Antes del inicio y sin cobro registrado; libera cupos y notifica al cliente. |
| Cancelación de una actividad | Cancela sus reservas no cobradas y notifica. Se bloquea si hay reservas cobradas. |
| Reserva cobrada | Se conserva el registro. La devolución de dinero se atiende en el restaurante; el módulo no implementa reembolsos ni abonos parciales de experiencias. |
| Actividad gratuita | Se presenta como actividad sin costo y no se muestra el botón de recibir dinero. |
| Consultas privadas | El cliente ve sus reservas; el propietario, las de sus restaurantes; el administrador puede consultar el conjunto. El catálogo público no expone datos de clientes. |

Las actividades controlan sus propios cupos. Reservar una experiencia no asigna una mesa ni genera asistencia automáticamente. La asistencia real sigue registrándose cuando las personas llegan. Confirmar con la profesora si desea compartir el aforo por horario entre experiencias y servicio de mesas; esa regla conjunta no se implementó en esta etapa.

## Correspondencia con los modelos y la base

| Entidad / tabla | Qué representa |
|---|---|
| Experiencia / `experiencias` | Una actividad programada por un restaurante, con fecha, duración, cupos, tarifa y estado. |
| ReservaExperiencia / `reservas_experiencias` | Cupos reservados por un usuario para una actividad; guarda cantidad, precio confirmado, estado, referencia y datos del pago presencial. |
| Restaurante → Experiencia | Un restaurante publica muchas actividades; cada actividad pertenece a un restaurante. |
| Usuario → ReservaExperiencia | Un usuario puede hacer varias reservas de cupos. |
| Experiencia → ReservaExperiencia | Una actividad puede recibir varias reservas hasta completar sus cupos. |
| MetodoPago → ReservaExperiencia | Medio usado al recibir el pago; queda vacío mientras no exista cobro. |
| Usuario → ReservaExperiencia, rol cobrador | Identifica al personal que registró el pago. También queda vacío antes del cobro. |

El total se calcula como **personas × precio unitario confirmado**. Se registra un único pago presencial completo por reserva de experiencia. Los pagos y abonos de pedidos conservan su relación Pago–ABONA–Pedido y sus validaciones. El reporte 6 sigue sumando pedidos entregados; no agrega estos cobros de experiencias.

Los archivos vigentes tienen **20 entidades**, **22 tablas principales** y **31 claves foráneas principales**. La base recuperada muestra 23 tablas porque conserva `recordatorios_reserva`, una tabla auxiliar anterior que el procesador actual de avisos no utiliza. Las otras dos tablas anteriores de experiencias ahora forman parte del diseño principal.

## Instalación y evidencia

Para una instalación nueva se usa el esquema y la semilla vigentes. Para actualizar una base anterior, primero realizar un respaldo y revisar `npm run db:experiencias`; solo `npm run db:experiencias -- --aplicar` realiza el ajuste. La migración incorpora columnas e índices sin reiniciar tablas. No se debe importar una semilla regenerada sobre registros existentes para actualizarlos.

La integración se ensayó en la copia de revisión y en una instalación nueva. La migración aplicada en la base habitual conservó las filas anteriores de las 23 tablas. La evidencia y los respaldos locales están fuera del repositorio, en `work/experiencias-integracion-20261110` del espacio de trabajo de esta conversación. Incluyen pruebas de concurrencia, permisos, precio histórico, cancelación, pago presencial, recorrido de interfaz y correspondencia entre modelos y base.
