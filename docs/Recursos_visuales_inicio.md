# Imágenes y portada de GastroTurismo

Actualización: 12 de noviembre de 2026.

Se aplicó la propuesta visual aprobada por Jaider: portada en marfil, verde y naranja, titular editorial, fotografía del Cocora sin oscurecer, buscador con municipio y tarjetas con imágenes. El acceso y el proceso de reserva continúan usando las funciones existentes.

## Café Sorrento

Café Sorrento se presenta como un destacado de Armenia con galería de ocho fotografías. El usuario confirmó café, chocolate, desayunos, hamburguesas, maicitos y pizza. La galería no crea un restaurante ni habilita reservas para este establecimiento: todavía no se han proporcionado su dirección exacta, teléfono, propietario y mesas para incorporarlo a la base. No se inventaron esos datos ni precios.

Las ocho imágenes se editaron con la herramienta integrada image_gen a partir de las capturas entregadas por el usuario. Se retiraron la interfaz de Instagram y los avatares/corazones superpuestos. La limpieza con IA puede reconstruir pequeños detalles del fondo o del texto de las fotografías; los letreros fotografiados no se usan como catálogo de precios actuales.

Archivos finales, relativos a la raíz del proyecto `C:\Users\Jaider\Desktop\Bases de datos`:

- `public/images/cafe-sorrento/chocolate-paisaje.jpg`
- `public/images/cafe-sorrento/chocolate-artesanal.jpg`
- `public/images/cafe-sorrento/espresso.jpg`
- `public/images/cafe-sorrento/hamburguesa.jpg`
- `public/images/cafe-sorrento/cafe-interior.jpg`
- `public/images/cafe-sorrento/desayuno-mesa.jpg`
- `public/images/cafe-sorrento/desayuno-cafe.jpg`
- `public/images/cafe-sorrento/fachada.jpg`

Los originales proporcionados por el usuario se conservaron. La web consume únicamente las versiones editadas en JPEG.

## Tarjetas del catálogo

Se crearon cuatro imágenes ilustrativas diferentes con la herramienta integrada image_gen. No representan fotografías verificadas de los cuatro restaurantes de demostración. El catálogo incluye una indicación discreta de que son ilustrativas.

- `public/images/cafe-finca.jpg`: café de origen y torta en una finca cafetera.
- `public/images/trucha-huerta.jpg`: trucha con patacones y ensalada.
- `public/images/mesa-cafetera.jpg`: frijoles, arroz, arepa, plátano y aguacate.
- `public/images/sancocho-regional.jpg`: sancocho campesino con arroz y aguacate.

La elección de imagen se basa en la especialidad, sin añadir columnas a las tablas. Las imágenes se guardaron como JPEG con calidad 85 para reducir peso; los originales generados se conservaron.

## Prompts de las imágenes ilustrativas

Plantilla común (añadir cada escena en el lugar indicado):

```text
Use case: photorealistic-natural. Create one original photographic-style landscape image for a restaurant discovery website card. Realistic editorial food photography in Colombia's Eje Cafetero, warm natural daylight, authentic imperfect handmade ceramic and wood textures, appetizing fresh food. [SCENE] Composition: horizontal 3:2 aspect ratio, main subject centered with generous breathing room, camera at three-quarter table angle, softly blurred natural green background, tastefully balanced rich greens, warm earthy browns, natural colors. The main dish fills about 55 percent of the width and is fully inside the central 75 percent of the frame, so it can be cropped to a wide restaurant card. Detailed lifelike food textures and lighting. Output just the photograph, edge to edge. NO text, labels, logos, restaurant signs, ratings, people, hands, collages, borders, watermarks, or user interface. It is an illustrative image, not a depiction of any named real restaurant.
```

Escenas usadas:

- Café: A ceramic mug of freshly brewed Colombian coffee with subtle steam, a slice of artisanal coffee cake on a ceramic plate, a few scattered coffee cherries. Rustic wood table on a tranquil coffee finca terrace. Lush softly blurred coffee trees and distant green Andean hills. No breakfast meal, no trout.
- Trucha: A delicious whole grilled trout with crisp golden skin on a dark handmade ceramic plate, served with two patacones, lime and a colorful small garden salad. On a wood table on an airy countryside restaurant terrace with the lush Filandia green valley softly visible beyond. Food is realistic and appetizing.
- Tradicional: A hearty traditional Colombian countryside lunch in dark rustic earthenware: red beans, white rice, a golden small arepa, ripe plantain and avocado. A simple woven tablemat and a green countryside restaurant setting in Salento softly behind. No fish, no cake, no words.
- Regional: A rustic ceramic bowl of Colombian sancocho with chicken, corn on the cob, yuca and potato, fresh cilantro, and a small side of white rice and avocado. On a warm wooden table on a Buenavista countryside restaurant veranda. Fresh green banana leaves and soft distant mountains in the background. No coffee cups, no trout.

## Prompts de limpieza de las fotografías de Café Sorrento

### chocolate-paisaje

```text
Use case: precise-object-edit. Clean up this user-provided Instagram screenshot to obtain its embedded café photograph for their restaurant website. Input image is the EDIT TARGET. Extract ONLY the single photograph from y approximately 132 to 868: a hand holding a Sorrento chocolate bar in front of green mountains and tall palms. Preserve all original package branding and print. Remove the small circular woman's avatar and pink heart overlay at bottom left. Remove all surrounding Instagram interface, usernames outside the photograph, post text, captions below the photo, like counts, likes rows, hearts/icons, comments, navigation bars, status bars, carousel dots and any fragments of adjacent posts. Remove the specified small circular profile photos and hearts inside the photograph by natural unobtrusive reconstruction of the background, matching its real texture. Preserve the main subject's identity, real scene, actual food, physical branding/signage and photographic content as closely as possible; do not redesign the café, invent new products or replace its signs. Do not add anything. Keep the natural original colors and photographic quality, with only gentle cleanup if necessary. Output one clean edge-to-edge photograph, maintain the embedded photograph's natural aspect ratio with no letterboxing, no borders, no collage, and no UI.
```

### chocolate-artesanal

```text
Use case: precise-object-edit. Clean up this user-provided Instagram screenshot to obtain its embedded café photograph for their restaurant website. Input image is the EDIT TARGET. Extract ONLY the single square-ish photograph from y approximately 322 to 914: a hand holding several Sorrento chocolate bars, warm blurred café background. Preserve original product packaging, labels, fingers and lighting. Remove both small circular women's profile avatars and pink hearts at bottom left AND the 1/4 carousel badge at upper right. Remove all surrounding Instagram interface, usernames outside the photograph, post text, captions below the photo, like counts, likes rows, hearts/icons, comments, navigation bars, status bars, carousel dots and any fragments of adjacent posts. Remove the specified small circular profile photos and hearts inside the photograph by natural unobtrusive reconstruction of the background, matching its real texture. Preserve the main subject's identity, real scene, actual food, physical branding/signage and photographic content as closely as possible; do not redesign the café, invent new products or replace its signs. Do not add anything. Keep the natural original colors and photographic quality, with only gentle cleanup if necessary. Output one clean edge-to-edge photograph, maintain the embedded photograph's natural aspect ratio with no letterboxing, no borders, no collage, and no UI.
```

### espresso

```text
Use case: precise-object-edit. Clean up this user-provided Instagram screenshot to obtain its embedded café photograph for their restaurant website. Input image is the EDIT TARGET. Extract ONLY the single portrait photograph from y approximately 132 to 1080: clear glass espresso cup with golden crema on a stone/marble table, blurred café background. Preserve the existing Café Sorrento and tómate un expreso promotional lettering and original decorative flower within that photograph. Remove the small woman's profile avatar and heart at bottom left, AND muted audio overlay at bottom right. Remove all surrounding Instagram interface, usernames outside the photograph, post text, captions below the photo, like counts, likes rows, hearts/icons, comments, navigation bars, status bars, carousel dots and any fragments of adjacent posts. Remove the specified small circular profile photos and hearts inside the photograph by natural unobtrusive reconstruction of the background, matching its real texture. Preserve the main subject's identity, real scene, actual food, physical branding/signage and photographic content as closely as possible; do not redesign the café, invent new products or replace its signs. Do not add anything. Keep the natural original colors and photographic quality, with only gentle cleanup if necessary. Output one clean edge-to-edge photograph, maintain the embedded photograph's natural aspect ratio with no letterboxing, no borders, no collage, and no UI.
```

### hamburguesa

```text
Use case: precise-object-edit. Clean up this user-provided Instagram screenshot to obtain its embedded café photograph for their restaurant website. Input image is the EDIT TARGET. Extract ONLY the single square photograph from y approximately 370 to 961: Sorrento burger with lettuce, tomato, cheese, bacon and golden fries on a white plate, outdoors. Preserve the actual burger, fries, plate, tabletop and lighting. Remove the two women's circular profile avatars and pink hearts near the lower left. Remove all surrounding Instagram interface, usernames outside the photograph, post text, captions below the photo, like counts, likes rows, hearts/icons, comments, navigation bars, status bars, carousel dots and any fragments of adjacent posts. Remove the specified small circular profile photos and hearts inside the photograph by natural unobtrusive reconstruction of the background, matching its real texture. Preserve the main subject's identity, real scene, actual food, physical branding/signage and photographic content as closely as possible; do not redesign the café, invent new products or replace its signs. Do not add anything. Keep the natural original colors and photographic quality, with only gentle cleanup if necessary. Output one clean edge-to-edge photograph, maintain the embedded photograph's natural aspect ratio with no letterboxing, no borders, no collage, and no UI.
```

### cafe-interior

```text
Use case: precise-object-edit. Clean up this user-provided Instagram screenshot to obtain its embedded café photograph for their restaurant website. Input image is the EDIT TARGET. Extract ONLY the single photograph from y approximately 209 to 825 showing the real Café Sorrento storefront, black and green Café Sorrento sign, white tiled counter, plants and tables. Keep all actual signs and original typography in the café unchanged. Remove the three small women's circular profile avatars and pink hearts in the bottom-left area. Remove all surrounding Instagram interface, usernames outside the photograph, post text, captions below the photo, like counts, likes rows, hearts/icons, comments, navigation bars, status bars, carousel dots and any fragments of adjacent posts. Remove the specified small circular profile photos and hearts inside the photograph by natural unobtrusive reconstruction of the background, matching its real texture. Preserve the main subject's identity, real scene, actual food, physical branding/signage and photographic content as closely as possible; do not redesign the café, invent new products or replace its signs. Do not add anything. Keep the natural original colors and photographic quality, with only gentle cleanup if necessary. Output one clean edge-to-edge photograph, maintain the embedded photograph's natural aspect ratio with no letterboxing, no borders, no collage, and no UI.
```

### desayuno-mesa

```text
Use case: precise-object-edit. Clean up this user-provided Instagram screenshot to obtain its embedded café photograph for their restaurant website. Input image is the EDIT TARGET. Extract ONLY the story photograph of a Colombian breakfast on a red table: white plate of scrambled eggs, bread slices and cheese, yellow cup of chocolate on patterned saucer. Crop out ALL story interface at top and bottom, including progress segments, date, story title, close X, status bar and message controls. Focus crop on the breakfast plate, red tabletop and yellow cup; original photo area is y approximately 150 to 1152. Preserve the actual food, plate, cup and tabletop. Remove all surrounding Instagram interface, usernames outside the photograph, post text, captions below the photo, like counts, likes rows, hearts/icons, comments, navigation bars, status bars, carousel dots and any fragments of adjacent posts. Remove the specified small circular profile photos and hearts inside the photograph by natural unobtrusive reconstruction of the background, matching its real texture. Preserve the main subject's identity, real scene, actual food, physical branding/signage and photographic content as closely as possible; do not redesign the café, invent new products or replace its signs. Do not add anything. Keep the natural original colors and photographic quality, with only gentle cleanup if necessary. Output one clean edge-to-edge photograph, maintain the embedded photograph's natural aspect ratio with no letterboxing, no borders, no collage, and no UI.
```

### desayuno-cafe

```text
Use case: precise-object-edit. Clean up this user-provided Instagram screenshot to obtain its embedded café photograph for their restaurant website. Input image is the EDIT TARGET. Extract ONLY the story photograph of Colombian breakfast: close-up white plate with scrambled eggs, bread, slice of cheese with mint, yellow cappuccino cup above it on a wooden table. Remove ALL story interface: top status/progress bars, story title, date, close icon; bottom message/heart/share controls. Crop to the actual photograph between y approximately 140 and 1150. Preserve the actual food, crockery, composition and lighting. Remove all surrounding Instagram interface, usernames outside the photograph, post text, captions below the photo, like counts, likes rows, hearts/icons, comments, navigation bars, status bars, carousel dots and any fragments of adjacent posts. Remove the specified small circular profile photos and hearts inside the photograph by natural unobtrusive reconstruction of the background, matching its real texture. Preserve the main subject's identity, real scene, actual food, physical branding/signage and photographic content as closely as possible; do not redesign the café, invent new products or replace its signs. Do not add anything. Keep the natural original colors and photographic quality, with only gentle cleanup if necessary. Output one clean edge-to-edge photograph, maintain the embedded photograph's natural aspect ratio with no letterboxing, no borders, no collage, and no UI.
```

### fachada

```text
Use case: precise-object-edit. Clean up this user-provided Instagram screenshot to obtain its embedded café photograph for their restaurant website. Input image is the EDIT TARGET. Extract ONLY the single photograph from y approximately 337 to 928: authentic Café Sorrento counter with coffee packages, black and green Café Sorrento sign, white tiled counter and brown floor. Keep the actual storefront, logos, display packages and original typography unchanged. Remove the small circular woman's avatar with pink heart in lower left. Remove all surrounding Instagram interface, usernames outside the photograph, post text, captions below the photo, like counts, likes rows, hearts/icons, comments, navigation bars, status bars, carousel dots and any fragments of adjacent posts. Remove the specified small circular profile photos and hearts inside the photograph by natural unobtrusive reconstruction of the background, matching its real texture. Preserve the main subject's identity, real scene, actual food, physical branding/signage and photographic content as closely as possible; do not redesign the café, invent new products or replace its signs. Do not add anything. Keep the natural original colors and photographic quality, with only gentle cleanup if necessary. Output one clean edge-to-edge photograph, maintain the embedded photograph's natural aspect ratio with no letterboxing, no borders, no collage, and no UI.
```


## Catálogo y destacado rotativo — actualización posterior del 12/11

Se reutilizaron las mismas imágenes, sin nuevas generaciones. Los cinco lugares aparecen en tarjetas uniformes; el destacado superior rota por todos cada nueve segundos, con flechas y pausa. Sorrento conserva sus fotografías, sabores y galería. Su incorporación al listado es de presentación y no crea un ID en la base ni habilita reservas sin sus datos de operación. Si llega después un registro real con el nombre Café Sorrento, se usará ese registro en lugar de duplicar la tarjeta. La nota pública distingue las fotos de Sorrento de las imágenes ilustrativas de los otros establecimientos.

## Referencia compacta final — versión 28

La última indicación del usuario sustituye el bloque intermedio por una portada que cabe en una pantalla: foto principal con trece imágenes a cinco segundos y tres tarjetas a dos segundos. Se conservan todas las imágenes anteriores. El nuevo PNG transparente de las esquinas y su prompt se documentan en [Portada compacta](Portada_compacta.md). Ese documento describe el comportamiento vigente y sus comprobaciones.
