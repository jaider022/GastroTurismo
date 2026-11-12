# Reportes académicos de GastroTurismo

Revisión del 10 de noviembre de 2026. Corresponde al proyecto principal del escritorio. La clasificación se verificó leyendo las consultas que ejecuta el servidor y comparándolas con el SQL mostrado en la aplicación.

| ID | Reporte | Clasificación | Tablas y operación principal |
|---|---|---|---|
| 1 | Directorio de restaurantes | Simple | `restaurantes`; selección de datos y orden por nombre. |
| 2 | Clientes registrados | Simple | `usuarios`; filtro de clientes y orden por fecha de registro. |
| 3 | Platos disponibles | Simple | `platos`; filtro de disponibilidad y orden por precio. |
| 4 | Calificación promedio por restaurante | Intermedio | `restaurantes` y `resenas`; LEFT JOIN, COUNT y AVG. Incluye restaurantes sin opiniones, con promedio nulo. |
| 5 | Reservas por zona turística | Intermedio | `municipios`, `zonas`, `restaurantes`, `mesas`, `reserva_mesas` y `reservas`. Agrupa por zona y cuenta reservas distintas. Incluye zonas que tienen reservas. |
| 6 | Ingresos por restaurante | Intermedio | `restaurantes`, `pedidos` y `estados_pedido`. Usa LEFT JOIN y agrega los pedidos entregados. Incluye restaurantes con ingresos cero. |
| 7 | Detalle y ocupación de mesas | Intermedio | `restaurantes` y `mesas`; INNER JOIN, COUNT y SUM condicional por estado. Incluye restaurantes con mesas registradas. |
| 8 | Restaurantes con calificación superior al promedio | Avanzado | Promedio de cada restaurante comparado mediante subconsulta con el promedio de todas las reseñas. |
| 9 | Clientes VIP | Avanzado | Reservas por cliente comparadas con la media de los clientes que tienen reservas, usando una subconsulta y una tabla derivada. |
| 10 | Platos vendidos al menos en la media de su categoría | Avanzado | SUM de cantidades por plato; subconsulta que calcula la media de los platos con ventas de la misma categoría. |

Se cubren **3 simples, 4 intermedios y 3 avanzados con subconsultas**. Los reportes 11 y 12 son adicionales: comparan comensales atendidos e ingresos de usuarios a la aplicación entre meses. Las gráficas se mantienen en 6, 9 y 10.

## Criterios que deben explicar los integrantes

- Los reportes 1–10 consultan el histórico completo. Reservas y cantidades vendidas conservan el criterio histórico de sus consultas; no se añadió un filtro por cancelación. La profesora debe confirmar si prefiere cambiar ese criterio de negocio.
- El reporte 6 suma únicamente pedidos **entregados**. No equivale a sumar los pagos, que pueden registrarse en fechas distintas a la entrega del pedido.
- El reporte 7 cuenta el estado guardado de las mesas; la disponibilidad para una fecha y hora se consulta en Reservas, con turnos de dos horas.
- VIP compara **clientes con reservas**. Administradores, propietarios y clientes sin reservas no alteran la media ni aparecen como VIP por este cálculo.
- El reporte 10 usa `>=`: incluye un plato que iguala la media. Los platos sin ventas no reducen esa media, porque el SQL utiliza INNER JOIN con los detalles de pedidos.
- El reporte 11 cuenta personas de la asistencia registrada; el 12 cuenta accesos exitosos y usuarios distintos. Son medidas diferentes.

## Correcciones y comprobación

Se corrigieron sumas de importes y calificaciones recibidos como texto; precios numéricos para exportar; disponibilidad recibida como `0`/`1` de texto; fecha de registro sin la hora; inclusión de filas conforme a INNER/LEFT JOIN; y columnas/umbrales de calificaciones y ventas. El reporte de vendidos consulta la tabla de detalles y recupera los detalles anidados de pedidos demo nuevos cuando aún no están en esa tabla, evitando duplicar los de la semilla.

El SQL de VIP ahora aplica el mismo filtro de clientes en la población y en su media. El SQL mostrado del reporte 10 incluye también `id_categoria` en su agrupación, igual que el servidor.

`tests/reportes-academicos.test.js` ejecuta las diez consultas reales del servidor mediante un motor SQL independiente **en memoria**, con equivalentes de IF y DATE_FORMAT, y compara sus resultados con los cálculos demo sobre datos ficticios y casos de borde. También comprueba clasificación y coincidencia del SQL mostrado. Esta verificación no sustituye la ejecución en MySQL ni valida sus modos SQL, permisos o configuración. No se modificaron datos del usuario ni los modelos.


## Permisos verificados

El administrador dispone de los doce reportes. Para el propietario, las consultas se limitan a los restaurantes de su cuenta. Los reportes 2, 9 y 12 quedan disponibles al administrador. Los clientes consultan sus pedidos, reservas y documentos en sus secciones.

La revisión del 11 de noviembre incluye las diez consultas académicas, la ejecución de los doce reportes en MySQL y la descarga de los doce PDF desde la interfaz, con revisión visual de sus 14 páginas. También se repitió el recorrido del propietario. Los cobros de experiencias se consultan en ese módulo; el reporte 6 conserva su criterio de pedidos entregados.
