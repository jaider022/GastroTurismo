# Trazabilidad de requisitos — GastroTurismo

**Actualización del 12 de noviembre de 2026.** Proyecto principal: `C:\Users\Jaider\Desktop\Bases de datos`. Esta matriz relaciona el documento de la profesora, la implementación y la evidencia disponible. Complementa los 25 puntos de [Seguimiento del proyecto](Seguimiento_proyecto.md); el número de puntos verdes no representa un porcentaje de la nota ni del cumplimiento académico.

La última actualización visual del 12/11 mantiene la portada de una pantalla y muestra completas las trece fotos principales, sin recorte ni deformación y con márgenes discretos cuando son necesarios. Se retiraron los rótulos blancos y botones de pausa/flechas, sustituidos por puntos inferiores para indicar y elegir la posición. Las fotos continúan a cinco segundos y las tarjetas a dos, entre cinco lugares. La hoja de la nota tiene relleno verde. Se conservan fichas sin cuenta, acceso al reservar, filtros y ocho fotos de Sorrento, sin inventar sus datos de operación ni ID. Los cuatro restaurantes de la base mantienen sus reservas. La última revisión pasó 45 pruebas dirigidas y cinco grupos de comprobación de navegador con MySQL, sobre fotos/puntos, limpieza visual, fichas y reserva, cinco tamaños de pantalla y reproducción automática; sin errores JavaScript o escrituras a la API. Se conserva como evidencia anterior el recorrido más amplio de catorce verificaciones. No cambia el esquema, los modelos ni los requisitos académicos pendientes. Detalle de imágenes y prompts en [Recursos visuales](Recursos_visuales_inicio.md).

**Actualización posterior del mismo día:** Sorrento ya está incorporado en la base habitual con identificador real, diez mesas combinables (cinco de 2 y cinco de 4) y 30 cupos provisionales autorizados. Son cinco restaurantes y 34 cuentas, incluida una cuenta técnica de gestión por asignar. Mall Privilegio, Armenia y horario 08:30–22:30 son datos comunicados por Jaider; dirección exacta, contacto, precios y aforo real quedan pendientes. Se conservan todas las filas previas de las 23 tablas y no se inventa historial del café. Suite actual: 140 aprobadas y dos opcionales omitidas; además recorrido real de reserva 2+4 en copia MySQL y comprobación de la portada habitual. El párrafo visual anterior documenta la evidencia previa a esta incorporación. Detalle: [Café Sorrento](Cafe_Sorrento.md). No cambia el esquema ni los modelos.

## Fuente y criterio de revisión

Se leyó completo el documento **Proyecto final BD1 - 2026-2.pdf**, de 7 páginas, de la carpeta `Nuevo Semestres\semestre 6\Bases de datos 1\Proy final`. La copia del repositorio es idéntica: SHA-256 `46b0a7c13a8677f6fab970027d1205f9656bb9615d64b41d9adc72d118b75abc`.

Las páginas citadas son las del archivo PDF, contando la portada como página 1. La auditoría documental comenzó el 10 de noviembre. El 11 se integraron experiencias, se ampliaron y ejecutaron las pruebas y se aplicó la migración después de un respaldo. Se verificaron las filas conservadas, los dos modelos y la base habitual. Oracle abrió y guardó el diseño con los tipos reparados. El blanco quedó contrastado y validado con las reglas originales de EERCASE: cero incumplimientos después de corregir Reserva–Visita y once campos obligatorios de experiencias. Posteriormente se recargó y validó en EERCASE: el panel quedó con 0 problemas. El punto 25 también completó las 16 operaciones desde pantallas con cuenta administradora y MySQL en la copia de revisión.

- **✅ Comprobado:** existe implementación y evidencia para el alcance descrito.
- **🟡 Parcial:** existe una parte; se indica la prueba, función o decisión que falta.
- **☐ Pendiente:** falta el recorrido o la evidencia requerida.

## Requisitos generales de la profesora

| ID | Fuente y requisito | Estado | Implementación y evidencia | Qué falta para cerrarlo | Puntos del listado |
|---|---|---|---|---|---|
| R01 | Pág. 2: grupo de máximo tres estudiantes; admite parejas. | ✅ | Equipo declarado: Jaider Arley Montes y Luisa Fernanda Castañeda. | Conservar estos nombres en la entrega. La declaración del equipo no sustituye la sustentación individual. | 22, 24 |
| R02 | Pág. 2: sistema web o de escritorio con base de datos, como MySQL, SQL Server u Oracle. | ✅ | Aplicación web Express; conexión habitual comprobada a `gastronomia_turistica_academica`. Motor real: MariaDB 10.4.32, compatible con MySQL. Consulta de estado y conteos realizada en esta revisión. | La guía no exige alojar la base en internet. Identificar el motor con su nombre real al sustentarlo. | 21 |
| R03 | Pág. 2: mínimo diez entidades fuertes en el modelo ER. | ✅ | EERCASE contiene 20 entidades con identificador propio y tres subtipos de Usuario, representados en una sola tabla mediante tipo_usuario. Atributos, claves y relaciones contrastados con las 22 tablas y 31 FK del esquema y Oracle. Reglas originales de EERCASE ejecutadas sobre el archivo corregido: cero incumplimientos. | Integrar los modelos en el documento (22) y practicar su explicación con ambos integrantes (24). | 16 |
| R04 | Pág. 2: registrar, consultar, modificar y eliminar información de cuatro tablas importantes del negocio. | ✅ | Restaurantes, mesas, platos y reservas tienen las 16 operaciones. Pruebas de API con MySQL comprueban también edición/eliminación de reservas, asignación múltiple y eliminación de platos sin historial con rechazo si tienen pedidos. | Las 16 operaciones desde pantallas ya pasaron con cuenta administradora. Ambos integrantes deben practicar su demostración y explicar permisos e integridad (24). | 07–10, 15, 25 |
| R05 | Pág. 2: entregar los requerimientos al docente previamente para su aprobación. | ☐ | Existe asesoría y están identificadas las cuatro tablas propuestas. | Dejar los requerimientos funcionales en un listado para la profesora y registrar su aprobación o sus ajustes. No se encontró constancia de aprobación final. | 24 |
| R06 | Págs. 2–3: mínimo diez reportes: tres simples, cuatro intermedios y tres complejos con subconsultas. | ✅ | Reportes 1–3 de una tabla; 4–7 multitabla con agrupaciones/agregados; 8–10 con subconsultas. Los doce reportes, incluidos los dos adicionales, ejecutaron en MySQL compatible. Clasificación y SQL en [Reportes académicos](Reportes_academicos.md); pruebas en `tests/reportes-academicos.test.js` y `tests/mysql.integration.test.js`. | Explicar los criterios de negocio de cada reporte. El reporte 6 suma pedidos entregados; el 7 cuenta el estado guardado de las mesas. No equivalen, respectivamente, a caja recaudada ni a disponibilidad por horario. | 12 |
| R07 | Pág. 2: reportes completos, con estética y visibles en la aplicación. | ✅ | Pantalla de reportes con tablas, títulos, resultados y gráficas; revisión de interfaz y reporte de ingresos del propietario. El servidor limita los datos al rol correspondiente. | La aceptación estética corresponde a la profesora. Revisar la presentación de todos los reportes forma parte del cierre final. | 01, 12, 15, 25 |
| R08 | Pág. 2: reportes exportables a PDF. | ✅ | Los doce reportes se descargaron desde la interfaz con MySQL y se revisaron visualmente sus 14 páginas, incluidos títulos, criterios, cifras y continuación de tablas. | Repetir la comprobación si cambia el exportador o la estructura de los reportes. | 13, 25 |
| R09 | Pág. 3: inicio de sesión con usuario y contraseña validados. | ✅ | Registro de sesión, contraseña protegida, validación de credenciales, consulta del usuario y cierre de sesión. Pruebas de API/MySQL y recorrido de cliente, propietario y administrador. | Mantener estas comprobaciones al incorporar módulos nuevos. | 06, 15 |
| R10 | Pág. 3: plantillas para documentos relacionados con el sistema. | ✅ | Comprobante de reserva y factura de pedido. Descarga desde datos reales de la aplicación; ambos PDF revisados. El comprobante probado identifica dos mesas y seis comensales. | No se identificó una obligación de implementar todos los ejemplos de documentos que enumera la guía. La factura actual es una plantilla académica del pedido. | 14 |
| R11 | Pág. 3: ejemplos de datos coherentes con lo que representa cada campo. | ✅ | Semilla de 22 tablas con nombres, teléfonos, menús, fechas, importes y relaciones coherentes. Base habitual: 34 cuentas, 5 restaurantes, 364 reservas de mesas, 352 pedidos, 320 pagos, 672 visitas y seis actividades, tres próximas. Sorrento incorpora diez mesas y 30 cupos provisionales; su contacto y precios no se inventaron. Se conservaron las filas anteriores de 23 tablas. | Mantener explícitos los datos provisionales y por confirmar de Sorrento. No se crearon reservas ni cobros ficticios nuevos en la base habitual. | 05, 21 |
| R12 | Pág. 6: registro y perfil con datos básicos. | ✅ | Nombre, correo, teléfono y contraseña al crear la cuenta; sesión identifica al usuario y su rol. Consulta del perfil autenticado en `/api/auth/me`. | No hay panel completo de edición del perfil. Ese panel no se exige expresamente en el texto revisado. | 06 |
| R13 | Pág. 6: recordatorios y notificaciones personalizados según las necesidades del usuario. | 🟡 | Avisos privados al destinatario, cambios de reserva y recordatorios automáticos de reservas activas dentro de las próximas 24 horas; consulta/marcado de lectura y pruebas de no duplicación. | Confirmar si la personalización por usuario y reserva satisface el alcance o si pide preferencias de anticipación/canal. Actualmente el plazo es fijo y el servidor debe estar activo; no hay elección de canal o anticipación por el usuario. | 20, 24 |
| R14 | Pág. 6: diversidad de planes. | 🟡 | Los planes fueron retirados por decisión expresa del equipo. La aplicación, el esquema principal y los modelos vigentes funcionan sin suscripciones. La asesoría trató la simplificación de pagos. | Obtener confirmación expresa de que los planes pueden quedar fuera del alcance de este caso. La guía general todavía los menciona; no se puede marcar esa excepción como aprobada. Conservar la decisión vigente mientras se aclara. | 16, 19, 24 |
| R15 | Pág. 6: pago online y diversidad de medios de pago. | 🟡 | Catálogo de medios y abonos a pedidos, con validación del saldo y referencia para evitar duplicados. Pago vinculado directamente a Pedido mediante ABONA. | El cobro es simulado, sin confirmación de una pasarela. Acordar si la simulación es suficiente para la materia o si requiere integración de pago online. La guía no especifica proveedor ni procedimiento de certificación. | 19, 24 |
| R16 | Pág. 3: documento en la plantilla del proyecto. | 🟡 | Borrador previo de Word con Municipio, catálogos, varias mesas y ABONA. Los modelos y la documentación técnica ya incluyen experiencias. | Incorporar experiencias al Word e integrar requisitos, diagramas y evidencias en la plantilla oficial, que aún no se identificó en los archivos examinados. El usuario aplazó esta etapa de entrega. | 22 |
| R17 | Pág. 3: sustentación por los integrantes del grupo. | ☐ | Hay preguntas de asesoría y borrador del caso de estudio. | Preparar y ensayar con ambos integrantes la explicación del problema, modelos, operaciones, consultas y reportes. La asesoría no sustituye la sustentación. | 24 |

**Bonificación B01 — pág. 3:** ✅ Hay tres gráficas, en los reportes 6, 9 y 10. Están implementadas y se verificó previamente su presentación. No se encontró una exigencia expresa de incluir las gráficas dentro del PDF; la exportación actual contiene la tabla y los criterios.

## Alcance del caso escogido

La página 4, caso **4. Restaurantes y gastronomía turística**, menciona estos cuatro componentes. Las otras opciones de plataforma de las páginas 4 y 5 no se agregan como requisitos de GastroTurismo.

| ID | Componente | Estado | Evidencia y límite | Puntos |
|---|---|---|---|---|
| C01 | Reservas de mesas | ✅ | Fecha/hora, varias mesas de un restaurante, capacidad conjunta, aforo simultáneo, cruce de horarios y permisos. La aplicación usa turnos de dos horas; confirmar esa duración con la profesora. | 02, 10, 17 |
| C02 | Gestión de menús | ✅ | Consulta pública y administración de platos: creación, edición, precio, categoría y disponibilidad. Los platos con pedidos se conservan para proteger el historial. | 09 |
| C03 | Experiencias gastronómicas para turistas | ✅ | Actividades publicadas/editadas por restaurante, consulta y filtros, reserva/cancelación de cupos y registro de pago presencial. Concurrencia, precio confirmado, privacidad y reintentos comprobados. Recorrido de los tres perfiles en la interfaz y migración aplicada conservando datos. Guía en [Experiencias gastronómicas](Experiencias_gastronomicas.md). | 18 |
| C04 | Delivery en zonas turísticas | ✅ | Restaurante asociado a zona; pedido a domicilio con dirección obligatoria, importes del menú y estados despachar/entregar. Recorrido real de cliente y propietario comprobado. La guía no exige mapa ni rastreo de repartidores. | 03, 11 |

## Las cuatro tablas principales: implementación y prueba

En todas existen las cuatro operaciones. Esta tabla distingue la implementación de la comprobación completa en la base real.

| Tabla | Registro y consulta | Modificación | Eliminación | Evidencia pendiente |
|---|---|---|---|---|
| Restaurantes | MySQL y formulario comprobados. | MySQL y formulario comprobados; el administrador conserva al propietario. | Eliminación autorizada sin dependencias y rechazo de acceso ajeno comprobados en la API real. | Cuatro operaciones desde pantalla aprobadas en el punto 25. Practicar su explicación en 24. |
| Mesas | MySQL y formulario comprobados. | MySQL y pruebas de interfaz; capacidad y mantenimiento protegen reservas activas. | Eliminación autorizada sin dependencias y rechazo a cliente comprobados en la API real. | Cuatro operaciones desde pantalla aprobadas en el punto 25. Practicar su explicación en 24. |
| Platos | MySQL, formulario y consulta de menú comprobados. | MySQL y pruebas de interfaz; disponibilidad e historial cubiertos. | API real: eliminación autorizada sin historial, rechazo por pedidos y por propietario ajeno. Al desactivar se conserva el detalle del pedido. | Cuatro operaciones desde pantalla aprobadas en 25; practicar su explicación en 24. |
| Reservas | MySQL e interfaz: reserva de dos mesas, lectura por usuario y rechazo de cruce/aforo comprobados. | API real: mismo identificador y dos asignaciones conservadas; rechazo de capacidad inválida y confirmación no autorizada. | API real: eliminación autorizada de pendiente, retirada de filas del puente y rechazo del registro inexistente. | Cuatro operaciones desde pantalla aprobadas en 25. Confirmar el turno de dos horas y practicar en 24. |

Las restricciones por historial son reglas de integridad. Para demostrar la eliminación se usan registros de prueba sin dependencias; cancelar una reserva o desactivar un plato con historial no reemplaza la demostración de la operación eliminar donde esté permitida.

### Requerimientos para presentar a aprobación

Esta es la propuesta del equipo basada en el alcance actual. **Pendiente de aprobación de la profesora; no es una aprobación registrada.**

| ID funcional | Requerimiento propuesto | Criterio de aceptación |
|---|---|---|
| RF01 | Permitir al administrador y al propietario autorizado registrar, consultar, modificar y eliminar restaurantes. | Validar datos y zona; limitar los cambios del propietario a sus establecimientos; conservar al propietario al editar como administrador; impedir una eliminación que vulnere registros relacionados. |
| RF02 | Permitir al personal autorizado registrar, consultar, modificar y eliminar mesas de sus restaurantes. | Identificar mesa, capacidad y ubicación interna; impedir duplicados y cambios de capacidad/mantenimiento incompatibles con reservas activas; proteger las relaciones existentes al eliminar. |
| RF03 | Permitir al personal autorizado registrar, consultar, modificar y eliminar platos del menú. | Validar restaurante, categoría, precio y disponibilidad; conservar el identificador al editar; eliminar platos sin pedidos y bloquear la eliminación de platos con historial, permitiendo desactivarlos. |
| RF04 | Permitir registrar, consultar, modificar y eliminar reservas según el rol y el estado autorizado. | Asignar una o varias mesas del mismo restaurante; validar fecha/hora, capacidad, aforo y ausencia de cruces; limitar al cliente a sus reservas; permitirle eliminar solo pendientes y proteger los registros vinculados. Confirmar académicamente el turno de dos horas. |

La aceptación de RF01–RF04 se demuestra con las cuatro operaciones y los rechazos de permiso/integridad. Las operaciones de API ya tienen evidencia; la demostración completa desde pantallas se conserva en el punto 25.

## Modelos, base y recomendaciones de la asesoría

| Cambio | Blanco: entidad-relación | Amarillo: relacional | Base y aplicación | Cierre pendiente |
|---|---|---|---|---|
| Municipio | Municipio 1:N ZonaTuristica. | `zonas.id_municipio` → `municipios`. | Catálogo de cinco municipios y reporte por zona actualizado. | Anexo en el documento y explicación en la sustentación. |
| Reserva de varias mesas | Reserva–Mesa N:M. | Tabla puente `reserva_mesas`, clave compuesta. | 364 asignaciones conservadas; reserva de dos mesas comprobada. Edición/eliminación real verificadas en API. | Ensayo de las operaciones desde pantalla. |
| Catálogos | EstadoReserva, EstadoPedido y TipoServicio. | Tres tablas y FK desde reservas/pedidos. | Estados y modalidad comedor/domicilio conservados. | Explicación en la sustentación. |
| Pagos | Pago N — ABONA — Pedido 1; sin PlanSuscripcion. | `pagos.id_pedido` obligatorio y medio de pago mediante FK. | Abonos, saldo y reintento probados. | Aclarar R14 y R15 con la profesora. |
| Ubicación | Mesa.ubicacion describe un sector interno; Restaurante.direccion es la dirección exacta. | Atributos separados y Municipio relacionado a través de Zona. | Captura de salón/terraza y dirección del establecimiento. | Explicar el recorrido Municipio → Zona → Restaurante → Mesa. |
| Experiencias | Experiencia y ReservaExperiencia con relaciones a Restaurante, Usuario, MetodoPago y usuario que registra el cobro. | Dos tablas y cinco FK añadidas al diseño principal. | Precio unitario confirmado, cupos, referencia y datos del pago presencial comprobados. | Confirmar si la profesora quiere aforo conjunto por horario entre mesas y experiencias; actualmente se controlan cupos propios. |
| Reserva–Visita | Relación 0..1 a 0..1 con el extremo Visita elegido para recibir la referencia. | `visitas.id_reserva` admite nulos y es único. | Admite llegadas sin reserva y reservas sin asistencia registrada. No modifica la base ni los datos. | Comprobado: EERCASE validó y renovó el panel a 0 problemas. |
| Campos obligatorios | Once propiedades de Experiencia y ReservaExperiencia corregidas a `isNull=false`. | Columnas ya obligatorias; sin cambio de tipos ni tablas. | Atributos, identificadores y participación de las FK coinciden. | Comprobado: archivo recargado y validado en EERCASE. |
| Legibilidad | Exportación vigente con 20 entidades independientes y 3 subtipos, revisada visualmente. | Exportación vigente con 22 tablas y 31 FK; Oracle abierto y guardado. | Archivos actualizados en `docs/modelos` y en las mismas rutas de Proy final, con respaldo. | Comprobar su tamaño al integrarla en el documento (22). |

El blanco tiene **23 entidades dibujadas: 20 con identificador propio y 3 subtipos de Usuario**. Los subtipos se representan en la misma tabla usuarios mediante tipo_usuario. Los dos puentes, `reserva_mesas` y `detalle_pedidos`, llevan las 20 entidades independientes a **22 tablas**. La correspondencia se explica en [Herencia de Usuario](Herencia_usuarios.md). Experiencia y ReservaExperiencia ya forman parte del diseño y de la aplicación. La base recuperada conserva además `recordatorios_reserva`, una tabla auxiliar que el procesador actual no utiliza; por eso muestra **23 tablas físicas**. Una instalación nueva del esquema principal tiene 22 tablas. No se borró la tabla auxiliar para forzar una igualdad de cantidades.

### Archivos vigentes y copias anteriores

| Archivo | Resultado de esta revisión |
|---|---|
| `docs/modelos/Modelo_entidad_relacion.jpg` | Exportación nativa vigente de 20 entidades independientes y 3 subtipos de Usuario. |
| `docs/modelos/Modelo_relacional.pdf` | Exportación vigente: contiene Municipio, `reserva_mesas`, catálogos y experiencias, sin planes. |
| EERCASE: `C:\Users\Jaider\Documents\Codex\2026-10-26\files-mentioned-by-the-user-codex\work\eercase-workspace\GastroTurismoConceptual\GastroTurismo_revisado.eer` | Nativo vigente corregido y validado: 20 entidades independientes, 3 subtipos, una jerarquía, 88 atributos y 29 relaciones; cero incumplimientos de las reglas originales. La advertencia RG11 anterior se reproduce en el respaldo previo. |
| Oracle: `C:\Users\Jaider\Desktop\Nuevo Semestres\semestre 6\Bases de datos 1\Proy final\Revision modelo 2026-10-28\Oracle revisado\GastroTurismo_Oracle_revisado.dmd` | Nativo vigente con su carpeta asociada: 22 tablas y 31 FK. Conservar el archivo y su carpeta juntos. |
| `Proy final\GastroTurismo_sin_planes.eer` | Actualizado en la misma ruta el 11/11: coincide con el nativo vigente de 20 entidades independientes y 3 subtipos. La versión anterior quedó respaldada. |
| `Proy final\Relational_1Profinal.pdf` | Actualizado en la misma ruta el 11/11: contiene las 22 tablas y 31 FK vigentes, sin planes. La exportación anterior quedó respaldada. |

El 10/11 se identificaron copias anteriores que explicaban parte de la confusión. El 11/11 se actualizaron las rutas de entrega después de respaldarlas, conservando sus nombres y sin crear nuevas versiones allí.

## Evidencia conservada y alcance de las pruebas

Carpeta de evidencia local del avance actual: `C:\Users\Jaider\Documents\ChatGPT\Pro Final Bases\work\experiencias-integracion-20261110`. Los registros de la revisión anterior se conservan en `work/revision-flujos-20261110-214124`.

| Evidencia | Qué acredita | Límite |
|---|---|---|
| `pruebas.log` | 151 aprobadas, cero fallidas y cero omitidas: autenticación, datos, reportes, cuatro tablas, experiencias, concurrencia y pagos. | Ejecución en `gastronomia_turistica_academica_revision_20261110_2`, copia de revisión. No representa cobertura de todas las combinaciones posibles. |
| `recorrido-experiencias.json` | Siete comprobaciones de interfaz: recorrido público y flujo de experiencias con cliente, propietario y administrador; cero errores JavaScript observados. | Los registros de prueba se retiraron. No modifica el historial habitual. |
| `recorrido-ui.json`, carpeta del avance anterior | Se repitieron y aprobaron las 12 comprobaciones de reservas de mesas, comedor, delivery, permisos y documentos con la versión ampliada. | Se mantiene separada la copia de revisión de la base habitual. |
| `pdf-reportes.json`, `verificacion-pdf.json`, `reporte-01.pdf` a `reporte-12.pdf` | Doce exportaciones desde la aplicación con MySQL y revisión visual de sus 14 páginas. Las tres gráficas también se comprobaron en la aplicación. | Los PDF muestran tablas y criterios; no incorporan las gráficas. |
| `migracion-habitual.json`, `base-antes-aplicar.sql`, `datos-antes-aplicar.json` | Respaldo y comparación de las columnas anteriores: filas conservadas en las 23 tablas; solo tres próximas actividades agregadas. | No se crearon reservas ni cobros nuevos de demostración en la base habitual. |
| `instalacion-nueva.json` | Instalación de las dos tablas cuando no existían y repetición de la migración sin duplicar columnas; semilla cargada en una base nueva de revisión. | Prueba de instalación separada de la base del usuario. |
| `coherencia-modelos.json`, `estado-habitual.json` | Correspondencia entre conceptual, Oracle, esquema y base: 20 entidades, 22 tablas principales, 31 FK, columnas coincidentes; aplicación habitual conectada. | Metadata de la base conservada durante la migración. La revisión del blanco no ejecutó escrituras en la base. |
| `coherencia-blanco-final.json`, `validacion-reglas-eercase.log`, en `work/revision-modelos-20261111` | Atributos, claves, nulabilidad, participación y 31 FK coincidentes; reglas EVL originales: cero incumplimientos frente a una advertencia en el respaldo anterior. | Ejecución sin interfaz con el motor Epsilon/EMF instalado. El panel de EERCASE conserva el marcador antiguo hasta recargar y validar desde su vista. |

## Orden de cierre propuesto

1. **Comprobado: experiencias (18 / C03).** Publicación, consulta, reserva/cancelación, cupos, permisos, precio histórico y pago presencial integrados; modelos y base actualizados.
2. **Comprobado: operaciones de API, recorrido público y PDF (13, 25 / R04, R08).** Cerradas edición/eliminación de reservas y eliminación autorizada/protección de platos. Doce PDF revisados.
3. **Coherencia y comprobación de pantallas completadas (16, 25).** EERCASE recargado y validado con 0 problemas; las 16 operaciones desde pantalla pasaron con cuenta administradora. Practicar la explicación con ambos integrantes sigue en 24.
4. **Aclaraciones con la profesora (24 / R05, R13–R15).** Aprobación de las cuatro tablas, retiro de planes, cobro simulado de pedidos y personalización de avisos. Confirmar turnos de dos horas, criterios históricos de reportes y si mesas/experiencias deben compartir aforo por horario.
5. **Entrega y sustentación (22, 24 / R16–R17).** Incorporar experiencias y modelos nuevos en el documento oficial y ensayar con ambos integrantes. La publicación en GitHub (23) espera la indicación del usuario y la revisión del avance remoto de Luisa.

No se calculó un porcentaje global: la implementación, la evidencia de prueba y las decisiones académicas pendientes son aspectos distintos y tienen pesos que la guía no cuantifica.

## Reparación del archivo editable de Oracle

El diseño se recuperó en su misma ruta, con respaldo previo. En la revisión visual se detectaron 15 columnas con tipos incompletos; se les asignaron dominios válidos y se ajustaron los tamaños de los catálogos al esquema. Oracle volvió a abrir el archivo y mostró VARCHAR2 y NUMBER correctamente en Municipio, Experiencia y ReservaExperiencia. El propio programa guardó el diseño. Se comprobaron sus 22 tablas, 31 FK y la ausencia de tipos sin resolver en los archivos. El PDF Relational_1Profinal.pdf y el del repositorio fueron renovados. Evidencia local: work/revision-modelos-20261111.

## Cierre de coherencia del modelo blanco

En el mismo archivo se corrigió la elección de la referencia de ORIGINA_VISITA, dejando Visita como extremo elegido y conservando la cardinalidad opcional uno a uno. También se marcaron once campos de experiencias como obligatorios, de acuerdo con el esquema. No se cambiaron posiciones, trazados, identificadores, datos ni código de la aplicación. La copia GastroTurismo_sin_planes.eer de Proy final es idéntica al nativo corregido.

La validación utilizó exactamente las reglas EVL incluidas en la instalación local de EERCASE y su motor Epsilon/EMF, en lectura sin guardado: respaldo anterior, una advertencia RG11; archivo corregido, cero incumplimientos. La comparación adicional cubre atributos, claves identificadoras, nulabilidad, participación de FK y los dos puentes. La vista de EERCASE aún requiere recarga: el control devolvió «failed to activate captured window». La generación DDL del programa devolvió «Operation failed» en su servicio externo; no se usó ni se ejecutó ese resultado en la base. Estos límites quedan registrados en 25, sin bloquear la correspondencia ya comprobada entre modelos.

## Cierre de pruebas de pantallas y recarga — punto 25

El recorrido de las 16 operaciones de restaurantes, mesas, platos y reservas terminó aprobado desde formularios y botones con una cuenta administradora temporal y la copia MySQL de revisión. Se verificaron las dos asignaciones de mesa conservadas al editar y retiradas al eliminar. Cero errores JavaScript observados. Después de retirar las pruebas, las filas anteriores de las 23 tablas fueron idénticas por conteos y hashes. La base habitual no se utilizó para estas escrituras.

EERCASE volvió a abrir el mismo blanco y la acción Validate dejó el panel en 0 items. Esto resuelve el límite de vista/recarga registrado en la versión 20, sin borrar manualmente marcadores. Evidencia local: work/revision-final-20261111/resultado-crud.json, capturas de menú/reserva revisadas y validacion-eercase-pantalla.json. Las 151 pruebas y los doce PDF conservan su evidencia anterior; no se repitieron sin cambios de código. R04 ya tiene comprobación de interfaz; practicar el recorrido por ambos integrantes permanece en R17/punto 24. Documento final y Git siguen pendientes.

## Ajuste de presentación del blanco

Se reorganizó el mismo diagrama de EERCASE sin cambios en su sección semántica: distribución alineada de 20 entidades, atributos separados y 29 relaciones con giros rectos y entradas distintas. No hay figuras superpuestas ni líneas que atraviesen figuras ajenas en la comprobación geométrica; algunos cruces entre conexiones permanecen. La imagen de entrega y la copia nativa fueron actualizadas en sus rutas existentes. EERCASE abrió el archivo y Validate mostró 0 problemas. El amarillo y la base conservan la misma correspondencia. Evidencia y respaldo: work/orden-blanco-20261111.

## Segunda propuesta visual revisada con el usuario

Se reemplazó la presentación anterior por una distribución con Usuario y Restaurante en el centro y procesos próximos. Los recorridos se redujeron 38,5 % frente al primer arreglo, manteniendo íntegra la sección semántica. Comprobaciones geométricas sin figuras superpuestas ni líneas sobre figuras ajenas; validación nativa de EERCASE con 0 problemas. Las imágenes y el nativo de entrega se actualizaron en sus mismas rutas. Se conservaron ambos respaldos de diseño para permitir el retorno solicitado si el usuario no acepta la presentación. Evidencia: work/orden-blanco-segundo-20261111.

## Herencia de Usuario y su transformación relacional

Se incorporó la especialización total y disjunta Usuario → Cliente, PropietarioRestaurante y Administrador, coherente con los tres valores permitidos por usuarios.tipo_usuario. Los subtipos heredan el identificador y los atributos de Usuario y se almacenan en esa misma tabla. Se mantiene la correspondencia con las 22 tablas y 31 FK de Oracle, schema.sql y la metadata de la base; no se crean tablas de subtipos. Las posiciones de las figuras anteriores se comprobaron idénticas al respaldo del usuario. Los cinco puentes de cruces añadidos por error fueron retirados. Cero incumplimientos de reglas originales de EERCASE. Explicación para la sustentación en Herencia_usuarios.md; evidencia local en work/herencia-usuario-20261111.

## Acceso público inicial antes de reservar

La entrada sin sesión ahora muestra restaurantes y menús sin pedir contraseña. Las opciones Iniciar sesión y Crear cuenta quedan en el encabezado; pulsar Reservar conduce al acceso y conserva el restaurante para abrir el formulario después del ingreso o registro. No guarda una reserva automáticamente. Cerrar sesión vuelve al catálogo y limpia los avisos privados; una sesión válida sigue restaurando el panel habitual.

Evidencia local en work/entrada-publica-20261111: 46 pruebas dirigidas aprobadas, ocho comprobaciones desde navegador con MySQL, capturas de escritorio/móvil revisadas y comparación de las 23 tablas de la copia de ensayo antes y después de retirar la cuenta temporal. Cero errores JavaScript y cero reservas automáticas. No se modificó el servidor, la base habitual ni los modelos.
