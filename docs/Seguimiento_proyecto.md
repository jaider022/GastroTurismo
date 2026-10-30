# Seguimiento del proyecto final — GastroTurismo

**Versión 2 — 29 de octubre de 2026.** Este es el listado vigente para continuar y marcar avances. Sustituye como seguimiento al checklist del 27 de octubre, que se conserva como revisión histórica.

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
| 09 | 🟡 | Administrar platos y menú | El menú se consulta y existen operaciones en servidor. Falta la **pantalla para crear, editar y eliminar platos**. |
| 10 | 🟡 | Reglas de las reservas | Crear, consultar, editar y cancelar existen. Falta validar en servidor aforo, fechas y solapamientos, y mantener coherentes los estados de las mesas. Las validaciones de asistencia no sustituyen estas reglas. |
| 11 | 🟡 | Pedidos y delivery | Existe selección de platos, carrito, dirección de entrega y cálculo del total en servidor. Falta completar permisos de cambios de estado y pruebas integradas. |
| 12 | 🟡 | Reportes y gráficas | Hay 12 opciones, comparativos mensuales y gráficas en 6, 9 y 10. Falta el recorrido final con MySQL y validar la clasificación exigida de 3 simples, 4 intermedios y 3 con subconsultas. |
| 13 | ✅ | Exportación básica de reportes | La exportación de tabla y criterios está implementada; un PDF de reporte se generó y revisó en el avance anterior. La revisión final de todos los reportes con datos reales queda en el punto 25. Incluir gráficas dentro del PDF no se identificó como requisito expreso. |
| 14 | 🟡 | Comprobantes y factura | La vista previa consulta la API; la descarga vuelve a la copia del navegador. Falta que ambas usen el mismo registro para evitar documentos antiguos o diferentes. |
| 15 | 🟡 | Permisos de clientes y propietarios | El acceso general está protegido parcialmente. Falta aplicar rol y propiedad en consultas y cambios de los módulos antiguos; ocultar botones no completa esta protección. |
| 16 | 🟡 | Coherencia de los dos modelos | Existen entidad-relación y relacional. Falta cerrar la comparación con las 16 tablas, representar accesos al sistema y revisar la obligatoriedad/exclusividad de pedido o plan en pagos. |
| 17 | ☐ | Explorar antes de registrarse | Propuesta del usuario: ver restaurantes, elegir y pedir acceso/registro al confirmar, conservando la selección. Todavía no está implementada. Es una mejora del recorrido, no un requisito adicional de la profesora. |
| 18 | ☐ | Experiencias gastronómicas | No se encontró un flujo explícito de experiencias en el proyecto principal. Falta acordar el alcance del caso con la profesora e implementarlo. |
| 19 | 🟡 | Planes y pagos | Existen catálogos y medios de pago; el pago es simulado. Falta contratar un plan para un restaurante concreto, controlar su vigencia y verificar importes/pertenencia de pagos. Confirmar con la profesora si exige una pasarela real. |
| 20 | 🟡 | Notificaciones y recordatorios | Existe aviso al crear una reserva. Faltan recordatorios programados y completar permisos de lectura/marcado. |
| 21 | 🟡 | Servidor local y MySQL | La aplicación responde en localhost:3001 en modo demo. Falta comprobar conexión MySQL y ejecutar pruebas con la base académica. No se arrancó MySQL en esta revisión. |
| 22 | ☐ | Documento final | No se encontró un informe completo en la plantilla exigida entre los archivos revisados. Falta desarrollar y revisar el documento con integrantes, profesora, modelos, requisitos y evidencias. |
| 23 | 🟡 | Guardar los últimos avances en GitHub | Hay repositorio local y seguimiento de `origin/main`. Los cambios recientes de interfaz, foto y documentación siguen sin registrar en un nuevo commit; falta guardarlos y comprobar su publicación. |
| 24 | ☐ | Aprobación y sustentación | Falta dejar constancia de aprobación de requisitos por la profesora y preparar/practicar la explicación de ambos integrantes. La asesoría y las preguntas preparadas son avances, no una sustentación realizada. |
| 25 | 🟡 | Pruebas finales | Pasaron 24 pruebas base y después **5 pruebas específicas de edición de mesas**. También se comprobó su formulario y guardado en demo. Faltan pruebas completas por rol, cuatro tablas, reservas, documentos y reportes contra MySQL. |

## Orden de trabajo propuesto

1. **08: edición de mesas completada en pantalla.** Sigue **09: administración de platos**, para cerrar las pantallas de las cuatro tablas principales propuestas: restaurantes, mesas, platos y reservas.
2. **14: comprobantes y factura**, unificando el origen de los datos.
3. **15 y 10: permisos y reglas de reservas**, con comprobaciones aisladas antes de la integración.
4. **17: explorar antes del registro**, enlazando cada reserva con su usuario y mesa, sin perder la selección al acceder.
5. **18, 19 y 20: experiencias, planes/pagos y recordatorios**, según el alcance académico acordado.
6. **16 y 22: modelos y documento**, ajustados a lo que quede realmente implementado.
7. **21 y 25: conexión y prueba integral**, en la jornada que se acuerde; después revisión de reportes y cierre de entrega.
8. **23 y 24: publicación del avance y preparación de la sustentación**, actualizando evidencias durante el trabajo.

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

## Registro de avances

| Versión | Fecha | Cambio |
|---|---|---|
| 1 | 29/10/2026 | Listado inicial actualizado, pendientes diferenciados y 24 pruebas aisladas aprobadas. |
| 2 | 29/10/2026 | Punto 08 terminado en pantalla, 5 pruebas nuevas aprobadas y guardado en modo demo comprobado. Punto 21 actualizado: servidor disponible, MySQL pendiente. |

Al terminar una tarea se conserva su ID, se actualiza su estado con la comprobación realizada y se vuelve a mostrar el listado vigente al usuario. No se marca terminado lo que solo esté propuesto o exista en otra copia del proyecto.
