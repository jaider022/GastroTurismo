# GastroTurismo — Restaurantes y gastronomía turística

Proyecto final de Bases de Datos I, únicamente caso de restaurantes.

El listado vigente de tareas terminadas, parciales y pendientes está en [Seguimiento del proyecto](docs/Seguimiento_proyecto.md). Se actualiza al cerrar cada mejora.

La versión principal del **12 de noviembre de 2026** está en **`main`**. Incluye el avance actual de Jaider, el carrusel continuo, los horarios de reserva y Café Sorrento. Selecciona `main` en GitHub o Antigravity para continuar desde esta versión. El estado anterior de Luisa se conserva en el historial. Instrucciones: [Trabajo en equipo](docs/Trabajo_en_equipo.md).

La clasificación de los diez reportes exigidos y sus criterios de cálculo están en [Reportes académicos](docs/Reportes_academicos.md).

## Ensayar en este equipo

1. Abre esta carpeta en Antigravity.
2. Ejecuta `npm run start:local`, o abre `iniciar.cmd`.
3. Entra en http://localhost:3001.
4. Cuenta: admin@gastroturismo.example. Contraseña de ejemplo: Gastro2026!

También existen cliente@gastroturismo.example y restaurante@gastroturismo.example con la misma contraseña de ejemplo. Son identidades ficticias.

En el equipo de Jaider, `.env` conecta a la copia recuperada de `gastronomia_turistica_academica` en el puerto 3318. Usa MariaDB de XAMPP, compatible con MySQL. El iniciador puede arrancar esa instancia con las rutas de `database/entorno-local.json`.

## Avance implementado

- Datos coherentes de agosto a octubre2026: nombres, teléfonos, fechas e importes.
- Veintidós tablas principales, con Municipio, catálogos, varias mesas por reserva, experiencias, visitas (asistencia real) y accesos_sistema (ingresos exitosos). Sin membresías ni planes de suscripción.
- Portada de una pantalla con cinco lugares, fotografías completas con fondo desenfocado, navegación por puntos, exploración sin cuenta y acceso al intentar reservar. Café Sorrento está en la base y en reservas: diez mesas combinables y 30 cupos provisionales, conservando fotos y sabores. Ver [incorporación y datos por confirmar](docs/Cafe_Sorrento.md).
- Registro de asistencia con o sin reserva, validación de restaurante, fecha, capacidad y duplicados.
- Diez reportes originales y dos nuevos: comensales por mes e ingresos/usuarios distintos de la aplicación.
- Corte, comparación de mismos días o mes anterior completo, y filtro de restaurante para comensales.
- Exportación de reportes con criterios; impresión como PDF si faltan bibliotecas externas.
- Sesión mediante cookie, cierre de sesión y protección de contraseñas; migración de claves antiguas al ingresar.
- Pedidos calculados con precios del menú y pagos vinculados obligatoriamente a un pedido del mismo cliente. Se conservan los distintos medios de pago.
- Vista previa y descarga de comprobantes/facturas comparten los datos consultados y el total registrado del pedido.
- Edición de mesas y administración de platos desde pantalla, con disponibilidad del menú y conservación de platos usados en pedidos.
- Reservas de varias mesas con aforo simultáneo, bloqueos por horario y protección al reducir capacidades.
- Reportes limitados a los establecimientos del propietario y reportes generales para administrador.
- Recordatorios privados en la campana durante las 24 horas previas. El servidor los revisa cada minuto mientras permanece abierto.

## Reproducir

`npm run db:cargar` carga database/demo-inicial.sql en la base académica. Conserva registros existentes; no migra una base antigua.

Si la base existente todavía contiene planes, `npm run db:sin-planes` solo inspecciona. El ajuste se aplica de forma explícita, con la aplicación detenida y respaldo previo: [cambio sin planes](docs/Cambio_sin_planes.md). No se ejecuta automáticamente al abrir la aplicación ni al cargar ejemplos.

Para una base académica existente, `npm run db:asesoria` comprueba si falta la normalización de Municipio, catálogos, mesas y pagos. Después de respaldar la base y detener la aplicación que escribe en ella, `npm run db:asesoria -- --aplicar` conserva las reservas y sus asignaciones al migrarlas. Reinicia el servidor local después de aplicar el ajuste.

`npm run datos:generar -- --fecha=2026-10-27` regenera archivos de ejemplo, sin reemplazar automáticamente la base ni el navegador.

`npm test` ejecuta pruebas. Para pruebas reales establece GASTRO_MYSQL_TEST=1 y ejecuta `node --test tests/mysql.integration.test.js`. Solo usa la base académica y elimina sus registros de prueba.

Si MySQL no conecta hay una demostración separada; la fuente se indica en pantalla y en los reportes.

## Pendientes finales

Los modelos nativos de EERCASE y Oracle se ajustaron para retirar planes, vincular Pago con Pedido e incorporar experiencias. El diseño de trabajo en Oracle es `GastroTurismo_Oracle_revisado`. Hay 20 entidades independientes y tres subtipos de Usuario en el conceptual (23 rectángulos), 22 tablas principales y 30 claves foráneas. Los subtipos usan usuarios.tipo_usuario en una sola tabla; véase [Herencia de Usuario](docs/Herencia_usuarios.md). La correspondencia se contrastó con la base académica. Los tres perfiles tienen pruebas de permisos. En **Experiencias** se publican actividades, se reservan cupos y se registra el pago recibido en el restaurante. Guía: [Experiencias gastronómicas](docs/Experiencias_gastronomicas.md). Los modelos se revisaron en sus editores. El documento está diligenciado con capturas y tablas; faltan el enlace del video y la sustentación. Listado vigente: [Seguimiento](docs/Seguimiento_proyecto.md); relación con la guía de la profesora: [Trazabilidad](docs/Trazabilidad_requisitos.md).

Reglas detalladas: docs/datos-y-modelo.md.

## Cierre técnico del 12 de noviembre

Modelo y base normalizados: 22 tablas y 30 claves foráneas, sin usuario duplicado en Pago. Las 22 tablas contienen datos y Sorrento tiene once productos con precios suministrados por el equipo. La plantilla oficial está diligenciada en docs/Trabajo_final_GastroTurismo.docx; falta el enlace del video del grupo. Actualizaciones incrementales: db:normalizar-pagos y db:datos-entrega. Ver docs/Normalizacion_pagos.md y docs/Entrega_y_video.md.

## Informe académico con evidencias

Actualizado el 13 de noviembre: [Word del proyecto](docs/Trabajo_final_GastroTurismo.docx), creado desde cero con portada, índice, 35 figuras, 36 tablas, los dos modelos, diccionario de 22 tablas, SQL de los cuatro CRUD y diez reportes. Las cifras corresponden a la base habitual y las capturas de la aplicación a una copia de verificación. Falta incorporar el video del grupo. Durante la revisión se identificó que el contador de clientes del resumen depende del navegador; el reporte 2 sí consulta la base. Ese indicador queda pendiente de sincronizar.
