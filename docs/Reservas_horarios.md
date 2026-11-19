# Horas y orden del formulario de reserva

Actualización del 18 de noviembre de 2026 con los horarios confirmados por Jaider.

El formulario conserva el orden **restaurante → fecha → hora → cantidad de personas → mesas disponibles**. Las horas se seleccionan en casillas de quince minutos.

| Establecimiento | Apertura | Cierre | Última llegada para reservar |
|---|---|---|---|
| Café Sorrento | 08:30 | 22:30 | 20:30 |
| Café La Palma | 11:00 | 22:30 | 20:30 |
| Cocina del Mirador | 11:00 | 22:30 | 20:30 |
| Fogón del Guadual | 11:00 | 22:30 | 20:30 |
| Sabores del Camino | 11:00 | 22:30 | 20:30 |

El turno existente sigue durando dos horas. La última llegada es a las 20:30 para finalizar a las 22:30. Sorrento ofrece 49 horas de llegada; los otros cuatro establecimientos ofrecen 39. La palabra café, la especialidad y la oferta de desayunos ya no asignan por sí solas una apertura temprana. Los restaurantes adicionales utilizan el horario general de 11:00 a 22:30.

Al cambiar el restaurante se limpia la hora seleccionada. Por ejemplo, pasar de Sorrento a La Palma retira la selección de las 08:30 y ofrece horas desde las 11:00. Las horas anteriores al instante actual en Bogotá se deshabilitan para el día de hoy. El texto junto al selector distingue atención, última llegada y duración.

La consulta de mesas disponibles, la creación y la reprogramación validan el horario en la API. Antes de la apertura o desde el cierre se informa que el restaurante está cerrado. Una llegada posterior a las 20:30 se rechaza porque el turno terminaría después del cierre. También se rechazan minutos fuera de los intervalos de quince minutos y segundos distintos de cero. La demostración del navegador aplica las mismas reglas.

Las reservas anteriores se conservan. Pueden consultarse y cancelarse aunque tengan una hora fuera del nuevo rango; no se corrige su historial automáticamente. Una reprogramación activa debe cumplir el horario vigente. Se mantienen la selección de varias mesas, su capacidad conjunta, el control de cruces, el aforo y los permisos existentes.

La regla del servidor está en lib/horarios-reservas.js y se aplica desde lib/reservas.js. El selector y la validación de demostración están en public/app.js; una prueba compara sus resultados con los del servidor. No se cambiaron el esquema, las filas históricas ni los modelos de datos para este ajuste. Los horarios son perfiles configurados en el código, no un calendario editable almacenado en una tabla.

Verificación: 148 pruebas generales aprobadas y dos integraciones omitidas por defecto. Al activar la integración MySQL del proyecto, sus 19 pruebas pasaron, incluida la comprobación de horas inválidas sin inserciones y la disponibilidad real de La Palma y Sorrento. Las pruebas de integración retiran únicamente sus propios registros temporales.
