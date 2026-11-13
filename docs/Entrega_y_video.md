# Entrega y grabación de GastroTurismo

La actividad del aula exige mostrar el modelo corregido y su base poblada, el login, las cuatro operaciones de cuatro CRUD y diez reportes (tres simples, cuatro intermedios y tres con subconsultas), con el SQL en el código. Debe verse la aplicación funcionando. Ambos integrantes deben intervenir.

Se localizó y diligenció la plantilla oficial [PlantillaEvidenciaBDI](https://docs.google.com/document/d/1-2osbj6KicM-2eyBMvRkTeWpcKH28awOKTjXiB1v2UA). Sus ocho apartados contienen negocio, sistema, usuarios, conceptual, relacional completo/resumen/subvistas, diccionario de las 22 tablas, DDL, población y los diez reportes. Se adjunta GastroTurismo_base_poblada.sql. El enlace del video queda pendiente de la grabación del grupo.

La propia plantilla pide máximo cinco minutos. Recorrido propuesto:

| Tiempo | Contenido | Reparto sugerido |
|---|---|---|
| 0:00–0:20 | Nombres, aplicación y conexión al SGBD. | Ambos |
| 0:20–0:55 | Entidades fuertes, modelo relacional y Pago → Pedido → Usuario. | Luisa |
| 0:55–1:10 | Login validado. | Jaider |
| 1:10–2:50 | Cuatro CRUD con sus cuatro operaciones y SQL. | Dos tablas cada integrante |
| 2:50–4:30 | Diez reportes desde la aplicación y SQL visible. | Cinco reportes cada integrante |
| 4:30–5:00 | Exportación PDF y cierre. | Ambos |

Conviene ensayar antes de grabar. Para eliminar, crear ejemplos nuevos sin pedidos o pagos históricos: un restaurante temporal sin dependencias, una mesa temporal, un plato sin ventas y una reserva futura nueva sin visita registrada. La aplicación debe validar las reglas durante la demostración.

El SQL de autenticación está en server.js; los CRUD se distribuyen entre server.js, lib/gestion.js y lib/reservas.js. Los reportes 1–10 están en server.js y se muestran con Ver Código SQL en la pantalla de reportes. Los nombres y la clasificación están en Reportes_academicos.md.

Después de grabar, publicar el video en YouTube u otra plataforma, incorporar su enlace en el apartado 8 de la plantilla y entregar el documento y el enlace en el aula. No subir el archivo de video. El cierre que muestra la actividad es el 22 de noviembre de 2026 a las 23:59. No se ha realizado una entrega ni se ha publicado un video en nombre del grupo.
