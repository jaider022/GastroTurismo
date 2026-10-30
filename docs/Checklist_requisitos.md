# Checklist del proyecto final — GastroTurismo

> Revisión histórica del 27 de octubre. El listado vigente, con los avances del 29 de octubre y sus pendientes, está en [Seguimiento del proyecto](Seguimiento_proyecto.md).

Revisión: 27 de octubre de 2026. Proyecto auditado: C:\Users\Jaider\Desktop\Bases de datos (Antigravity). Fuente vigente: C:\Users\Jaider\Desktop\Nuevo Semestres\semestre 6\Bases de datos 1\Proy final\Proyecto final BD1 - 2026-2.pdf, 7 páginas, 275209 bytes.

Estados: CUMPLE = evidencia en código y/o prueba; PARCIAL = existe pero falta terminar o corregir; FALTA = no se encontró implementación; EXTERNO = requiere evidencia del grupo o de la profesora.

## Requisitos vigentes

| Requisito | Estado | Resultado |
|---|---|---|
| Grupo máximo de 3 estudiantes | EXTERNO | Confirmar integrantes; no se puede certificar con el código. |
| Aplicación web o de escritorio con base persistente | CUMPLE | Aplicación Express con conexión real a la base académica; motor instalado MariaDB de XAMPP, compatible con MySQL. |
| Mínimo 10 entidades fuertes en el ER | CUMPLE en cantidad | El conceptual tiene 13 entidades con identificador propio. La aplicación ya tiene 16 tablas; aún se deben actualizar los diagramas. |
| Registrar, consultar, modificar y eliminar en 4 tablas core | PARCIAL | Se proponen restaurantes, mesas, platos y reservas. Backend tiene las cuatro operaciones; falta edición de mesas en pantalla y pantalla de gestión de platos. Reservas requieren validaciones adicionales. No se exige CRUD de todas las tablas. |
| Requerimientos aprobados previamente por profesora | EXTERNO | No se encontró evidencia de aprobación en los archivos revisados. |
| Mínimo 10 reportes | CUMPLE | Hay 12; los dos últimos comparan asistencia e ingresos a la aplicación. |
| 3 reportes simples | CUMPLE | Reportes1–3, una tabla por consulta. |
| 4 reportes intermedios | CUMPLE | Reportes4–7, joins y agrupaciones/agregados. |
| 3 reportes complejos con subconsultas | CUMPLE | Reportes8–10. |
| Reportes visibles y presentados en la aplicación | CUMPLE básico | Tablas y filtros visibles; no equivale a aprobación estética de la profesora. |
| Reportes exportables a PDF | CUMPLE | Exportación común implementada, alternativa impresión; PDF11 generado y revisado. |
| Bonificación: gráficos en 3 reportes | IMPLEMENTADO Y COMPROBADO | Gráficos6,9,10 renderizan en la aplicación. Dependen de Chart.js externo. No se exige expresamente incluirlos dentro del PDF. |
| Login con credenciales validadas | CUMPLE | Sesión cookie, contraseñas protegidas, consulta de sesión y cierre. |
| Registro y perfil con datos básicos | CUMPLE básico | Registro guarda nombre, correo, teléfono y clave; pantalla identifica nombre y rol. No existe panel de edición; esa edición no se exige expresamente en el texto. |
| Plantillas de documentos del sistema | PARCIAL | Existen vista previa y descarga de comprobante y factura. La vista previa usa API, pero la descarga usa LocalStorage: registros nuevos de MySQL pueden faltar o salir desactualizados. |
| Datos de ejemplo coherentes | CUMPLE para semilla | Nombres, teléfonos, relaciones, importes, aforos y tres meses comprobados. No garantiza cualquier dato que se ingrese después. |
| Recordatorios y notificaciones personalizados | PARCIAL | Se crea notificación al reservar y se permite consultar/marcar leída. No hay programación de recordatorios futuros. |
| Diversidad de planes y medios de pago en línea | PARCIAL | Catálogos y selección de medios existen; falta flujo de contratar/cambiar planes. El pago se aprueba como simulación, no hay confirmación de proveedor. El documento no aclara si exige pasarela real: confirmar alcance. |
| Caso escogido: reservas de mesas | PARCIAL | Hay operaciones en pantalla; servidor no impide solapamientos ni valida aforo en la creación de reservas. |
| Caso escogido: gestión de menús | PARCIAL | Menú consultable y carrito, endpoints de platos; falta interfaz para alta/edición/eliminación de platos. |
| Caso escogido: delivery en zonas turísticas | CUMPLE básico | Pedido de delivery, restaurante y dirección; no se exige mapa, rastreo ni repartidor en el enunciado. |
| Caso escogido: experiencias gastronómicas para turistas | FALTA por definir | No existe un flujo explícito; acordar el alcance del caso con la profesora. |
| Documento en plantilla del proyecto | FALTA por completar | README y nota técnica no sustituyen el documento. JAIDER.docx contiene una imagen y no texto de un informe desarrollado. |
| Sustentación por los integrantes del grupo | POR REALIZAR | Versión vigente exige participación de integrantes y describe la consecuencia individual de no sustentar o no saber explicar. |

## Cambios frente a la copia anterior

La página2 precisa operaciones sobre cuatro tablas importantes del negocio. La página3 cambia la sustentación de un integrante a los integrantes y expresa la consecuencia sobre la nota del estudiante. Los demás requisitos extraídos coinciden.

## Detalle de las 4 tablas core propuestas

| Tabla | Registrar | Consultar | Modificar | Eliminar | Pendiente |
|---|---|---|---|---|---|
| restaurantes | Sí | Sí | Sí | Sí | Revisar permisos por rol/propietario y probar casos con relaciones existentes. |
| mesas | Sí | Sí | Solo backend | Sí | Agregar edición en pantalla. |
| platos | Solo backend | Sí | Solo backend | Solo backend | Crear pantalla de gestión del menú. |
| reservas | Sí | Sí | Sí | Sí | Evitar reservas duplicadas/solapadas, validar capacidad/fechas y coherencia de estados. |

La elección de estas cuatro tablas debe coincidir con los requerimientos presentados a la profesora.

## Fallos técnicos prioritarios que no son requisitos nuevos

1. Descargar plantillas desde los registros reales de la API, sin consultar la copia semilla del navegador.
2. Proteger en servidor las operaciones antiguas por rol y propietario; ocultar botones no basta.
3. Validar disponibilidad, fecha y aforo de reservas en servidor.
4. Alinear Oracle/EERCASE con las dos tablas nuevas (visitas y accesos_sistema), obligatoriedad y regla exclusiva de pagos.

## Evidencia de código

- server.js124–190: autenticación;193–208: protección general y usuarios;212–282: asistencia y comparativos.
- server.js287–449: CRUD restaurantes, mesas y platos;452–532: reservas;534–627: pedidos;678–747: planes, métodos, pagos y notificaciones.
- server.js755–904: diez reportes originales.
- public/app.js1991–2175: tablas, gráficos y exportación de reportes.
- public/app.js2218: vista previa de documentos desde API;2360–2477: descarga desde LocalStorage.
- public/app.js1166–1268: mesas sin edición;1276–1593: reservas;1638–1790: menú y checkout.
- schema.sql:16 tablas; docs/datos-y-modelo.md: reglas y pendientes de diagramas.
- tests:31 verificaciones pasaron en el avance anterior, incluidas integraciones reales. No cubren todos los fallos encontrados en esta auditoría.

Auditoría sin modificaciones del código ni de datos del proyecto. Pruebas visuales de consulta: reportes, gráficos y acceso al módulo de plantillas. No se ha ejecutado un nuevo ciclo completo de CRUD durante esta revisión.
