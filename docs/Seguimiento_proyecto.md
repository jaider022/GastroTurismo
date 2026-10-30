# Seguimiento del proyecto final — GastroTurismo

**Versión 9 — 29 de octubre de 2026.** Este es el listado vigente para continuar y marcar avances. Sustituye como seguimiento al checklist del 27 de octubre, que se conserva como revisión histórica.

**Autorización del usuario:** el 29 de octubre indicó «ya puedes guardar en git», autorizando el guardado y publicación de los avances actuales. Se mantiene un respaldo local separado y se excluyen credenciales, configuración privada y archivos personales.

Proyecto revisado: la carpeta **Bases de datos** del escritorio, abierta en Antigravity. Los avances de la copia separada de Documents no se cuentan como terminados en este proyecto.

Equipo: Jaider Arley Montes y Luisa Fernanda Castañeda. Profesora: Alexandra Ruiz. Caso elegido: **restaurantes y gastronomía turística**.

Fuente académica: `Proyecto final BD1 - 2026-2.pdf`, revisión de 7 páginas entregada por el usuario. Exige mínimo 10 entidades fuertes, operaciones sobre 4 tablas importantes, 10 reportes (3 simples, 4 intermedios y 3 con subconsultas), exportación PDF, acceso validado, plantillas, datos coherentes y documento/sustentación. Los gráficos en tres reportes dan bonificación.

## Cómo leer los estados

- ✅ Comprobado en el alcance descrito. Una prueba visual o aislada no certifica toda la integración con MySQL.
- 🟡 Existe una parte; falta completar, corregir o validar lo indicado.
- ☐ Pendiente: todavía no está hecho o no está verificado.

La conexión con MySQL se deja **para después por indicación del usuario**. El servidor de la aplicación volvió a responder y se comprobó la edición de mesas en **modo demo**; esto no constituye una prueba de MySQL.

## Listado vigente

| ID | Estado | Trabajo | Qué está y qué queda |
|---|---|---|---|
| 01 | ✅ | Apariencia e inicio de sesión | Tema marfil, menú verde, fotografía del Cocora y tarjeta renovada comprobados en navegador. Se conserva visible la información de demostración, por indicación del usuario. |
| 02 | ✅ | Listado de reservas | Diez filas por página, búsqueda, filtros de estado/fecha, contador y orden reciente. Probado con 364 reservas de demostración. |
| 03 | ✅ | Listado de pedidos | Paginación, filtro por restaurante y fechas, contador y orden reciente. Probado con 352 pedidos de demostración. |
| 04 | ✅ | Listado de asistencia real | Paginación, filtro por restaurante/fechas y suma de personas de todos los resultados. Probado con 672 visitas y 2.387 personas de demostración. |
| 05 | ✅ | Datos de ejemplo coherentes | Semilla de 16 tablas con nombres, teléfonos, fechas, relaciones e importes coherentes. Las pruebas aisladas de datos pasan. |
| 06 | 🟡 | Acceso, registro y perfil básico | Existen registro, contraseña protegida, sesión y cierre; pruebas aisladas del acceso aprobadas. Falta repetir el recorrido con la base real. El perfil muestra nombre/rol; su edición no se exige expresamente en el enunciado. |
| 07 | 🟡 | Administrar restaurantes | Las cuatro operaciones existen en pantalla y servidor. Falta comprobar permisos por propietario y el ciclo completo con relaciones existentes. |
| 08 | ✅ | Administrar mesas desde pantalla | Añadidos botón Editar, carga de datos y guardado por PUT. Se editan número, capacidad y ubicación conservando identificador, restaurante y estado. Se comprueban duplicados y reducciones de capacidad incompatibles con reservas activas desde la interfaz. Cinco pruebas aisladas aprobadas y guardado visual en demo comprobado. Permisos de servidor y prueba MySQL siguen separados en 15, 21 y 25. |
| 09 | ✅ | Administrar platos desde pantalla | Añadida sección Platos y menú para administrador/propietarios, con crear, consultar, editar, disponibilidad, búsqueda y paginación. Al editar conserva identificador/restaurante. Eliminar se permite en platos sin pedidos; los platos con historial se conservan y pueden desactivarse. Pasaron 13 pruebas aisladas con la API demo real. Formulario, edición, filtros, protección del historial y continuidad del menú/carrito comprobados en navegador. Permisos de servidor y MySQL siguen en 15/21/25. |
| 10 | 🟡 | Reglas de las reservas | Crear, consultar, editar y cancelar existen. Falta validar en servidor aforo, fechas y solapamientos, y mantener coherentes los estados de las mesas. Las validaciones de asistencia no sustituyen estas reglas. |
| 11 | 🟡 | Pedidos y delivery | Existe selección de platos, carrito, dirección de entrega y cálculo del total en servidor. Falta completar permisos de cambios de estado y pruebas integradas. |
| 12 | 🟡 | Reportes y gráficas | Verificada la clasificación de 3 simples (1–3), 4 intermedios (4–7) y 3 con subconsultas (8–10), además de los comparativos 11/12 y gráficas 6/9/10. Corregidas diferencias de cálculo entre demo y SQL, precios exportables, promedio de vendidos y población VIP. El SQL mostrado coincide con el servidor. Pasaron 16 pruebas nuevas, comparando los diez reportes contra SQL en memoria. Falta la ejecución final en MySQL; clasificación y criterios documentados en Reportes_academicos.md. |
| 13 | ✅ | Exportación básica de reportes | La exportación de tabla y criterios está implementada; un PDF de reporte se generó y revisó en el avance anterior. La revisión final de todos los reportes con datos reales queda en el punto 25. Incluir gráficas dentro del PDF no se identificó como requisito expreso. |
| 14 | ✅ | Comprobantes y factura | Vista previa y descarga comparten una copia del mismo registro consultado. Una selección vacía, error o respuesta antigua no permite descargar el documento anterior. Se normalizan importes numéricos de la API y se conserva el total registrado, sin añadir un desglose de impuestos ausente en los datos. Pasaron 12 pruebas aisladas y se descargaron/revisaron visualmente un comprobante y una factura en demo. Integración MySQL pendiente en 21/25. |
| 15 | 🟡 | Permisos de clientes y propietarios | Notificaciones ya exige sesión y limita lectura/marcado al destinatario, también para administradores; comprobado en pruebas aisladas. Falta aplicar rol y propiedad en consultas y cambios de los demás módulos antiguos; ocultar botones no completa esta protección. |
| 16 | 🟡 | Coherencia de los dos modelos | Existen entidad-relación y relacional. Falta cerrar la comparación con las 16 tablas, representar accesos al sistema y revisar la obligatoriedad/exclusividad de pedido o plan en pagos. |
| 17 | ✅ | Explorar antes de registrarse | Añadida entrada desde el inicio para explorar restaurantes, buscar sin tildes y consultar sus platos disponibles. Reservar solicita acceso/registro y conserva el restaurante; después abre el formulario existente sin guardar una reserva automáticamente. La selección sobrevive a una recarga o un acceso fallido; se informa si el restaurante dejó de existir. Pasaron 15 pruebas aisladas, incluida la apertura del formulario original. Falta revisión visual e integración MySQL en 25. |
| 18 | ☐ | Experiencias gastronómicas | No se encontró un flujo explícito de experiencias en el proyecto principal. Falta acordar el alcance del caso con la profesora e implementarlo. |
| 19 | 🟡 | Planes y pagos | Existen catálogos y medios de pago; el pago es simulado. Falta contratar un plan para un restaurante concreto, controlar su vigencia y verificar importes/pertenencia de pagos. Confirmar con la profesora si exige una pasarela real. |
| 20 | 🟡 | Notificaciones y recordatorios | Avisos organizados con cinco por página, filtros Pendientes/Todas/Leídas, orden reciente y contador. Botón explícito de marcado, errores controlados y limpieza al salir/cambiar de sesión. Servidor y demo limitan consulta y marcado a las notificaciones propias. Existe aviso al crear una reserva; faltan los recordatorios programados y comprobar este recorrido con MySQL. |
| 21 | 🟡 | Servidor local y MySQL | La aplicación responde en localhost:3001 en modo demo. Falta comprobar conexión MySQL y ejecutar pruebas con la base académica. No se arrancó MySQL en esta revisión. |
| 22 | ☐ | Documento final | No se encontró un informe completo en la plantilla exigida entre los archivos revisados. Falta desarrollar y revisar el documento con integrantes, profesora, modelos, requisitos y evidencias. |
| 23 | ✅ | Guardar los últimos avances en GitHub | Con autorización del usuario se incorporan a main los puntos 09 y 17, los avances de 12/20, sus pruebas y el seguimiento actualizado. Repositorio: jaider022/GastroTurismo. El respaldo local separado se conserva; credenciales, configuración privada y archivos personales siguen excluidos. |
| 24 | ☐ | Aprobación y sustentación | Falta dejar constancia de aprobación de requisitos por la profesora y preparar/practicar la explicación de ambos integrantes. La asesoría y las preguntas preparadas son avances, no una sustentación realizada. |
| 25 | 🟡 | Pruebas finales | Pasaron 24 pruebas base, 5 de mesas, 12 de documentos, 13 de platos, 15 de exploración, 21 de notificaciones y **16 nuevas de reportes académicos**, en sus revisiones respectivas. En esta revisión también pasaron las 8 pruebas existentes de comparativos/demo. Las consultas 1–10 se ejecutaron contra un motor SQL independiente en memoria con equivalentes de funciones MySQL; no es validación del motor MySQL real. Faltan las revisiones visuales nuevas y las pruebas completas por rol y módulos contra MySQL. |

## Orden de trabajo propuesto

1. **08 y 09 completados en pantalla:** edición de mesas y administración de platos. Las cuatro tablas principales propuestas siguen siendo restaurantes, mesas, platos y reservas; la revisión de sus reglas y permisos en servidor permanece pendiente.
2. **14: comprobantes y factura completados**, compartiendo los datos entre vista previa y descarga. Se adelantó esta corrección por su alcance acotado mientras se espera la revisión de la profesora.
3. **17 completado en código y pruebas aisladas:** explorar antes del registro y continuar con el restaurante elegido. Se adelantó por su alcance acotado, siguiendo la indicación de hacer primero los puntos más sencillos.
4. **15 y 10: permisos y reglas de reservas**, pendientes para una revisión de mayor alcance, con comprobaciones aisladas antes de la integración.
5. **20 adelantado en su parte sencilla:** listado de notificaciones y permisos de destinatario. Los recordatorios programados siguen pendientes. **18 y 19: experiencias y planes/pagos**, según el alcance académico acordado.
6. **16 y 22: modelos y documento**, ajustados a lo que quede realmente implementado.
7. **21 y 25: conexión y prueba integral**, en la jornada que se acuerde; después revisión de reportes y cierre de entrega.
8. **23 completado con autorización del usuario:** guardado y publicación de los avances actuales en GitHub. Mantener **24: preparación de la sustentación**, actualizando evidencias durante el trabajo.

## Verificación de esta revisión

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

Al terminar una tarea se conserva su ID, se actualiza su estado con la comprobación realizada y se vuelve a mostrar el listado vigente al usuario. No se marca terminado lo que solo esté propuesto o exista en otra copia del proyecto.
