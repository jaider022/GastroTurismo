# Herencia de Usuario en GastroTurismo

El modelo blanco representa una especialización de **Usuario** en **Cliente**, **PropietarioRestaurante** y **Administrador**. Las conexiones de especialización son los símbolos curvos de herencia de EERCASE. El círculo `d` indica que los subtipos son disjuntos; la conexión doble desde Usuario indica especialización total.

Cada cuenta tiene exactamente uno de esos tres perfiles, como ya establece `usuarios.tipo_usuario`. Los subtipos heredan `id_usuario`, nombre, correo y los demás atributos de Usuario; no tienen un identificador propio adicional.

| Subtipo conceptual | Tabla del modelo amarillo | Valor de `tipo_usuario` |
|---|---|---|
| Cliente | usuarios | cliente |
| PropietarioRestaurante | usuarios | restaurante |
| Administrador | usuarios | administrador |

La transformación elegida usa **una tabla para toda la jerarquía**, con `tipo_usuario` como discriminador. No hace falta crear tres tablas nuevas para representar estos perfiles. Las relaciones existentes con Usuario conservan sus claves foráneas y el programa mantiene sus permisos actuales.

El blanco tiene ahora **23 entidades dibujadas: 20 con identificador propio y 3 subtipos**, además de 29 relaciones de negocio y una jerarquía con cuatro enlaces de herencia. El amarillo conserva **22 tablas y 31 claves foráneas**: las 20 entidades independientes y los dos puentes `reserva_mesas` y `detalle_pedidos`.

Se añadieron únicamente las figuras y enlaces de la jerarquía en el espacio libre debajo de Usuario. Se retiraron los cinco puentes de cruces añadidos por una confusión previa. Las posiciones de todas las figuras anteriores y las demás relaciones se conservaron.

Para la sustentación: «Usuario es la entidad general. Cliente, PropietarioRestaurante y Administrador heredan sus datos. En el relacional usamos una sola tabla y distinguimos el subtipo mediante tipo_usuario; por eso el número de rectángulos conceptuales no tiene que coincidir con el número de tablas».
