# Portada compacta de GastroTurismo

12 de noviembre de 2026. Referencia: imagen aprobada por Jaider con titular a la izquierda, finca a la derecha, buscador y tres tarjetas.

La portada se organiza dentro de la altura de la pantalla. Las fichas y la guía abren paneles/modal; no se añadió contenido inferior que obligue a bajar. El bloque intermedio de destacados se sustituyó por la rotación de la foto principal.

- Foto principal: trece imágenes (Cocora, cuatro ilustraciones y ocho fotografías editadas de Sorrento), cambio cada cinco segundos. Se muestran completas, centradas y sin deformar mediante ajuste al cuadro; las proporciones diferentes dejan márgenes discretos. No hay rótulos blancos encima. El crédito del Cocora se conserva en la guía.
- Catálogo: cinco lugares, tres tarjetas en computador y una en celular; desplazamiento horizontal suave cada dos segundos en un ciclo continuo hacia adelante. Los cinco lugares, incluido Sorrento, pasan por las tres posiciones y vuelven al comienzo sin desplazamiento de regreso. Los puntos permiten elegir cualquiera de los cinco grupos.
- Ambos carruseles tienen pequeños puntos inferiores para indicar y elegir la posición, sin botones visibles de pausa o flechas. No avanzan con ratón/foco dentro, un menú/galería/guía abiertos o la página oculta. Los temporizadores se retiran al entrar a acceso o al panel. Se respeta movimiento reducido. La hoja de la nota se rellena de verde y conserva una nervadura clara.
- Imagen y nombre de cada tarjeta abren su información sin cuenta. Reservar conserva el restaurante y conduce a acceso/registro. Sorrento conserva sus sabores y galería; no se inventaron sus datos para habilitar reservas.

## Verificación

45 pruebas dirigidas y catorce comprobaciones en navegador conectado a MySQL. Tamaños: 1440×900, 1366×768, 1366×620, 1280×600, 1536×864, 1024×768, 390×844 y 320×700. Sin desbordamiento de portada ni botones recortados en esos tamaños. Se comprobó el desplazamiento real a los dos segundos, la foto a los cinco, trece fotos, fichas sin registro, reserva con restaurante seleccionado, filtros, ocho fotos de Sorrento y movimiento reducido. Cero errores JavaScript, imágenes faltantes o escrituras a la API durante la revisión.

No se modificaron base de datos, servidor, modelos o Git. Evidencia y respaldos en `C:\Users\Jaider\Documents\ChatGPT\Pro Final Bases\work\portada-compacta-20261112`.

## Nuevo recurso visual

Herramienta integrada **image_gen**. Se creó un motivo botánico con fondo transparente; se comprobó alfa 0 en la esquina. El recurso final consumido por la web es `C:\Users\Jaider\Desktop\Bases de datos\public\images\cafeto-esquina.png`. CSS reutiliza el mismo PNG reflejado en la esquina derecha. Se conservó el original generado en la carpeta de imágenes de Codex. Las fotografías y sus prompts anteriores siguen documentados en [Recursos visuales](Recursos_visuales_inicio.md).

Prompt final:

```text
Use case: illustration-story. Create one elegant botanical decorative corner asset for the ivory-background GastroTurismo website. Transparent background with real alpha. A small graceful branch of a Colombian coffee plant, lush softly painted olive and forest-green leaves, a few rich red ripe coffee cherries, three delicate white coffee blossoms. Natural botanical watercolor and colored pencil detail, understated editorial tourism website decoration. The foliage grows up and inward from the lower LEFT corner; cluster concentrated at lower-left, tips extending diagonally toward upper right, large surrounding transparent negative space. Full branch and leaf tips inside the frame, portrait 2:3 composition, no rectangle/background, no ground, no pot, no cup, no plate, no words, no lettering, no logo, no borders or watermark. Colors should harmonize with warm cream, dark green and small orange accents. Designed to be displayed as a subtle 110px-wide corner ornament, so simple recognizable leaf and cherry silhouettes, not a dense pattern.
```

Actualización posterior del 12/11: se sustituyeron los controles de pausa/flechas por puntos inferiores y se retiraron los rótulos blancos sobre las fotos. Se comprobaron las trece imágenes completas, navegación/posición activa, relleno verde de la hoja, fichas y reserva, reproducción automática y portada sin desbordamiento en cinco tamaños (1440×900, 1366×620, 1280×600, 390×844 y 320×700). Pasaron 45 pruebas dirigidas. El recorrido de catorce comprobaciones del párrafo anterior corresponde a la revisión previa. La evidencia actual está en work/fotos-completas-20261112.

Último ajuste aprobado del 12/11: los laterales del marco muestran la propia foto desenfocada, con saturación suave y opacidad 0,48. La capa decorativa se sincroniza con las trece fotos y no interfiere con clics ni lectores de pantalla. La fotografía central sigue completa, proporcionada y nítida. Se reutilizan los mismos archivos. Verificación: 45 pruebas dirigidas y cinco grupos de comprobación en navegador con MySQL, sin errores JavaScript ni escrituras a la API; evidencia en work/fondo-fotografias-20261112.

Actualización de carrusel continuo del 12/11: el catálogo ya no rebota entre extremos. Se verificó una vuelta real 0,1,2,3,4,0,1, con Sorrento en las tres posiciones y conservación de menús, selección de restaurante, filtros y galería. Se retiraron Eje Cafetero y su raya del encabezado. Pasaron 46 pruebas dirigidas y seis grupos de comprobación con MySQL. Evidencia en work/carrusel-continuo-20261112. Este ajuste se incluye en el guardado autorizado de la versión principal `main` del mismo día.
