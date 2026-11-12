# Horas y orden del formulario de reserva

Actualización del 12 de noviembre de 2026, por solicitud y rangos de prueba aprobados por Jaider.

El orden del formulario es **restaurante → fecha → hora → cantidad de personas → mesas disponibles**. La hora se elige con casillas separadas por quince minutos, sin escribir minutos libres. Los rangos de inicio son:

- Cafés: 08:00 a 22:00, inclusive.
- Restaurantes: 11:30 a 23:00, inclusive.

El perfil se identifica en el formulario por el nombre y la especialidad: Café/Cafetería, repostería o desayunos usan el rango de cafés. Cocina tradicional cafetera no se confunde con un café. Son rangos de demostración; no se añadieron columnas de horario ni se guardaron horarios reales de operación por restaurante. Para cambiarlos, se ajusta la función `reservationTimeOptions` cuando el usuario confirme otros rangos.

Las casillas anteriores a la hora actual de Bogotá se deshabilitan al elegir el día actual. La fecha sigue respetando la validación anterior. Al editar se conserva una hora guardada, incluso si es anterior o no pertenece al nuevo rango; cambiar restaurante o día exige volver a elegir una hora del rango de inicio. No se actualizan reservas antiguas automáticamente.

Las mesas quedan al final. Se conserva la selección múltiple y la consulta de disponibilidad existente. La capacidad seleccionada se muestra y se indica cuando no alcanza para las personas elegidas. El servidor sigue validando mesas del mismo restaurante, cruces y aforo. La duración de dos horas no se modificó. Los límites anteriores son horas de inicio ofrecidas por el formulario; no introducen una nueva regla de cierre o duración en el servidor.

El alcance del ajuste es el formulario, su presentación y sus manejadores en el navegador. **No se modificaron `server.js`, `schema.sql` ni `lib/reservas.js`**, comprobado por hashes antes/después. Tampoco se cambiaron los modelos o la base habitual.

Verificación: **47 pruebas dirigidas aprobadas** y recorrido real con una cuenta de prueba en la copia `gastronomia_turistica_academica_revision_20261110_2`. Se verificaron orden, rangos, cuartos de hora, creación a las 08:15 para cuatro personas, edición a las 08:30, cambio de restaurante, conservación de una hora antigua de 08:42, limpieza al cambiar el día y vista móvil. Los registros de prueba se retiraron; las filas anteriores de las 23 tablas se conservaron por conteos y hashes. No hubo errores JavaScript. Evidencia: `work/reservas-horas-20261112` del espacio de esta conversación.

Los cambios de este formulario son posteriores a `7d03c51` y se incluyen en el guardado autorizado de la versión principal `main` del 12 de noviembre.

## Actualización: Café Sorrento

Posteriormente Jaider indicó para Sorrento atención de lunes a domingo, 08:30–22:30. Su selector ofrece inicios cada quince minutos entre 08:30 y 20:30 (49 opciones), para que las dos horas actuales de ocupación terminen a más tardar a las 22:30. Los demás cafés y restaurantes conservan los rangos anteriores. La conservación de una hora antigua al editar sigue vigente. Este perfil está en el formulario; no se incorporó un calendario de horarios en la base ni una validación nueva de cierre en la API.

Se incorporó Sorrento a la base habitual con diez mesas provisionales combinables: cinco de dos personas y cinco de cuatro, total 30 cupos. Se ensayó una reserva real de seis personas con dos mesas en la copia MySQL y se comprobó el bloqueo de ambas. Esta operación posterior sí agrega registros a la base; conserva todas las filas anteriores de las 23 tablas, con respaldo previo. Ver [Café Sorrento](Cafe_Sorrento.md).
