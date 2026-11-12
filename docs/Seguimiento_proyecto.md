# Seguimiento del proyecto final — GastroTurismo

**Versión 35 — 12 de noviembre de 2026.** Este es el listado de trabajo. De los 25 puntos, hay **23 comprobados, 1 parcial y 1 pendiente**, en el alcance descrito en cada fila. Estas marcas no son un porcentaje de cumplimiento académico. El checklist del 27 de octubre queda como referencia histórica.

**Trazabilidad vigente:** [Requisitos de la profesora, evidencia y pendientes](Trazabilidad_requisitos.md). Se contrastó el PDF completo con el código, los modelos y la base habitual. La matriz distingue funciones implementadas, pruebas pendientes y decisiones que requieren aclaración académica.

**Estado del guardado:** por decisión expresa de Jaider, la versión actual completa se publica como [versión principal en main](https://github.com/jaider022/GastroTurismo/tree/main), incluido carrusel continuo, formulario de reserva e incorporación de Sorrento. La rama `avance-2026-11-12` comparte este cierre. El commit anterior de Luisa, `14bd06d`, queda conservado en la historia; los archivos vigentes corresponden al avance de Jaider. Credenciales, configuración privada, respaldos y archivos personales siguen excluidos.

Proyecto revisado: la carpeta **Bases de datos** del escritorio, abierta en Antigravity. Los avances de la copia separada de Documents no se cuentan como terminados en este proyecto.

Equipo: Jaider Arley Montes y Luisa Fernanda Castañeda. Profesora: Alexandra Ruiz. Caso elegido: **restaurantes y gastronomía turística**.

Fuente académica: `Proyecto final BD1 - 2026-2.pdf`, revisión de 7 páginas entregada por el usuario. Exige mínimo 10 entidades fuertes, operaciones sobre 4 tablas importantes, 10 reportes (3 simples, 4 intermedios y 3 con subconsultas), exportación PDF, acceso validado, plantillas, datos coherentes y documento/sustentación. Los gráficos en tres reportes dan bonificación.

## Cómo leer los estados

- ✅ Comprobado en el alcance descrito. Una prueba visual o aislada no certifica toda la integración con MySQL.
- 🟡 Existe una parte; falta completar, corregir o validar lo indicado.
- ☐ Pendiente: todavía no está hecho o no está verificado.

La aplicación habitual está actualizada en `http://localhost:3001` y conectada a `gastronomia_turistica_academica` en MariaDB, puerto 3318. La migración de experiencias se ensayó y se aplicó después de un respaldo. Se comprobó la conservación de las filas anteriores de las 23 tablas. Ahora hay 22 tablas principales y una auxiliar anterior de recordatorios; el total físico sigue siendo 23. Se añadieron tres próximas actividades de ejemplo, sin crear reservas ni cobros ficticios en esta base.

## Listado vigente

| ID | Estado | Trabajo | Qué está y qué queda |
|---|---|---|---|
| 01 | ✅ | Apariencia e inicio de sesión | Portada de una pantalla, foto principal completa con fondo desenfocado y navegación por puntos. Se retiró Eje Cafetero y su raya del encabezado del catálogo. Las tarjetas avanzan cada dos segundos en ciclo continuo, sin devolverse; los cinco lugares pasan por las tres posiciones. La transición entre último y primero conserva las acciones de menú y reserva. Computador y celular comprobados, con foco protegido y movimiento reducido. |
| 02 | ✅ | Listado de reservas | Diez filas por página, búsqueda, filtros de estado/fecha, contador y orden reciente. Probado con 364 reservas de demostración. |
| 03 | ✅ | Listado de pedidos | Paginación, filtro por restaurante y fechas, contador y orden reciente. Probado con 352 pedidos de demostración. |
| 04 | ✅ | Listado de asistencia real | Paginación, filtro por restaurante/fechas y suma de personas de todos los resultados. Probado con 672 visitas y 2.387 personas de demostración. |
| 05 | ✅ | Datos de ejemplo coherentes | Semilla de 22 tablas, con experiencias y reserva de cupos de demostración. Se incorporó Café Sorrento a la base habitual y a los datos de instalación: cinco restaurantes, diez mesas nuevas combinables y 30 cupos provisionales autorizados. Se conservaron todas las filas previas de 23 tablas; no se inventó historial del café. La base habitual mantiene 364 reservas de mesas, 352 pedidos, 320 pagos y 672 visitas; tiene seis actividades, tres próximas, y cero reservas de experiencias nuevas. |
| 06 | ✅ | Acceso, registro y perfil básico | Registro, inicio y cierre de sesión comprobados con la base académica. Se verificaron la contraseña protegida, el rol y la consulta del perfil de la sesión. |
| 07 | ✅ | Administrar restaurantes | Se probaron alta, consulta, edición y eliminación con MySQL. El propietario gestiona sus establecimientos, el cliente tiene bloqueados los cambios y el administrador conserva el propietario original al editar. Alta y edición también comprobadas desde el formulario. |
| 08 | ✅ | Administrar mesas desde pantalla | Alta, consulta, edición y eliminación implementadas en pantalla; API real y permisos comprobados. Se adaptó la edición de capacidad a grupos con varias mesas y el servidor comprueba el propietario. Las cuatro operaciones desde pantalla se comprobaron en el punto 25 con cuenta administradora. |
| 09 | ✅ | Administrar platos desde pantalla | Creación, consulta, edición, disponibilidad, búsqueda y paginación implementadas. Las cuatro operaciones se comprobaron en API real: se elimina un plato sin historial, se bloquea al propietario ajeno y se conserva el detalle del pedido al desactivar un plato usado. Formulario y filtros tienen comprobaciones de interfaz/demo. |
| 10 | ✅ | Reglas de las reservas | Formulario en orden restaurante, fecha, hora, personas y mesas; horas de inicio en casillas de quince minutos. Rangos de prueba: cafés 08:00–22:00, restaurantes 11:30–23:00. Excepción Sorrento: apertura indicada 08:30–22:30; inicios hasta 20:30 para terminar las dos horas antes del cierre. Su reserva de seis personas con mesas de 2+4 se comprobó en copia MySQL y ambas quedaron ocupadas. Se conserva la hora antigua al editar. Servidor, esquema y módulo de reservas sin cambios. La duración de dos horas sigue pendiente de confirmación académica. |
| 11 | ✅ | Pedidos de comedor y domicilio | Recorrido real desde la interfaz con los tres perfiles. Comedor pasa a Servir y domicilio pasa por Despachar y Entregar. Se exige dirección para domicilio y los importes se calculan con el menú. Se probaron cambios de estado y el rechazo de transiciones incompatibles. |
| 12 | ✅ | Reportes y gráficas | Los 12 reportes ejecutaron en MySQL sobre el esquema actualizado. Reservas por zona cuenta cada reserva una sola vez aunque use varias mesas. Ingresos por restaurante usa el catálogo de estados. |
| 13 | ✅ | Exportación de reportes | Se descargaron los doce reportes desde la interfaz con MySQL y se revisaron visualmente sus 14 páginas: títulos, datos, criterios y continuación de tablas. Las gráficas de 6, 9 y 10 están en la aplicación; incluirlas dentro del PDF no se identificó como requisito expreso. |
| 14 | ✅ | Comprobantes y factura | Descarga desde la interfaz con MySQL y revisión visual de los PDF. El comprobante muestra las dos mesas y seis comensales. La factura conserva los importes del pedido. Se mantiene la protección contra vistas previas vacías o antiguas. |
| 15 | ✅ | Permisos de clientes y propietarios | Se probaron perfiles de cliente, propietario y administrador. Reservas y pedidos del propietario consultan sus restaurantes reales en MySQL. Los reportes del propietario quedan limitados a sus establecimientos. Los reportes generales de clientes, VIP y accesos se reservan al administrador. |
| 16 | ✅ | Coherencia de los dos modelos | Blanco: 20 entidades con identificador propio y 3 subtipos de Usuario (23 rectángulos), 88 atributos, 29 relaciones de negocio y una jerarquía total/disjunta. Cliente, PropietarioRestaurante y Administrador se almacenan en usuarios mediante tipo_usuario; no añaden tablas. Se contrastaron las 22 tablas y 31 FK de Oracle/schema.sql con la metadata de la base. Reglas originales de EERCASE: cero incumplimientos. Se conservaron exactamente las posiciones de las figuras organizadas por el usuario, se retiraron los cinco puentes equivocados y se añadieron las conexiones nativas de herencia. Imagen exportada desde EERCASE y copia de entrega actualizadas en sus mismas rutas. Explicación en Herencia_usuarios.md. Integrar el documento queda en 22. |
| 17 | ✅ | Explorar antes de registrarse | Clic en imagen o nombre abre la ficha sin registro. Solo Reservar exige acceso/registro y conserva el restaurante. Los cinco restaurantes ya pertenecen a la base; Sorrento usa su identificador real y conserva su galería, horario y oferta informativa sin precios inventados. Se comprobó la portada habitual sin escrituras a la API y el recorrido de acceso/reserva en la copia MySQL. |
| 18 | ✅ | Experiencias gastronómicas | Publicar/editar actividades, consultar y filtrar, reservar/cancelar cupos y registrar pago recibido en restaurante. Probados concurrencia del último cupo, precio histórico, reintentos, cancelaciones y permisos. Recorrido de cliente, propietario y administrador comprobado en pantalla. Migración aplicada conservando los datos. Guía en Experiencias_gastronomicas.md. |
| 19 | ✅ | Pagos de pedidos | MySQL rechazó un abono superior al saldo y devolvió el mismo pago al reintentar con la misma referencia. Se conserva ABONA directo a Pedido. El cobro sigue siendo simulado. |
| 20 | ✅ | Notificaciones y recordatorios | Avisos privados, cambios de reserva y recordatorios de próximas 24 horas comprobados, sin duplicados ni avisos de reservas canceladas. El servidor revisa cada minuto mientras está activo. El plazo es fijo; confirmar con la profesora si exige preferencias de anticipación/canal para el requisito de personalización. |
| 21 | ✅ | Servidor local y MySQL | La migración se aplicó en la base habitual después de respaldarla. Se compararon todas las filas de las 18 tablas anteriores. La aplicación funciona en localhost:3001 con Municipio, catálogos, varias mesas por reserva y recordatorios. |
| 22 | 🟡 | Documento final | Borrador previo con Municipio, varias mesas, catálogos y ABONA. Falta incorporar experiencias, integrar los modelos nuevos y adaptar la entrega a la plantilla oficial. Esta etapa sigue aplazada por indicación del usuario. |
| 23 | ✅ | Guardar los últimos avances en GitHub | Versión actual completa en `main` por autorización del usuario; incluye carrusel continuo, horarios de reserva y Sorrento, además del código, SQL, datos académicos, fotos, pruebas y modelos previamente guardados. El historial de Luisa se conserva y el árbol publicado coincide con el avance local. La rama `avance-2026-11-12` comparte el cierre. Credenciales y respaldos excluidos. Luisa debe continuar desde `main`, según Trabajo_en_equipo.md. |
| 24 | ☐ | Aprobación y sustentación | Falta constancia de aprobación de las cuatro tablas y preparar/practicar la explicación de ambos integrantes. Aclarar retiro de planes, alcance del pago simulado, personalización de avisos, turnos de dos horas y criterios de reportes. La asesoría no acredita aprobación final ni sustentación. |
| 25 | ✅ | Pruebas finales | Cerrado el alcance pendiente: 16 operaciones desde las pantallas (crear, consultar, editar y eliminar restaurantes, mesas, platos y reservas) con cuenta administradora y conexión MySQL en la copia de revisión. Reserva editada conservando dos mesas y eliminación sin filas huérfanas. Cero errores JavaScript observados. Registros temporales retirados; filas anteriores de las 23 tablas idénticas por conteos y hashes. Blanco recargado y validado en EERCASE: panel con 0 problemas. Se conserva la evidencia anterior de 151 pruebas, doce PDF y recorridos de los tres perfiles; no se volvió a ejecutar esa suite sin cambios de código. La práctica de ambos integrantes queda en 24. |

## Recomendaciones de la asesoría del 3 de noviembre

Las marcas son aproximadas y corresponden al video `asesoria.mp4`. La profesora revisó primero el modelo blanco y luego el relacional anterior, que todavía mostraba planes.

| Minuto | Lo que se habló | Qué hacer en GastroTurismo |
|---|---|---|
| 1:37–2:45 | La especialidad puede ser única o admitir varias, según la regla que el equipo quiera modelar. | La decisión del equipo fue registrar una especialidad principal por restaurante. El campo actual permite esa regla. |
| 4:15–4:28 | En el modelo blanco se lee ubicación entre los atributos de Mesa. | Usar ese dato para identificar el sector dentro del restaurante, como terraza o salón. |
| 7:50–8:40 | Una reserva puede incluir varias mesas y una mesa puede participar en distintas reservas. Se acordó una relación muchos a muchos. | Pasar de `reservas.id_mesa` a `reserva_mesas(id_reserva, id_mesa)` y migrar cada asignación existente. Permitir seleccionar varias mesas del mismo restaurante y validar capacidad conjunta y disponibilidad. Adaptar la asistencia, los reportes y el comprobante. |
| 13:30–14:30 | La profesora sugirió quitar los subtipos de pago sin atributos si el caso prescinde de ellos y conectar ABONA directamente con Pago. También revisó cómo identificar el medio utilizado. | ABONA ya está conectada a Pago y Pedido. El medio ya se identifica con `pagos.id_metodo` y `metodos_pago`. Confirmar el alcance final de planes y pago en línea, porque la guía general los menciona y el equipo decidió retirar los planes. |
| 14:30–15:10 | Pidió organizar el diagrama para que se pueda leer en el documento. | Aplicar la letra ya uniformada del EERCASE al exportar, revisar la legibilidad del plano completo y sustituir las exportaciones previas. |
| 15:30–16:40 | Pidió separar ciudad en una tabla y, al hablar del alcance local, usar Municipio. Departamento aparece en la explicación de un alcance nacional. | Crear `municipios` y enlazar `zonas.id_municipio` con ese catálogo. En la base anterior `zonas.ciudad` guardaba el nombre como texto. La dirección exacta sigue en Restaurante y la ubicación interna de una mesa sigue en Mesa. Ejemplo del propio conjunto de datos: Salento → Valle de Cocora → restaurante → mesa. |
| 22:30–22:51 | En el cierre enumera tipo de servicio, estado del pedido, estado de la reserva y ciudad o departamento entre los grupos que quiere separar. | Crear `tipos_servicio`, `estados_pedido` y `estados_reserva`, con claves foráneas desde las tablas que los usan. Partir de los valores actuales. El tipo de servicio del pedido describe comedor o domicilio. Los estados siguen describiendo el avance de su pedido o reserva. |

## Correcciones en el cuadro blanco y el amarillo

Los archivos de trabajo son `GastroTurismo_revisado.eer` en EERCASE y `GastroTurismo_Oracle_revisado` en Oracle Data Modeler. Se comprueba cada regla del cuadro blanco contra las claves, las relaciones y las restricciones del amarillo. La aplicación se verifica con esa misma regla.

| Estado | Corrección | Blanco · EERCASE | Amarillo · Oracle | Base y aplicación |
|---|---|---|---|---|
| ✅ | Pago de pedido y ajuste sin planes | ABONA une Pago y Pedido. | `pagos.id_pedido` obligatorio y `pagos.id_metodo` identifica el medio. | Se comprobaron saldo y reintento con la misma referencia. |
| ✅ | Ubicación de la mesa | Ubicación es un atributo de Mesa. | `mesas.ubicacion` guarda el sector dentro del restaurante. | La pantalla de mesas registra valores como salón o terraza. |
| ✅ | Municipio | Municipio 1:N Zona turística. | `zonas.id_municipio` referencia a `municipios`. | Se conservaron los cinco municipios y el reporte por zona usa el catálogo. |
| ✅ | Reserva de varias mesas | Reserva–Mesa N:M. La reserva requiere al menos una mesa. | `reserva_mesas` tiene clave compuesta de reserva y mesa. | La migración mantuvo las 364 asignaciones. Se probó la reserva de dos mesas y el rechazo de un cruce. |
| ✅ | Tipo de servicio | TipoServicio 1:N Pedido. | `pedidos.id_tipo_servicio` referencia al catálogo. | Se conservaron comedor y domicilio. Domicilio exige dirección. |
| ✅ | Estado del pedido | EstadoPedido 1:N Pedido. | `pedidos.id_estado_pedido` referencia al catálogo. | Se conservaron los cuatro estados. Las transiciones dependen del servicio. |
| ✅ | Estado de la reserva | EstadoReserva 1:N Reserva. | `reservas.id_estado_reserva` referencia al catálogo. | Pendiente y confirmada bloquean las mesas en el horario. Se conservaron los cuatro estados. |
| ✅ | Experiencias y pago presencial | Experiencia y ReservaExperiencia, con relaciones a Restaurante, Usuario, MetodoPago y usuario cobrador. | Dos tablas incorporadas al diseño principal; precio confirmado y campos de pago presencial. | Cupos, permisos y cobro comprobados; coincidencia de las 31 FK principales con la base. |
| 🟡 | Presentación para entregar | Imagen vigente con 20 entidades independientes y 3 subtipos de Usuario; archivo validado con las reglas originales de EERCASE. | PDF vigente de 22 tablas y 31 claves foráneas; diseño abierto y guardado por Oracle. | Exportaciones revisadas, EERCASE recargado con 0 problemas y copias de Proy final actualizadas. Falta integrar en el documento final. |

## Plan de trabajo

### 1. Preparar el proyecto y recuperar la base · 21, 23 y 25

- [x] Guardar el punto de partida del código y los modelos vigentes. Se verificó el archivo de respaldo de 130 archivos y se registró el estado local de Git frente al avance de Luisa.
- [x] Restaurar en una instancia separada el respaldo verificado del 3 de noviembre. La copia incorpora la migración sin planes y coincide con la comprobación del 5 de noviembre, incluidas las 364 reservas, los 352 pedidos y los 320 pagos de pedidos.
- [x] Conectar GastroTurismo a la copia y repetir las pruebas de integración. Pasaron 130 pruebas y el iniciador habitual confirmó conexión activa. El respaldo del proyecto, los ajustes locales anteriores y los resultados se guardaron en `work/mysql-recuperacion-20261110` del espacio de trabajo.

### 2. Incorporar las correcciones de los modelos · 16 y 10

- [x] Municipio incorporado en los dos modelos y en la base de ensayo. Se conservaron Armenia, Buenavista, Filandia, Montenegro y Salento.
- [x] Catálogos de servicio y estados incorporados en los dos modelos, la base y la aplicación.
- [x] Relación Reserva–Mesa N:M incorporada en ambos modelos y comprobada con una reserva de dos mesas.
- [x] Datos de demostración, base y reportes comprobados con las nuevas relaciones.
- [x] Atributos, identificadores y participación contrastados. Reserva–Visita elige la referencia en Visita; 11 campos de experiencias se marcan obligatorios como en el esquema. Validación original de EERCASE: cero incumplimientos.

### 3. Cerrar las cuatro tablas principales · 07–10 y 15

- [x] **Restaurantes.** Ciclo y permisos probados con MySQL. Alta y edición comprobadas en la interfaz.
- [x] **Mesas.** Ciclo probado y validación del efecto de capacidad y mantenimiento sobre reservas activas.
- [x] **Platos: creación, consulta y edición.** Comprobadas con MySQL; formulario y disponibilidad también tienen pruebas de interfaz/demo.
- [x] **Platos: cierre de eliminación en API real.** Eliminación autorizada sin historial, rechazo por pedidos vinculados y conservación del detalle al desactivar comprobados con MySQL. La demostración completa desde botones queda en el ensayo final.
- [x] **Reservas: alta, consulta y reglas de disponibilidad.** Varias mesas, capacidad, aforo simultáneo, fechas y cruce de horarios comprobados con MySQL.
- [x] **Reservas: modificación y eliminación.** Edición y eliminación autorizadas, conservación de las dos mesas al editar y limpieza del puente al eliminar comprobadas con MySQL. Confirmar académicamente el turno de dos horas en el punto 24.
- [x] **Permisos.** Probados cliente, propietario y administrador, consultas privadas, restaurantes del propietario, cambios de estado y reportes limitados por servidor. Las operaciones restantes se completan en el punto 25.

### 4. Definir y completar los flujos pendientes · 11, 18–20 y 24

- [ ] Dejar por escrito los requerimientos de las cuatro tablas principales y confirmar con la profesora el alcance de experiencias, recordatorios y pago en línea. Registrar la decisión del equipo sobre los planes junto con la respuesta de la profesora.
- [x] **Pedidos y domicilio.** Recorrido de cliente y propietario comprobado, dirección obligatoria y transiciones de estado autorizadas.
- [x] **Abonos simulados.** Saldo máximo y reintento con referencia comprobados. El alcance de pago online y la exclusión de planes siguen pendientes de aclaración académica.
- [x] **Recordatorios.** Avisos privados de próximas 24 horas y cambios de reserva probados, con lectura y protección frente a duplicados. Personalización de plazo/canal pendiente de aclaración.
- [x] **Experiencias.** Publicación, consulta, reserva/cancelación de cupos y pago presencial integrados; permisos y recorrido comprobados sin incorporar planes ni mezclar cambios remotos.

### 5. Completar la entrega y la demostración · 16, 22 y 25

- [x] Exportar el blanco y el amarillo vigentes a docs/modelos y revisar sus exportaciones.
- [x] Comprobar la vista en los editores y sustituir las copias de entrega. Oracle revisado y EERCASE recargado/validado con 0 problemas. La legibilidad dentro del Word se comprueba al integrar el documento en 22.
- [ ] Actualizar el Word en la plantilla de entrega con el caso de estudio, los requerimientos acordados, los modelos, los datos de ejemplo y las evidencias. El borrador ya describe el alcance sin planes y ABONA directo.
- [x] Conservar los resultados del conjunto de pruebas y los recorridos de interfaz. Reparto 3/4/3 de reportes y tres gráficas comprobados.
- [x] Completar las operaciones pendientes en API real y revisar los doce PDF, incluidas sus continuaciones de página.
- [ ] Vista de los modelos dentro de los editores y ensayo completo de las cuatro operaciones desde las pantallas; repetir la regresión si hay cambios nuevos.

### 6. Reunir el trabajo del equipo y sustentar · 23 y 24

- [ ] Guardar los avances locales, comparar el commit de Luisa e incorporar los cambios acordados. Probar la versión reunida y publicar el código, el esquema, las semillas de ejemplo y la documentación que corresponda.
- [ ] Ensayar con ambos integrantes el recorrido desde el problema y el modelo hasta las cuatro tablas y los reportes. Preparar la base de demostración y guardar las evidencias de la entrega.

## Comprobaciones anteriores

### Primera revisión · versión 1

- Lectura del proyecto principal, de los requisitos vigentes y del checklist anterior.
- Pruebas ejecutadas: `node --test --test-reporter=spec tests/backend.test.js tests/dataset.test.js tests/frontend-reportes.test.js`.
- Resultado: **24 aprobadas, 0 fallidas**. El servidor usado por esas pruebas es aislado y su base está simulada; no son pruebas de MySQL.
- Las verificaciones visuales de 01–04 se realizaron durante el trabajo de esta conversación. La última revisión fue de archivos y pruebas aisladas.
- En esta primera versión se actualizó la documentación de seguimiento; no se implementó una función nueva de la aplicación ni se modificaron registros de la base.

### Punto 08 — versión 2

- Pruebas específicas: `node --test --test-reporter=spec tests/frontend-mesas.test.js`: **5 aprobadas, 0 fallidas**.
- Verifican actualización del mismo identificador sin cambiar restaurante/estado, conservación de la creación por POST, control de duplicados, capacidad frente a reserva activa y rechazo de administración por un cliente desde el formulario.
- Navegador: el botón Editar carga los datos; el restaurante queda fijo; guardar confirma la actualización sin crear otra mesa; abrir Agregar limpia el identificador y recupera el modo creación.
- El guardado visual se comprobó conservando los valores existentes de una mesa de demostración. Los cambios de valores y las validaciones se probaron de forma aislada, sin registros de MySQL.
- No se cambió el servidor ni la estructura de la base. La autorización completa en servidor permanece pendiente en el punto 15.

### Punto 14 — versión 4

- Pruebas específicas: `node --test tests/frontend-documentos.test.js`: **12 aprobadas, 0 fallidas**.
- Cubren datos API diferentes de la copia demo, cambio posterior de selector, copia profunda de datos, selección vacía, error, registro eliminado, respuestas fuera de orden, importes DECIMAL como texto y librerías PDF ausentes.
- Descarga desde la aplicación: comprobante RES-364 y factura FACT-349. Se verificaron sus datos contra la vista previa y se renderizó/revisó cada página de ambos archivos.
- El documento descargado utiliza el total guardado en el pedido. Se retiró el cálculo de impuestos que no estaba representado en sus datos.
- No se modificaron entidades, esquema ni servidor, y no se inició MySQL. Su prueba real permanece pendiente.

### Punto 09 — versión 5

- Pruebas específicas: `node --test --test-reporter=spec tests/frontend-platos.test.js`: **13 aprobadas, 0 fallidas**. Usan la API demo real con almacenamiento aislado.
- Cubren creación, actualización del mismo plato/restaurante, disponibilidad, permisos de interfaz, precios/categorías, eliminación de platos sin referencias y conservación completa del historial en ambas fuentes demo.
- Se comprobó que nombres/descripciones con comillas o HTML se muestren como texto y sigan funcionando al agregarlos al carrito.
- Navegador: cinco platos por restaurante, búsqueda sin tilde, filtro de disponibilidad, edición precargada, guardado conservando valores, bloqueo de eliminación con pedidos y formulario de creación limpio.
- Se verificó que Pedidos siga mostrando el menú y permita agregar al carrito; no se confirmó ni pagó un pedido de prueba.
- Respaldo local previo: `work/platos-antes-20261029-214030` en el espacio de trabajo de esta conversación, fuera del proyecto principal.
- No se modificó el esquema ni el servidor ni se inició MySQL. No se ejecutaron comandos de Git ni se publicaron cambios.

### Punto 17 — versión 6

- Pruebas específicas: `node --test tests/frontend-explorar.test.js`: **15 aprobadas, 0 fallidas**.
- Cubren catálogo público sin escrituras, búsqueda sin tildes, textos escapados, platos disponibles, selección conservada en sesión, acceso fallido, registro e inicio de sesión, restaurante eliminado y errores de conexión.
- Se comprueba la apertura del formulario original con el restaurante seleccionado sin crear una reserva. También se comprueban reanudación al recargar, cierre del menú durante carga y respuestas fuera de orden.
- Regresión: las 12 pruebas de documentos y las 13 de platos volvieron a pasar. Sintaxis de `public/app.js` comprobada.
- Respaldo local previo: `work/explorar-antes-20261029-215737`, fuera del proyecto principal.
- No se abrió el navegador ni se modificó el servidor, el esquema o los datos; no se inició MySQL. No se ejecutaron comandos de Git ni se publicaron cambios.

### Punto 20 — versión 7 (avance parcial)

- Listado de avisos: cinco por página, filtros de pendientes/todas/leídas, orden reciente, fechas interpretadas en Bogotá y contador de pendientes independiente del filtro.
- El marcado usa un botón explícito; bloquea pulsaciones repetidas, conserva el aviso ante errores y evita que una consulta antigua lo devuelva a pendientes. Cambiar de sesión limpia la información anterior.
- Consulta y marcado propios protegidos en servidor y en la API demo. Se exige sesión; un administrador también consulta solamente sus avisos. La actualización del servidor incluye el destinatario en su condición y es idempotente.
- Pruebas nuevas: `tests/frontend-notificaciones.test.js`: **13 aprobadas**; `tests/backend-notificaciones.test.js`: **8 aprobadas**. Usan almacenamiento/DB aislados; no son pruebas contra MySQL.
- Regresiones: las **15 pruebas de exploración** y las **10 base de servidor** siguen aprobadas. Sintaxis de `public/app.js` y `server.js` comprobada.
- Respaldo previo: `work/notificaciones-antes-20261029-220552`, fuera del proyecto principal. No se abrió el navegador, no se inició MySQL, no se cambió el esquema ni se ejecutaron comandos de Git.
- Sigue pendiente implementar los recordatorios programados y comprobar el recorrido completo con MySQL; por eso el punto 20 permanece amarillo.

### Punto 12 — versión 8 (avance parcial)

- Clasificación comprobada sobre las consultas reales del servidor: 1–3 simples; 4–7 con múltiples tablas, agrupaciones y agregados; 8–10 con subconsultas. Los reportes 11/12 permanecen como adicionales.
- Corregidos en demo: disponibilidad como texto, precios numéricos para PDF, fechas, sumas numéricas, filas según INNER/LEFT JOIN, columnas del reporte 8, comparación antes del redondeo y media de platos con ventas. Se conserva el historial de la tabla de detalles sin duplicarlo con los detalles anidados.
- Corregido VIP en servidor: clientes con reservas tanto en el conjunto principal como en su media. El SQL visible de 9 y 10 coincide ahora con el servidor, incluida la agrupación por categoría.
- `tests/reportes-academicos.test.js`: **16 aprobadas, 0 fallidas**. Las diez consultas del servidor se comparan con la demo usando datos ficticios y un motor SQL en memoria; incluye casos sin mesas/opiniones, valores numéricos como texto, detalles duplicados, clientes VIP y redondeos positivos.
- `tests/frontend-reportes.test.js`: **8 aprobadas**, conservando los comparativos mensuales y el aislamiento entre API real y demo.
- Clasificación y criterios disponibles en [Reportes académicos](Reportes_academicos.md). La comprobación usa `node:sqlite` del Node instalado en este equipo; no verifica los modos SQL, precisión/configuración ni permisos de MySQL.
- Respaldo previo: `work/reportes-antes-20261029-221258`, fuera del proyecto principal. No se abrió el navegador, no se inició MySQL, no se modificaron registros reales ni modelos ni se ejecutaron comandos de Git.
- El punto permanece amarillo hasta comprobar los reportes en MySQL y completar la revisión final.

### Punto 23 — versión 9

- Autorización expresa recibida del usuario para guardar los avances actuales en Git y publicarlos en el repositorio existente.
- Respaldo de los doce archivos del avance verificado mediante hashes, en `work/git-antes-20261029-222048`, fuera del proyecto principal.
- Antes del guardado, main local y origin/main coincidían en `eb5752d`, sin cambios remotos pendientes de integrar.
- Revisión de exclusiones y de archivos del avance: no se incluyen .env, credenciales.md, configuración privada del motor, archivos personales ni tokens/claves privadas detectados por la revisión.
- Se guarda el código ya comprobado en los puntos 09, 12, 17 y 20, sus pruebas y la documentación de seguimiento. El guardado no completa la conexión ni las pruebas con MySQL pendientes.

## Registro de avances

### Revisión del 3 de noviembre — versión 10

- Se retiran planes del catálogo, formularios, API, generador y semilla. Los pagos exigen pedido, cliente correspondiente y medio válido. Se mantienen reservas, pedidos, mesas, platos, asistencia e ingresos.
- Se compararon las tablas y todas las relaciones del esquema con el archivo nativo de Oracle actualizado: **15 tablas y 21 FK coincidentes**.
- Se verificaron los datos contra el respaldo anterior: las otras tablas permanecen idénticas; se conservan IDs de restaurantes y pagos de pedidos. La semilla mantiene 364 reservas, 352 pedidos y 320 pagos de pedidos; siete pagos de planes quedan en el respaldo previo.
- El navegador adapta los datos antiguos con respaldo previo, sin reiniciar reservas/pedidos. La migración de MySQL tiene inspección predeterminada sin escrituras, respaldo verificado y aplicación explícita; no se ejecutó en la base real.
- Suite final: `node --test --test-reporter=spec tests/*.test.js`, con prueba real MySQL desactivada: **118 aprobadas, 0 fallidas, 1 omitida (MySQL)**. Se probaron errores de pagos, conservación de almacenamiento, falta de espacio para respaldo, migración simulada para MySQL/MariaDB y regresiones existentes.
- Respaldo del proyecto previo: `work/app-sin-planes-20261103/proyecto-antes.zip`, en el espacio de esta conversación, fuera del proyecto principal. Evidencia de coherencia y pruebas guardada en esa misma carpeta.
- Los nuevos cambios permanecen locales. No se abrió la web, no se inició MySQL, no se integraron cambios remotos ni se hicieron commit o push.
- Paso pendiente: aplicar el cambio sobre una copia respaldada de MySQL y comprobar el recorrido completo. Instrucciones en [Cambio sin planes](Cambio_sin_planes.md).

| Versión | Fecha | Cambio |
|---|---|---|
| 1 | 29/10/2026 | Listado inicial actualizado, pendientes diferenciados y 24 pruebas aisladas aprobadas. |
| 2 | 29/10/2026 | Punto 08 terminado en pantalla, 5 pruebas nuevas aprobadas y guardado en modo demo comprobado. Punto 21 actualizado: servidor disponible, MySQL pendiente. |
| 3 | 29/10/2026 | Punto 23 completado: avance publicado en GitHub y revisión local/remota coincidente. Se conserva pendiente la conexión y prueba de MySQL. |
| 4 | 29/10/2026 | Punto 14 completado en la aplicación; 12 pruebas de documentos aprobadas y dos PDF de demostración descargados y revisados. |
| 5 | 29/10/2026 | Punto 09 completado en pantalla, 13 pruebas nuevas aprobadas. Punto 23 vuelve a parcial: los avances nuevos quedan locales hasta autorización del usuario. |
| 6 | 29/10/2026 | Punto 17 implementado con 15 pruebas nuevas aprobadas. Se mantuvo el inicio actual, se añadió exploración pública y se enlazó la selección con acceso/registro y formulario de reserva. Avance local, sin navegador ni Git. |
| 7 | 29/10/2026 | Avance de punto 20: notificaciones paginadas y filtradas, marcado controlado y permisos de destinatario. 21 pruebas nuevas aprobadas; recordatorios programados pendientes. Avance local, sin navegador ni Git. |
| 8 | 29/10/2026 | Avance de punto 12: clasificación académica validada, SQL mostrado alineado y cálculos demo corregidos. 16 pruebas nuevas aprobadas, más 8 de comparativos. MySQL pendiente; avance local, sin navegador ni Git. |
| 9 | 29/10/2026 | Punto 23: guardado de avances actuales en Git/GitHub autorizado por el usuario, con respaldo local verificado y archivos privados excluidos. |
| 10 | 03/11/2026 | Se adapta la aplicación al alcance sin planes, conservando pedidos/reservas y haciendo obligatoria la relación Pago-Pedido. Esquema alineado con Oracle: 15 tablas y 21 FK. 118 pruebas aisladas aprobadas; aplicación del cambio en MySQL y publicación pendientes. |
| 11 | 05/11/2026 | Se verifican los modelos abiertos y el ajuste aplicado en la base principal. 130 pruebas aprobadas. La base conserva las 15 tablas principales y tres tablas anteriores de experiencias y recordatorios. |
| 12 | 10/11/2026 | Auditoría de los modelos, código y guía. Se incorpora la asesoría con Municipio, Reserva–Mesa y catálogos pendientes. Pasaron 118 pruebas aisladas y se verificó la integridad del respaldo. El arranque de MariaDB quedó pendiente por errores de InnoDB. |
| 13 | 10/11/2026 | Matriz de correspondencia entre EERCASE, Oracle, la base y la aplicación. Se organizan los 13 puntos abiertos en etapas con comprobaciones para cerrar cada una. |
| 14 | 10/11/2026 | Copia de MariaDB restaurada y conectada a GastroTurismo. Se verifican los registros y las 130 pruebas pasan. Se cierra el punto 21 y queda lista la base para Municipio. |
| 17 | 10/11/2026 | Trazabilidad contra las siete páginas de la guía, consulta de la base habitual y revisión de evidencia. Se identifican copias antiguas de modelos, decisiones académicas pendientes y operaciones concretas por comprobar. Se actualizan las casillas antiguas del plan sin declarar el proyecto completo. |
| 18 | 11/11/2026 | Experiencias con cupos y pago presencial integradas y migradas conservando las 23 tablas anteriores. Ambos modelos ampliados y contrastados: 20 entidades, 22 tablas y 31 FK. Copias de entrega actualizadas en las mismas rutas. Operaciones pendientes de API, recorrido público y doce PDF comprobados. |
| 19 | 11/11/2026 | Recuperación del mismo diseño de Oracle y comprobación visual de sus 22 tablas y 31 FK. Se corrigieron 15 columnas con referencias de tipo incompletas, se guardó desde Oracle y se renovó el PDF. EERCASE continúa pendiente de revisión visual por la ventana minimizada que el control no puede restaurar. |
| 21 | 11/11/2026 | Punto 25 cerrado: 16 operaciones CRUD desde pantalla con MySQL en copia de revisión, cero errores JavaScript, limpieza de registros temporales y filas anteriores de las 23 tablas conservadas. EERCASE recargado y validado en la interfaz con 0 problemas. Sin modificaciones del código ni publicación en Git. |
| 20 | 11/11/2026 | Cierre de coherencia del punto 16. Blanco contrastado a nivel de atributos, claves, nulabilidad y relaciones. Corregidos RG11 en Reserva–Visita y 11 campos obligatorios de experiencias. Las reglas originales de EERCASE pasan sin incumplimientos. Misma copia de entrega sincronizada; recarga de la vista pendiente en 25 por fallo de activación de ventana. Sin cambios en la aplicación, datos o Git. |

Al terminar una tarea se conserva su ID, se actualiza su estado con la comprobación realizada y se vuelve a mostrar el listado vigente al usuario. No se marca terminado lo que solo esté propuesto o exista en otra copia del proyecto.

## Comprobación del 10 de noviembre en la versión 16

Se corrigió el uso de los restaurantes ficticios del navegador para filtrar los registros reales del propietario. Se añadieron validaciones de entrada en el servidor, protección de las reservas al cambiar capacidades, control del aforo simultáneo y avisos de cambios de reserva. El cambio de sesión limpia carrito, datos de reportes y vistas previas.

Los permisos de reportes se aplican en el servidor y en la interfaz. El administrador conserva los doce reportes. El propietario consulta los reportes 1, 3, 4, 5, 6, 7, 8, 10 y 11 sobre sus restaurantes. El cliente consulta sus reservas, pedidos y documentos desde las secciones correspondientes.

Los recordatorios aparecen en la campana durante las 24 horas previas a la reserva. Se producen mientras el servidor está activo y se derivan de las reservas y notificaciones existentes. Se conservó el modelo de 20 tablas principales. La hora del aviso quedó fijada por criterio de implementación y puede ajustarse si la profesora pide otra anticipación.

El respaldo definitivo, la verificación de migración, los resultados de las 137 pruebas, las 12 comprobaciones de interfaz y los PDF revisados se conservaron fuera del repositorio en `work/revision-flujos-20261110-214124` del espacio de trabajo. Los registros creados para las pruebas se retiraron al terminar.

## Comprobación del 11 de noviembre — versión 18

Se integraron experiencias con publicación y edición por restaurante, filtros y paginación, reserva/cancelación de cupos y recepción de pago presencial. Se conserva el precio confirmado, se evita el sobrecupo ante solicitudes simultáneas y las referencias impiden duplicar reservas al reintentar. Los avisos son privados. Los cupos de actividades se controlan por separado del servicio de mesas; el alcance de aforo conjunto queda para confirmar con la profesora.

La suite configurada contra la copia MySQL terminó con **151 pruebas aprobadas, cero fallidas y cero omitidas**. Se repitieron las 12 comprobaciones anteriores y se añadieron siete de experiencias/exploración, con cero errores JavaScript observados. Los doce PDF de reportes se descargaron desde la interfaz y sus 14 páginas se revisaron visualmente.

Se comprobó una instalación nueva y la repetición de la migración. Antes de aplicarla en la base habitual se hizo otro respaldo y se guardaron las filas anteriores. La comparación confirmó la conservación de los registros de las 23 tablas. Se incorporaron tres próximas actividades, sin reservas ni cobros nuevos de ejemplo en esta base.

EERCASE, Oracle, schema.sql y la base coinciden en sus relaciones principales: **20 entidades, 22 tablas y 31 FK**. Las exportaciones y las copias de Proy final se actualizaron en sus mismas rutas después de respaldar los archivos anteriores. La comprobación de vista dentro de los editores sigue pendiente.

Código, registros de prueba, respaldos y evidencia del avance están conservados localmente. Evidencia: `work/experiencias-integracion-20261110` del espacio de esta conversación. La publicación en GitHub continúa pendiente del usuario; no se incorporó el commit remoto de Luisa.

## Comprobación del blanco — versión 20

Se abrió el modelo vigente en EERCASE. El panel conservaba un marcador RG11 de Reserva–Visita: en una relación opcional uno a uno faltaba elegir el extremo que recibe la referencia. Se eligió Visita, de acuerdo con `visitas.id_reserva NULL UNIQUE` en Oracle y el esquema. Se conservaron las cardinalidades y el trazado. Además se corrigieron once propiedades `isNull` de Experiencia y ReservaExperiencia que permitían omitir campos exigidos por la base.

Se ejecutaron sin interfaz las reglas EVL originales incluidas en la instalación de EERCASE, con su motor Epsilon/EMF instalado, leyendo el modelo sin guardarlo ni conectarse a una base. El respaldo previo devuelve una advertencia RG11; el archivo corregido devuelve **cero reglas incumplidas**. La comparación adicional comprueba los 88 atributos, las claves identificadoras, nulabilidad, participación, puentes y las 31 referencias de Oracle, schema.sql y la metadata guardada de la base habitual. La exportación blanca se revisó visualmente y la copia de entrega es idéntica al nativo corregido.

La generación automática de SQL de EERCASE devolvió «Operation failed» desde su servicio de transformación externo. Ese resultado no se usó ni se ejecutó en la base. Después falló la activación de la ventana con «failed to activate captured window». Por ello no se afirma que el panel de problemas ya se haya actualizado: recargar el modelo y retirar el marcador antiguo mediante una nueva validación queda en 25. Evidencia y respaldos: `work/revision-modelos-20261111` del espacio de esta conversación. No se modificó código, datos ni Git.

## Cierre del punto 25 — versión 21

Se completaron las cuatro operaciones desde los formularios y botones de restaurantes, mesas, platos y reservas con una cuenta administradora temporal, sobre gastronomia_turistica_academica_revision_20261110_2. Las 16 comprobaciones terminaron aprobadas, sin errores JavaScript. La edición de la reserva conservó ambas mesas y la eliminación retiró sus asignaciones del puente. Se revisaron visualmente las capturas de menú y reserva editados.

Los primeros ensayos requirieron ajustar las esperas del comprobador a los formularios asíncronos y animados y seleccionar la categoría obligatoria del plato. No se identificó un fallo de la aplicación que exigiera cambios de código. Cada ensayo retiró sus registros temporales y verificó que las filas anteriores de las 23 tablas seguían idénticas por conteos y hashes. No se modificó la base habitual.

Se cerró y recargó el mismo archivo blanco en EERCASE, se ejecutó Validate y el panel de problemas quedó en 0 items. La salida SQL fallida de la comprobación anterior se retiró del proyecto de EERCASE y se conservó como evidencia fuera del proyecto. La copia de entrega sigue idéntica al nativo. Evidencia: work/revision-final-20261111 del espacio de esta conversación, resultado-crud.json y validacion-eercase-pantalla.json. No se ejecutaron operaciones de Git.

Este cierre cubre el alcance comprobado; las 151 pruebas y los PDF anteriores siguen como evidencia de su ejecución previa. El ensayo personal de Jaider y Luisa y las decisiones académicas pendientes permanecen en el punto 24.

## Organización visual del blanco — versión 22

Por solicitud del usuario se reorganizó el mismo EERCASE de 20 entidades y 29 relaciones. Se alinearon entidades y atributos en cuatro columnas, se separaron los puntos de entrada/salida y se trazaron las relaciones con giros rectos por espacios entre figuras. Se ajustó el óvalo del identificador más largo y se conservaron las fuentes legibles del nativo. Las comprobaciones geométricas no encontraron figuras superpuestas ni líneas sobre figuras ajenas. Persisten cruces entre conexiones en algunas zonas; no se alteraron relaciones para eliminarlos.

La sección semántica del XML es idéntica a la del respaldo: atributos, identificadores, cardinalidades, participación y elección de Reserva–Visita permanecen intactos. Se abrió y validó el nativo en EERCASE con 0 problemas y se dejó la vista general mediante Zoom to Fit, al 12%; puede ampliarse para leer los detalles. Se actualizaron las imágenes vigentes y GastroTurismo_sin_planes.eer en las mismas rutas. Respaldos y evidencia: work/orden-blanco-20261111. Los estados de los 25 puntos no cambian. No se modificó el amarillo, la base, la aplicación ni Git.

## Segunda distribución visual del blanco — versión 23

Tras la inconformidad del usuario con el primer arreglo se probó una nueva distribución antes de aplicarla. Usuario y Restaurante quedaron contiguos en el centro; las entidades conectadas se situaron alrededor. La longitud total de los recorridos se redujo de 142.760 a 87.740 unidades (38,5 %) y los giros de 194 a 166. No se afirma que desaparezcan todos los cruces: se acortaron y despejaron los recorridos sin retirar relaciones.

Se mantuvieron las 20 entidades, 88 atributos y 29 relaciones, con la sección semántica del archivo idéntica al respaldo. Las comprobaciones no encontraron figuras superpuestas, líneas atravesando figuras ajenas ni nombres fuera de sus figuras. Las reglas originales de EERCASE pasaron y Validate desde la interfaz mostró 0 problemas. Se guardó en el mismo archivo y se actualizaron las imágenes y la copia de entrega existentes.

El diseño previo al primer arreglo permanece respaldado en work/orden-blanco-20261111/antes.eer; el primer arreglo se conserva en work/orden-blanco-segundo-20261111/antes.eer. El usuario puede revisar la segunda propuesta abierta y efectuar sus ajustes manuales. Evidencia: work/orden-blanco-segundo-20261111/revision.json. No se modificó el amarillo, la base, la aplicación ni Git. Los estados del listado siguen en 22 comprobados, 2 parciales y 1 pendiente.

## Herencia correcta de Usuario — versión 24

El usuario aclaró que las lunitas eran las conexiones nativas de herencia. Se retiraron únicamente los cinco puentes visuales añadidos por la interpretación equivocada y se restauraron los tramos originales de esas tres líneas. Se conservó la distribución manual del usuario: ninguna figura ni etiqueta anterior cambió de posición.

Se añadió debajo de Usuario una jerarquía total y disjunta con Cliente, PropietarioRestaurante y Administrador. Los tres subtipos heredan id_usuario y los demás atributos; la transformación relacional usa la tabla usuarios y el discriminador tipo_usuario. El blanco tiene 23 entidades dibujadas (20 con identificador propio y 3 subtipos), 88 atributos, 29 relaciones y 4 enlaces de herencia. El amarillo conserva 22 tablas y 31 FK, con correspondencia comprobada.

Las reglas originales de EERCASE terminaron con cero incumplimientos; se revisaron en la aplicación las tres conexiones curvas de especialización y la imagen nativa exportada. Se actualizaron las copias de entrega y el JPG del repositorio en las mismas rutas. Evidencia y respaldo: work/herencia-usuario-20261111. No se modificaron datos, código de la aplicación ni Git. Los 25 estados siguen en 22 comprobados, 2 parciales y 1 pendiente.

## Entrada pública antes del registro — versión 25

La exploración pública ya existía, pero el acceso inicial seguía mostrando el formulario de contraseña. Se cambió la entrada sin sesión al catálogo público desde el HTML y la inicialización, manteniendo el ingreso directo al panel cuando ya hay una sesión válida. El encabezado permite iniciar sesión o crear cuenta y ambos formularios permiten volver a explorar. Reservar continúa pidiendo autenticación y conserva el restaurante elegido. Cerrar sesión regresa al catálogo y limpia las notificaciones privadas. Se conserva la información de demostración en el formulario de acceso, como había solicitado el usuario.

Verificación dirigida: 46 pruebas aprobadas, cero fallidas y cero omitidas, sobre exploración, autenticación, permisos y notificaciones. Se añadieron cuatro regresiones de entrada anónima, selección pendiente, cambio entre acceso/registro y salida al catálogo. La prueba de respuesta tardía de notificaciones se adaptó para retener únicamente esa consulta mientras el catálogo se carga al cerrar sesión.

Ocho comprobaciones desde navegador con MySQL en la copia de revisión: entrada sin cuenta, menú público, acceso al intentar reservar, registro real retomando el restaurante, cierre de sesión, ingreso de cuenta existente retomando la selección, conservación de sesión al recargar y vista móvil con retorno desde Crear cuenta. Cero errores JavaScript observados y cero reservas automáticas. Se retiró la cuenta temporal y se conservaron exactamente las filas anteriores de las 23 tablas, comparadas por conteos y hashes. Las capturas de escritorio y móvil se revisaron visualmente.

Respaldos y evidencia: work/entrada-publica-20261111 del espacio de esta conversación. La base habitual, el servidor, los modelos y Git no se modificaron. La aplicación habitual sirve los archivos estáticos actualizados. Los estados siguen en 22 comprobados, 2 parciales y 1 pendiente.

## Portada visual y Café Sorrento — versión 26

Se aplicó la propuesta visual aprobada por el usuario: titular editorial, fotografía del Cocora sin overlay oscuro, buscador amplio, filtro de municipio y tarjetas compactas con fotografías ilustrativas originales. Los filtros se combinan, respetan tildes y muestran el número de coincidencias. La dirección y el teléfono se conservan al consultar el menú.

Se editaron las ocho capturas proporcionadas de Café Sorrento para retirar la interfaz de Instagram y los avatares/corazones superpuestos. Se incorporaron como un destacado de Armenia con mosaico y galería: anterior/siguiente, navegación circular, flechas del teclado y Escape. Los productos indicados por el usuario se muestran sin inventar precios. El destacado no crea un restaurante ni habilita reservas sin sus datos de operación. Archivos y prompts: Recursos_visuales_inicio.md.

Verificación: 41 pruebas dirigidas aprobadas, cero fallidas y cero omitidas (exploración, acceso/registro, notificaciones, permisos y experiencias). Nueve comprobaciones en navegador contra localhost:3001 conectado a MySQL: portada e imágenes, filtros combinados y botón de búsqueda, menú y contacto, selección de reserva y acceso/registro, ocho fotos y teclado, vistas de 390/320/768 px y archivos servidos actuales. Cero errores JavaScript, imágenes faltantes o escrituras a la API. Se corrigió un pequeño desbordamiento de los controles de la galería a 320 px y se repitió el recorrido completo.

Respaldos de los archivos anteriores y capturas verificadas: work/inicio-visual-20261112 del espacio de esta conversación. No se cambiaron el servidor, la base ni los modelos; no se guardó en Git. El listado conserva 22 comprobados, 2 parciales y 1 pendiente. El documento final, las decisiones de la profesora y la sustentación mantienen sus estados anteriores.

## Letra ampliada y destacados compartidos — versión 27

Se amplió la introducción de portada a 19,2 px en computador y 17,6 px en anchos pequeños; también aumentaron la nota de acceso, los textos del destacado, los filtros y las tarjetas. Café Sorrento se incorporó al listado y a los filtros junto a los cuatro restaurantes de la base, con idéntico formato visual. Ver sabores y Ver fotos conservan la información aportada sin inventar precios ni permitir una reserva sin datos y mesas.

El destacado superior recorre Sorrento, Café La Palma, Cocina del Mirador, Fogón del Guadual y Sabores del Camino, por turnos de nueve segundos. Dispone de anterior/siguiente y pausa. No cambia con el ratón o el foco dentro, con una galería o un menú abierto ni con la página oculta; el temporizador se retira al abrir acceso o el panel. Respeta movimiento reducido y permite navegación manual. Se reservaron alturas iguales para evitar saltos verticales entre lugares.

Verificación: 45 pruebas dirigidas aprobadas y trece comprobaciones en el navegador habitual conectado a MySQL. Se probaron los cinco lugares, cinco imágenes distintas, filtros de Sorrento, ocho fotos, retorno a un menú real, reserva desde tarjeta y destacado, acceso/registro, cambio automático real, pausa, movimiento reducido y tamaños de 320, 390, 768, 1024, 1366 y 1440 px. Cero errores JavaScript, imágenes faltantes o escrituras a la API. Respaldos, capturas y resultados: work/destacados-20261112 del espacio de esta conversación. No se cambiaron la base, el servidor, los modelos ni Git. Los 25 estados conservan 22 comprobados, 2 parciales y 1 pendiente.

## Portada de una pantalla — versión 28

Por indicación del usuario, la portada vuelve a la distribución de su referencia: encabezado, texto y fotografía principal, buscador y tres tarjetas. Se integraron cafetos decorativos transparentes en las esquinas. La foto principal cambia cada cinco segundos entre trece imágenes; las tarjetas se desplazan cada dos segundos, mostrando los cinco lugares por turnos. En celular se muestra una tarjeta a la vez. Hay pausa y flechas para ambos carruseles, protección al interactuar y respeto de movimiento reducido.

Los clics en imagen o nombre de las tarjetas abren información del café sin registro. Las fotografías principales asociadas a un café también abren su ficha. Solo Reservar conduce a acceso/registro, conservando el restaurante elegido. Sorrento conserva sabores y ocho fotografías; no se creó un ID para reservas sin sus datos y mesas. Cómo reservar abre una guía sin extender la portada hacia abajo.

Verificación: 45 pruebas dirigidas y catorce comprobaciones en navegador con MySQL. Portada sin desplazamiento horizontal o vertical ni botones cortados a 1440×900, 1366×768, 1366×620, 1280×600, 1536×864, 1024×768, 390×844 y 320×700. Desplazamientos reales a dos/cinco segundos, trece imágenes, galerías, filtros y paso a reserva comprobados. Cero errores JavaScript, imágenes faltantes o escrituras a la API. Se corrigió un desbordamiento de cuatro píxeles causado por el adorno inferior y se ajustó la herencia tipográfica del titular antes de repetir el recorrido.

Respaldo y evidencia: work/portada-compacta-20261112 del espacio de esta conversación. Diseño y prompt del nuevo recurso en Portada_compacta.md. No se cambiaron base, servidor, modelos o Git. Los estados siguen en 22 comprobados, 2 parciales y 1 pendiente.

## Fotos completas y navegación por puntos — versión 29

Se retiraron de la portada los rótulos blancos sobre las fotos y los controles de pausa/flechas. Se sustituyeron por puntos pequeños inferiores con una posición activa y selección manual. La reproducción automática conserva cinco segundos para fotos y dos para tarjetas. La hoja de la nota se muestra rellena de verde. El crédito de la fotografía del Cocora se trasladó a Cómo reservar.

Las trece fotografías principales se muestran completas y centradas, manteniendo proporción. No se cambian los archivos: se ajustan al marco, con márgenes discretos cuando su proporción difiere. La portada conserva la altura de una pantalla, sin desplazar contenido hacia abajo.

Verificación: 45 pruebas dirigidas aprobadas y cinco grupos de comprobación en navegador conectado a MySQL. Se verificaron las trece fotos, selección y marcado de puntos, ausencia de controles/rótulos anteriores, hoja verde, acceso a Sorrento y menú real, paso a acceso para reservar, movimiento automático y tamaños 1440×900, 1366×620, 1280×600, 390×844 y 320×700. Sin errores JavaScript ni escrituras a la API. Evidencia y respaldo: work/fotos-completas-20261112 del espacio de esta conversación. Base, servidor, modelos y Git sin cambios. Los 25 estados se conservan.

## Fondo fotográfico suave — versión 30

Tras aprobar la propuesta, el usuario autorizó llenar los laterales vacíos con una versión desenfocada de la misma imagen. Se añadió una capa decorativa detrás de la foto: desenfoque de 20 px, saturación moderada y opacidad 0,48. La fotografía central conserva ajuste completo, proporción y nitidez. El fondo cambia con cada una de las trece imágenes y no captura clics ni se anuncia a lectores de pantalla. No se crearon archivos fotográficos adicionales.

Pasaron 45 pruebas dirigidas y los cinco grupos de comprobación de la portada habitual con MySQL. Se verificó la coincidencia entre fondo y foto en las trece posiciones, desenfoque solo de la capa trasera, navegación por puntos, fichas y acceso al reservar, movimiento automático y cinco tamaños de pantalla sin desbordamiento. Cero errores JavaScript y escrituras a la API. Captura del mismo plato señalado por el usuario y evidencia: work/fondo-fotografias-20261112 del espacio de esta conversación. No se modificaron datos, modelos, servidor o Git. Los 25 estados se conservan.

## Guardado completo en GitHub — versión 31

Por autorización expresa del usuario se guardó el estado completo de la carpeta principal y se publicó la rama avance-2026-11-12. Commit de implementación: 2210e60. La referencia remota se comprobó después de publicar. main continúa en 14bd06d, el avance de Luisa: ambas historias están conservadas y no se forzó una sustitución. La rama actual incluye los 57 archivos modificados o nuevos del avance local, sobre un proyecto de 74 archivos rastreables. Incluye código, esquema y datos ficticios, migraciones, fotografías, modelos exportados y documentación.

Se ejecutó la suite general: 136 pruebas aprobadas, cero fallidas y dos pruebas MySQL opcionales omitidas. Para este guardado no se activaron pruebas que escriben en bases de datos. La revisión de 53 archivos de texto no encontró claves privadas, tokens ni archivos de configuración privada rastreados. .env, credenciales.md, entorno-local.json, node_modules, registros y respaldos permanecen excluidos.

Se actualizó la guía de colaboración para que Luisa abra la rama correcta y configure su propio motor. GitHub comparte código y semillas, no el servidor ni la base local encendida de Jaider. La integración con main queda para una revisión separada; no impide consultar y trabajar desde esta rama. El punto 23 queda completado en su alcance de guardado/publicación: 23 comprobados, 1 parcial y 1 pendiente. El documento final y la aprobación/sustentación mantienen sus estados.

Respaldo del historial antes del guardado, revisión de archivos y log de pruebas: work/guardado-git-20261112 del espacio de esta conversación. La base de datos, los archivos privados y el servicio local no se modificaron para publicar.

## Carrusel continuo — versión 32

Se retiró Eje Cafetero y la raya del encabezado del catálogo. El movimiento de ida y vuelta se sustituyó por una vuelta continua: los cinco lugares pasan por las posiciones derecha, centro e izquierda. Se conserva el intervalo de dos segundos. La transición entre el último y el primero se realiza con tarjetas de continuidad, conservando botones y datos del mismo restaurante; no se crean restaurantes o reservas en la base. Los puntos representan los cinco grupos y el diseño sigue adaptándose a una tarjeta en celular. El foco dentro de una tarjeta se protege al cerrar la vuelta.

Verificación: 46 pruebas dirigidas aprobadas y seis grupos de comprobación en navegador con MySQL. Se observó el ciclo automático 0,1,2,3,4,0,1, sin reversa ni huecos. Sorrento se comprobó en las tres posiciones. La tarjeta repetida del inicio abrió el menú de Café La Palma y conservó su identificador al pasar al acceso para reservar. Filtros y galería de Sorrento siguen funcionando, y cambiar tamaños de computador/celular no acumula tarjetas de continuidad. Cero errores JavaScript o escrituras a la API.

Respaldo, capturas de Sorrento a derecha/centro/izquierda y ciclo observado: work/carrusel-continuo-20261112 del espacio de esta conversación. No se modificaron base, servidor o modelos. Este ajuste posterior al guardado de 7d03c51 sigue local; no se publicó otra vez sin una nueva solicitud. Los estados actuales son 22 comprobados, 2 parciales y 1 pendiente.

## Formulario y horas de reserva — versión 33

Se aplicó el orden solicitado: restaurante, fecha, hora, cantidad de personas y mesas disponibles. La hora se selecciona con radios en casillas de quince minutos. El usuario confirmó los rangos de inicio de prueba: cafés 08:00–22:00 y restaurantes 11:30–23:00. Se mantienen selección de varias mesas, consulta de disponibilidad y capacidad. Las horas guardadas no se alteran automáticamente al editar; cambiar el día obliga a seleccionar otra hora válida. El modal permite desplazamiento interno en pantallas pequeñas.

Alcance limitado al formulario y sus manejadores del navegador. Hashes de server.js, schema.sql y lib/reservas.js idénticos antes/después. No hubo migraciones ni cambios de modelos, servidor o base habitual. Los rangos no incorporan horarios reales por día ni una nueva regla de cierre; tampoco modifican el turno de dos horas.

Validación: 47 pruebas dirigidas aprobadas y siete comprobaciones en navegador con la copia MySQL de revisión. Se creó una reserva de prueba a las 08:15 y se editó a las 08:30; se verificaron personas, mesa e identificador. Se probó una hora antigua de 08:42 para garantizar su conservación al editar y su retiro al elegir otro día. La cuenta, reserva y registros auxiliares se retiraron y se compararon las filas anteriores de las 23 tablas por conteos y hashes. Cero errores JavaScript; ningún pedido de prueba alcanzó la base habitual.

Evidencia, capturas y respaldo: work/reservas-horas-20261112 del espacio de esta conversación. Detalles: Reservas_horarios.md. El ajuste permanece local, posterior al último guardado autorizado. Los estados conservan 22 comprobados, 2 parciales y 1 pendiente.

## Café Sorrento incorporado — versión 34

Se incorporó Sorrento a la base habitual y a los datos de instalación, conservando las filas previas. Mall Privilegio, Armenia, oferta y horario 08:30–22:30 proceden de Jaider. Por su última indicación se configuraron diez mesas: cinco de dos personas y cinco de cuatro, total 30 cupos provisionales. El administrador puede gestionar el café; la cuenta técnica de restaurante queda por asignar. Dirección exacta, contacto, precios y aforo real siguen por confirmar. No se añadieron ventas o visitas ficticias del café.

La portada usa el identificador real recibido de la API y conserva fotos, menú informativo y acceso al reservar. El selector de reserva muestra Sorrento, diez mesas combinables e inicios de 08:30 a 20:30 para terminar las dos horas a las 22:30. Los rangos de los demás lugares siguen iguales. El esquema y los dos modelos no cambiaron.

Verificación: 140 pruebas aprobadas, dos opcionales MySQL omitidas y cero fallidas; tras el ajuste final de presentación, 28 pruebas de exploración aprobadas. Además, recorrido real en la copia MySQL: incorporación con respaldo, repetición sin duplicados, galería, acceso y reserva para seis con mesas de 2+4; ambas mesas se bloquean. Se retiraron los registros de prueba y se preservaron las filas previas de sus 23 tablas por hashes. En la base habitual se comparó el respaldo con las filas posteriores: únicamente una zona, una cuenta, un restaurante y diez mesas nuevas. Sus 23 tablas conservaron las filas anteriores. La portada habitual se comprobó sin escrituras a la API.

Evidencia: work/incorporar-sorrento-20261112 del espacio de esta conversación. Detalle y comando incremental para otro equipo en Cafe_Sorrento.md. Los cambios permanecen locales. Los estados se mantienen en 22 comprobados, dos parciales y uno pendiente.

## Versión actual como principal en GitHub — versión 35

Jaider solicitó publicar todos los avances y reemplazar el contenido principal anterior por su versión actual, para que Luisa continúe desde esta base. Se adopta íntegramente el árbol de trabajo de Jaider y se conserva 14bd06d como parte del historial recuperable. No se reintroducen planes ni se sustituye la aplicación vigente por la versión antigua.

El cierre incluye carrusel continuo, fotografías, selector de horas, incorporación incremental de Sorrento, diez mesas provisionales, semillas, pruebas y documentación actualizada. La guía de equipo ahora señala main y distingue instalación nueva de actualización de una base existente. La evidencia funcional más reciente conserva 140 pruebas aprobadas, dos MySQL opcionales omitidas y las comprobaciones reales de Sorrento en la copia MySQL.

El punto 23 pasa a comprobado en su alcance de publicación: 23 comprobados, un parcial y un pendiente. Continúan pendientes el documento final y la aprobación/práctica de sustentación. La base encendida, las credenciales y los respaldos locales no se publican en GitHub. Se conserva respaldo del historial y evidencia de referencias remotas en work/guardado-main-20261112 del espacio de esta conversación.
