# Trabajo en equipo con GastroTurismo

Integrantes: Jaider Arley Montes y Luisa Fernanda Castañeda.

La carpeta principal del proyecto es `Bases de datos`. GitHub guardará el código, la estructura SQL, los datos ficticios de ejemplo, las pruebas y los documentos de referencia. Cada integrante utiliza su propia base de datos; GitHub no comparte automáticamente un servidor ni los cambios que alguien haga directamente en MySQL.

## Preparar el equipo de una integrante nueva

**Versión que se debe abrir:** rama `main`. Por decisión expresa de Jaider del 12 de noviembre, esta es la base de trabajo del equipo y contiene su avance actual, incluido carrusel continuo, horarios, Café Sorrento, modelos y experiencias. El contenido anterior de Luisa (`14bd06d`) se conserva en el historial, pero no se reintroduce en los archivos vigentes. La rama `avance-2026-11-12` apunta al mismo cierre de este guardado.

1. Acceder al repositorio desde su cuenta de GitHub; aceptar la invitación si el acceso privado la requiere.
2. Clonar el repositorio en Antigravity, en una carpeta nueva. No descargarlo encima de una carpeta que ya tenga trabajo sin guardar.
3. Instalar las dependencias con `npm ci`.
4. Copiar `.env.example` como `.env` y configurar su instalación local de MySQL o MariaDB. Jaider usa la copia recuperada en el puerto 3318. En cada equipo se indica el puerto de su propia instancia, por ejemplo 3306.
5. En una instalación nueva, con la base académica vacía, ejecutar `npm run db:cargar` para crear `gastronomia_turistica_academica`. Si la base ya tiene información, no recargar la semilla: revisar primero su esquema y las migraciones pendientes con respaldo. Para agregar únicamente Sorrento a una base ya actualizada, usar [la incorporación incremental](Cafe_Sorrento.md).
6. Iniciar el proyecto con `npm start` y abrir el puerto configurado en `.env`.

Al clonar, seleccionar **`main`**. Si ya se tiene una copia con trabajo propio, guardarlo primero en una rama separada; después obtener `origin/main` y partir de la versión principal actual. No copiar archivos encima de una carpeta con cambios pendientes ni volver a unir la versión antigua de planes. Desde esta base, crear una rama de tarea como `luisa/menu` para revisar cada cambio antes de incorporarlo a `main`.

GitHub comparte el código, esquema y datos ficticios de ejemplo; no copia automáticamente la base local, sus credenciales ni el servidor que está encendido en el equipo de Jaider.

`npm run start:local` y `iniciar.cmd` pueden iniciar la instancia especial de Jaider cuando existe `database/entorno-local.json`. Ese archivo tiene rutas particulares de su equipo y se conserva fuera de GitHub. Una compañera que ya encienda MySQL por XAMPP puede usar `npm start`.

## Guardar avances de las dos personas

Antes de empezar, actualizar la rama principal sin cambios locales pendientes y crear una rama para la tarea. Por ejemplo, `jaider/reservas` o `luisa/menu`.

En el control de versiones de Antigravity, revisar los cambios y guardar un commit con una descripción concreta. Publicar esa rama y abrir una solicitud de cambios en GitHub para revisarla antes de unirla a `main`. Coordinar quién edita cada módulo evita que ambas personas modifiquen la misma parte a la vez.

Si aparece un conflicto, conservar ambas versiones y resolverlo con revisión. No forzar una publicación ni descartar archivos para quitar el aviso. Los commits y el respaldo local permiten recuperar estados anteriores.

## Qué se conserva localmente

El archivo `.env`, `credenciales.md`, la configuración de rutas locales, `node_modules`, registros y respaldos están excluidos. No borrarlos para poder publicar. Las dependencias se reconstruyen con `npm ci`; cada persona configura sus propias credenciales.

Los nombres y cuentas del conjunto de ejemplo son ficticios. No agregar teléfonos, claves o datos personales reales a las semillas que se comparten.

## Versiones de este guardado

`main` contiene la carpeta principal que se venía utilizando, según la decisión del usuario. La unión conserva ambos historiales y adopta íntegramente los archivos de la versión actual de Jaider. El contenido anterior puede recuperarse consultando `14bd06d`; no se reescribe ni elimina su historia. No se necesita publicar con fuerza.

Los diagramas exportados del semestre se incluyen como referencias. Los editables de Oracle y EERCASE deben incorporarse después de identificar las copias que se reorganizaron más recientemente.
