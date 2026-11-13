# Normalización y correspondencia de los modelos

Actualización del 12 de noviembre de 2026.

Pago conserva su relación ABONA con Pedido. Se retiró pagos.id_usuario y la relación conceptual Usuario EFECTUA Pago: el cliente se obtiene de pedidos.id_usuario. Esto elimina la dependencia transitiva id_pago → id_pedido → id_usuario. El servidor comprueba el permiso con el cliente del pedido; un formulario anterior puede enviar id_usuario para compatibilidad, pero ese valor debe coincidir y no se almacena de nuevo. El formulario actual no lo envía.

Se conservaron los 320 pagos de la base habitual, sus importes, fechas, medios, referencias e identificadores. La migración guardó un respaldo de estructura y datos antes de cambiar la base. También retiró recordatorios_reserva, vacía y sin uso; las notificaciones del sistema permanecen en notificaciones. El resultado es **22 tablas, 30 claves foráneas y las 22 tablas pobladas**.

El blanco conserva 20 entidades independientes, tres subtipos de Usuario, 88 atributos y 28 relaciones de negocio. Sus posiciones restantes son idénticas a las de la copia anterior. EERCASE validó cero incumplimientos. El amarillo conserva las posiciones y rutas del diseño Oracle, con tres subvistas por módulo. Se compararon columnas y relaciones de Oracle, schema.sql, el conceptual y la metadata real: coinciden.

Para otra instalación ya actualizada y con el servidor detenido durante el cambio:

```powershell
npm run db:normalizar-pagos
npm run db:normalizar-pagos -- --aplicar
```

Inspeccionar no cambia datos. Aplicar exige seleccionar la base académica local, rechaza clientes inconsistentes y guarda un respaldo. Si la auxiliar tuviera datos o referencias entrantes, se conserva y la operación se detiene. La repetición sobre la estructura normalizada no vuelve a modificarla. Los cambios DDL no son una transacción reversible del motor: el respaldo previo permite recuperar la estructura anterior.

La semilla, el generador y la copia de demostración también usan el modelo normalizado. El navegador respalda pagos anteriores antes de quitar el usuario repetido; si encuentra datos inconsistentes, conserva la información y solicita revisión.

Comprobación: 167 pruebas aprobadas con integración MySQL en la copia de revisión; después del menú, 142 pruebas generales aprobadas y dos integraciones opcionales omitidas. Recorrido final en navegador con MySQL: login, compra de pizza de Sorrento a $20.000 y pago sin usuario duplicado, diez reportes ejecutados desde botones y SQL visible. Los registros temporales se retiraron y las filas previas de 22 tablas se conservaron por hashes. Evidencia local: work/normalizacion-pagos-20261112 del espacio de esta conversación.
