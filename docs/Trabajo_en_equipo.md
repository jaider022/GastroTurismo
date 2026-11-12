# Trabajo en equipo con GastroTurismo

Integrantes: Jaider Arley Montes y Luisa Fernanda Castañeda.

La carpeta principal del proyecto es `Bases de datos`. GitHub guardará el código, la estructura SQL, los datos ficticios de ejemplo, las pruebas y los documentos de referencia. Cada integrante utiliza su propia base de datos; GitHub no comparte automáticamente un servidor ni los cambios que alguien haga directamente en MySQL.

## Preparar el equipo de una integrante nueva

**Versión que se debe abrir:** rama `avance-2026-11-12`. Contiene el avance de Jaider hasta el 12 de noviembre, incluida la portada y los cambios de modelos y experiencias. `main` conserva el commit `14bd06d` de Luisa. Se comparte esta rama separada para no sobrescribir su trabajo ni reintroducir planes sin revisión.

1. Acceder al repositorio desde su cuenta de GitHub; aceptar la invitación si el acceso privado la requiere.
2. Clonar el repositorio en Antigravity, en una carpeta nueva. No descargarlo encima de una carpeta que ya tenga trabajo sin guardar.
3. Instalar las dependencias con `npm ci`.
4. Copiar `.env.example` como `.env` y configurar su instalación local de MySQL o MariaDB. Jaider usa la copia recuperada en el puerto 3318. En cada equipo se indica el puerto de su propia instancia, por ejemplo 3306.
5. Ejecutar `npm run db:cargar` para crear la base de ejemplo `gastronomia_turistica_academica`. Este procedimiento está limitado a esa base y conserva los registros que ya existan.
6. Iniciar el proyecto con `npm start` y abrir el puerto configurado en `.env`.

Al clonar, seleccionar **`avance-2026-11-12`** como rama. Si ya se tiene una copia, guardar primero el trabajo propio, obtener los cambios remotos y cambiar a esa rama. No copiar archivos encima de una carpeta con cambios pendientes. Desde esta versión, crear una rama de tarea como `luisa/menu` para conservar separados los avances de ambas personas.

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

`avance-2026-11-12` refleja la carpeta principal que se venía utilizando. El avance distinto de `main` permanece conservado con su historia original. La integración entre ramas sigue pendiente de revisión; no se forzó una publicación ni se descartó el trabajo de ninguna integrante.

Los diagramas exportados del semestre se incluyen como referencias. Los editables de Oracle y EERCASE deben incorporarse después de identificar las copias que se reorganizaron más recientemente.
