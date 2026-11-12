# Cambio del alcance: reservas y pedidos sin membresías

3 de noviembre de 2026. Se trabaja sobre el proyecto local abierto en Antigravity, sin integrar la versión remota de Luisa.

## Aplicación y modelo

- Se retiran planes, etiquetas Básico/Premium y la contratación de membresías.
- Restaurantes conservan propietario, zona, mesas, menú y reservas.
- Pago pertenece obligatoriamente a Pedido. Se mantienen cliente, monto, fecha, estado y medio de pago; un pedido puede tener varios pagos, como indica ABONA en el conceptual.
- La aplicación valida pedido existente, cliente correspondiente, estado no cancelado y medio de pago existente. El pago continúa siendo una simulación académica, sin pasarela ni cobro real.
- El esquema de instalaciones nuevas contiene 15 tablas y 21 claves foráneas. No cambia la lógica de los 12 reportes, la asistencia real ni los ingresos a la aplicación.

## Datos de demostración

Se conserva la misma fecha de corte, 27/10/2026, y los identificadores previos. Permanecen 364 reservas, 352 pedidos y 320 pagos de pedidos. Se retiran siete pagos de planes de los archivos de ejemplo. La versión anterior completa está en el respaldo local de esta sesión, fuera del repositorio.

Al abrir una copia del navegador que aún use planes, primero se guarda un respaldo de restaurantes, pagos y planes en `gt_academico_v2:respaldo_antes_sin_planes`. Solo después se adaptan los restaurantes y se apartan los pagos de planes de la colección activa. No se reinicia el almacenamiento ni se reemplazan reservas, pedidos, usuarios, visitas o accesos creados por el usuario. El respaldo permanece local en ese navegador. Si falla su escritura, la adaptación se detiene.

## Base MySQL existente

El ajuste se aplicó a `gastronomia_turistica_academica` después de ensayarlo sobre una copia. La revisión del 5 de noviembre comprobó 364 reservas, 352 pedidos y 320 pagos de pedidos. La base mantiene las 15 tablas principales y las tres tablas preexistentes de experiencias y recordatorios. El respaldo completo previo y los siete pagos antiguos de planes se guardaron en `backups/sin-planes`.

1. Detener el servidor de la aplicación y conservar un respaldo general de la base.
2. Ejecutar `npm run db:sin-planes`. Esta ejecución inspecciona y muestra el número de pagos de planes; no altera datos.
3. Si la inspección es correcta, ejecutar `npm run db:sin-planes -- --aplicar`.
4. El script verifica el respaldo antes de aplicar cambios. Guarda restaurantes, pagos, planes y, si existe, la tabla de suscripciones en `backups/sin-planes`, una carpeta local excluida de Git.
5. Se apartan los pagos antiguos de planes mediante el respaldo, se retiran las referencias y tabla de planes, y se exige pedido en cada pago. Reservas, pedidos, clientes y pagos de pedidos se conservan. Pagos ambiguos, huérfanos o relaciones adicionales con planes detienen la inspección para revisión.
6. Comprobar el recorrido completo con MySQL: acceso, catálogo, reserva, pedido, pago y reportes. La adaptación actual conserva los IDs previos; una semilla regenerada se usa únicamente en una base vacía, aunque tenga la misma fecha de corte.

Los cambios de estructura de MySQL no se deshacen con una única transacción. Si una instrucción falla, conservar el respaldo y revisar el esquema antes de continuar; no recrear ni borrar la base. El script permite volver a inspeccionar un avance parcial y no hace cambios si el esquema ya está actualizado.

La revisión aprobó 130 pruebas, incluidas las de integración con la base principal. Se comprobó el registro del pago, la clave obligatoria hacia Pedido y los 12 reportes. Los registros de prueba se retiraron y se compararon los demás datos antes y después.
