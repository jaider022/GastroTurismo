# Café Sorrento — incorporación del 12 de noviembre de 2026

Sorrento ya es un registro de la base habitual y aparece en restaurantes y en el selector de reservas, además de la portada. La tarjeta pública usa el identificador recibido de la API y no se duplica. Conserva la galería de ocho fotografías aportadas por Jaider. Explorar y ver la oferta no requiere cuenta; reservar solicita acceso y conserva el café elegido.

## Datos y procedencia

- Nombre utilizado: Café Sorrento. La captura aportada muestra Café Sorrento Gourmet.
- Ubicación indicada por Jaider: Mall Privilegio, Armenia. La dirección exacta queda explícitamente por confirmar. No se atribuye a la zona Centro de Armenia.
- Horario indicado: lunes a domingo, 08:30–22:30. El selector ofrece inicios hasta las 20:30 para terminar la ocupación de dos horas antes del cierre. Se trata del perfil del formulario, sin nueva tabla de horarios o restricción de cierre en la API.
- Oferta comunicada: café, capuchino, latte, chocolate artesanal, desayunos, hamburguesas, maicitos, pizza, rollitos y cerveza. La ficha muestra categorías informativas. No se crearon platos con precios inventados ni importes cero.
- Teléfono, correo del negocio y precios: pendientes. La captura de Google no se convirtió en una lista de precios.
- Mesas autorizadas como configuración provisional: **diez mesas**, cinco de dos personas y cinco de cuatro. Suman **30 cupos**, también provisionales. El aforo real del café no está confirmado.

El sistema permite combinar varias mesas para una reserva y verifica la suma de sus capacidades, disponibilidad, restaurante y aforo. Con esta configuración admite grupos de hasta 30 personas; un grupo de 40 necesitaría ajustar primero las mesas y el aforo. No se crean mesas individuales de 20 o 40 personas.

La cuenta `gestion.sorrento@gastroturismo.example` es un registro técnico de rol restaurante, con nombre Gestión Café Sorrento (por asignar). No representa una identidad personal real. En la base habitual se creó con una clave aleatoria protegida que no se comparte como credencial. El administrador actual puede gestionar el café y asignarle posteriormente una cuenta de propietario. En la semilla nueva usa exclusivamente la contraseña académica de demostración del conjunto, como los demás ejemplos.

## Actualizar otra instalación conservando sus datos

Con la configuración local de la base académica correcta:

```powershell
npm run db:sorrento
npm run db:sorrento -- --aplicar
```

El primer comando solo consulta. Aplicar verifica el nombre de la base, guarda un respaldo local de sus tablas dentro de `backups/` y agrega una zona, una cuenta técnica, un restaurante y diez mesas en una transacción. Si Sorrento ya existe, informa su identificador y no sustituye datos ni duplica mesas. No cambia las tablas, claves o modelos. Los respaldos contienen información de la base y permanecen excluidos de Git.

Las instalaciones vacías también incluyen Sorrento en la semilla actual y en la generación reproducible. No se debe recargar la semilla completa sobre una instalación existente: los identificadores locales pueden ser diferentes. Para esa situación se usa el comando incremental anterior.

## Comprobación

Pasaron 140 pruebas de la suite general, con cero fallidas y dos pruebas MySQL opcionales omitidas. Adicionalmente se realizó el recorrido real en la copia MySQL: incorporación con respaldo, repetición sin duplicados, exploración y galería, acceso desde Reservar, diez mesas disponibles y reserva de seis personas con mesas de 2+4. Después de guardar, ambas mesas dejaron de estar disponibles. Se retiraron los registros de revisión y se conservaron por hashes las filas anteriores de sus 23 tablas.

En la base habitual hay ahora cinco restaurantes; Sorrento tiene un identificador real (6 en este equipo), diez mesas y 30 cupos provisionales. Se comparó el respaldo anterior con las filas posteriores: solo se agregaron los trece registros previstos (zona, cuenta, restaurante y diez mesas). Todas las filas previas de 23 tablas se conservaron. La portada habitual se comprobó sin escrituras a la API: ficha, galería y solicitud de acceso al reservar. La copia de demostración y los SQL también conservan sus filas previas.

Evidencia local: `work/incorporar-sorrento-20261112` del espacio de esta conversación. La incorporación y los ajustes anteriores del carrusel y formulario se incluyen en el guardado autorizado de la versión principal `main` del 12 de noviembre. Cada integrante debe aplicar la carga incremental en su propia base; GitHub no sincroniza el servidor local.

## Actualización posterior de precios

Jaider confirmó café $4.400, capuchino $8.700, latte $7.800; pizzas personal $20.000, mediana $32.000 y grande $50.000; hamburguesa $26.000; maicitos $24.000; rollitos napolitanos $24.000, mixtos $26.000 y de jamón y queso $24.000. Los once productos están cargados y visibles en el menú. Desayunos y otras categorías no recibieron precios inventados. Se conservan las diez mesas y 30 cupos provisionales. La ficha, la compra y su pago se comprobaron desde la interfaz con la copia MySQL.
