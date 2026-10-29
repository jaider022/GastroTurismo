# Trabajo en equipo con GastroTurismo

Integrantes: Jaider Arley Montes y Luisa Fernanda Castañeda.

La carpeta principal del proyecto es `Bases de datos`. GitHub guardará el código, la estructura SQL, los datos ficticios de ejemplo, las pruebas y los documentos de referencia. Cada integrante utiliza su propia base de datos; GitHub no comparte automáticamente un servidor ni los cambios que alguien haga directamente en MySQL.

## Preparar el equipo de una integrante nueva

1. Aceptar la invitación al repositorio privado desde su propia cuenta de GitHub.
2. Clonar el repositorio en Antigravity, en una carpeta nueva. No descargarlo encima de una carpeta que ya tenga trabajo sin guardar.
3. Instalar las dependencias con `npm ci`.
4. Copiar `.env.example` como `.env` y configurar su instalación local de MySQL o MariaDB. El puerto 3307 corresponde a la base académica de Jaider; en otro equipo puede ser 3306.
5. Ejecutar `npm run db:cargar` para crear la base de ejemplo `gastronomia_turistica_academica`. Este procedimiento está limitado a esa base y conserva los registros que ya existan.
6. Iniciar el proyecto con `npm start` y abrir el puerto configurado en `.env`.

`npm run start:local` y `iniciar.cmd` pueden iniciar la instancia especial de Jaider cuando existe `database/entorno-local.json`. Ese archivo tiene rutas particulares de su equipo y se conserva fuera de GitHub. Una compañera que ya encienda MySQL por XAMPP puede usar `npm start`.

## Guardar avances de las dos personas

Antes de empezar, actualizar la rama principal sin cambios locales pendientes y crear una rama para la tarea. Por ejemplo, `jaider/reservas` o `luisa/menu`.

En el control de versiones de Antigravity, revisar los cambios y guardar un commit con una descripción concreta. Publicar esa rama y abrir una solicitud de cambios en GitHub para revisarla antes de unirla a `main`. Coordinar quién edita cada módulo evita que ambas personas modifiquen la misma parte a la vez.

Si aparece un conflicto, conservar ambas versiones y resolverlo con revisión. No forzar una publicación ni descartar archivos para quitar el aviso. Los commits y el respaldo local permiten recuperar estados anteriores.

## Qué se conserva localmente

El archivo `.env`, `credenciales.md`, la configuración de rutas locales, `node_modules`, registros y respaldos están excluidos. No borrarlos para poder publicar. Las dependencias se reconstruyen con `npm ci`; cada persona configura sus propias credenciales.

Los nombres y cuentas del conjunto de ejemplo son ficticios. No agregar teléfonos, claves o datos personales reales a las semillas que se comparten.

## Versiones de este guardado

`main` debe reflejar la carpeta principal que se venía utilizando. Hay avances adicionales en una copia de trabajo que aún requieren integración y pruebas. Esos avances se respaldan por separado; no se deben copiar encima de la versión principal sin revisarlos.

Los diagramas exportados del semestre se incluyen como referencias. Los editables de Oracle y EERCASE deben incorporarse después de identificar las copias que se reorganizaron más recientemente.
