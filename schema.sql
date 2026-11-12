-- ====================================================================
-- PROYECTO FINAL: BASES DE DATOS I
-- TEMA: Restaurantes y Gastronomía Turística
-- UNIVERSIDAD DEL QUINDÍO - 2026-2
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. CREACIÓN DE LA BASE DE DATOS Y USO
-- --------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS gastronomia_turistica_academica CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gastronomia_turistica_academica;

-- --------------------------------------------------------------------
-- 2. DDL - 22 TABLAS, INCLUIDOS CATÁLOGOS, MESAS Y EXPERIENCIAS
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS municipios (
    id_municipio INT AUTO_INCREMENT PRIMARY KEY,
    nombre_municipio VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tipos_servicio (
    id_tipo_servicio INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(60) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estados_pedido (
    id_estado_pedido INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(60) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estados_reserva (
    id_estado_reserva INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(60) NOT NULL
) ENGINE=InnoDB;

-- E1: Zonas o Destinos Turísticos
CREATE TABLE IF NOT EXISTS zonas (
    id_zona INT AUTO_INCREMENT PRIMARY KEY,
    nombre_zona VARCHAR(100) NOT NULL UNIQUE,
    id_municipio INT NOT NULL,
    descripcion_turistica TEXT,
    CONSTRAINT fk_zonas_municipio FOREIGN KEY (id_municipio) REFERENCES municipios(id_municipio) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- E2: Usuarios (Clientes/Turistas, Propietarios de Restaurantes, Administradores)
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(150) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    tipo_usuario ENUM('cliente', 'restaurante', 'administrador') NOT NULL DEFAULT 'cliente',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- E4: Categorías de Menú (Entradas, Platos fuertes, Postres, Bebidas, etc.)
CREATE TABLE IF NOT EXISTS categorias (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre_categoria VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
) ENGINE=InnoDB;

-- E5: Métodos de Pago
CREATE TABLE IF NOT EXISTS metodos_pago (
    id_metodo INT AUTO_INCREMENT PRIMARY KEY,
    nombre_metodo VARCHAR(50) NOT NULL UNIQUE,
    tipo_pago ENUM('online', 'presencial') NOT NULL DEFAULT 'online'
) ENGINE=InnoDB;

-- E6: Restaurantes
CREATE TABLE IF NOT EXISTS restaurantes (
    id_restaurante INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(200) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(150),
    capacidad_total INT NOT NULL CHECK (capacidad_total > 0),
    especialidad VARCHAR(100),
    id_zona INT NOT NULL,
    id_propietario INT NOT NULL,
    FOREIGN KEY (id_zona) REFERENCES zonas(id_zona) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_propietario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- E7: Mesas
CREATE TABLE IF NOT EXISTS mesas (
    id_mesa INT AUTO_INCREMENT PRIMARY KEY,
    numero_mesa VARCHAR(20) NOT NULL,
    capacidad INT NOT NULL CHECK (capacidad > 0),
    ubicacion VARCHAR(100) NOT NULL,
    estado ENUM('disponible', 'reservada', 'mantenimiento') NOT NULL DEFAULT 'disponible',
    id_restaurante INT NOT NULL,
    UNIQUE(id_restaurante, numero_mesa),
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- E8: Platos
CREATE TABLE IF NOT EXISTS platos (
    id_plato INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10, 2) NOT NULL CHECK (precio >= 0),
    disponibilidad BOOLEAN NOT NULL DEFAULT TRUE,
    id_categoria INT NOT NULL,
    id_restaurante INT NOT NULL,
    FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- E9: Reservas
CREATE TABLE IF NOT EXISTS reservas (
    id_reserva INT AUTO_INCREMENT PRIMARY KEY,
    fecha_reserva DATE NOT NULL,
    hora_reserva TIME NOT NULL,
    cantidad_personas INT NOT NULL CHECK (cantidad_personas > 0),
    id_estado_reserva INT NOT NULL,
    id_usuario INT NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_reservas_estado FOREIGN KEY (id_estado_reserva) REFERENCES estados_reserva(id_estado_reserva) ON UPDATE CASCADE ON DELETE RESTRICT,
    INDEX ix_reservas_horario (fecha_reserva, hora_reserva, id_estado_reserva)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reserva_mesas (
    id_reserva INT NOT NULL,
    id_mesa INT NOT NULL,
    PRIMARY KEY (id_reserva, id_mesa),
    CONSTRAINT fk_reserva_mesas_reserva FOREIGN KEY (id_reserva) REFERENCES reservas(id_reserva) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_reserva_mesas_mesa FOREIGN KEY (id_mesa) REFERENCES mesas(id_mesa) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- E10: Pedidos (De Comida / Delivery en zona turística)
CREATE TABLE IF NOT EXISTS pedidos (
    id_pedido INT AUTO_INCREMENT PRIMARY KEY,
    fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    id_tipo_servicio INT NOT NULL,
    id_estado_pedido INT NOT NULL,
    total_pago DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_pago >= 0),
    direccion_entrega VARCHAR(255),
    id_usuario INT NOT NULL,
    id_restaurante INT NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pedidos_tipo_servicio FOREIGN KEY (id_tipo_servicio) REFERENCES tipos_servicio(id_tipo_servicio) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pedidos_estado FOREIGN KEY (id_estado_pedido) REFERENCES estados_pedido(id_estado_pedido) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Detalle Pedidos
CREATE TABLE IF NOT EXISTS detalle_pedidos (
    id_pedido INT NOT NULL,
    id_plato INT NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10, 2) NOT NULL CHECK (precio_unitario >= 0),
    PRIMARY KEY (id_pedido, id_plato),
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (id_plato) REFERENCES platos(id_plato) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- E11: Pagos
CREATE TABLE IF NOT EXISTS pagos (
    id_pago INT AUTO_INCREMENT PRIMARY KEY,
    monto DECIMAL(12, 2) NOT NULL CHECK (monto > 0),
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado_pago ENUM('aprobado', 'rechazado', 'pendiente') NOT NULL DEFAULT 'aprobado',
    id_usuario INT NOT NULL,
    id_metodo INT NOT NULL,
    id_pedido INT NOT NULL,
    referencia CHAR(36) NULL,
    UNIQUE KEY uq_pago_referencia (id_pedido, referencia),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_metodo) REFERENCES metodos_pago(id_metodo) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- E12: Reseñas / Opiniones
CREATE TABLE IF NOT EXISTS resenas (
    id_resena INT AUTO_INCREMENT PRIMARY KEY,
    calificacion INT NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
    comentario TEXT,
    fecha_opinion DATE NOT NULL,
    id_usuario INT NOT NULL,
    id_restaurante INT NOT NULL,
    UNIQUE(id_usuario, id_restaurante),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- Extra: Notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id_notificacion INT AUTO_INCREMENT PRIMARY KEY,
    mensaje TEXT NOT NULL,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    leido BOOLEAN NOT NULL DEFAULT FALSE,
    id_usuario INT NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- Medición de personas realmente atendidas. También admite llegadas sin reserva.
-- La aplicación valida que reserva, mesa, usuario y restaurante correspondan.
CREATE TABLE IF NOT EXISTS visitas (
    id_visita INT AUTO_INCREMENT PRIMARY KEY,
    id_restaurante INT NOT NULL,
    id_reserva INT NULL UNIQUE,
    id_usuario INT NULL,
    fecha_ingreso DATETIME NOT NULL,
    cantidad_personas INT NOT NULL CHECK (cantidad_personas > 0),
    INDEX ix_visitas_fecha_restaurante (fecha_ingreso, id_restaurante),
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_reserva) REFERENCES reservas(id_reserva) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Cada fila representa un ingreso exitoso, no una visita a la página de acceso.
CREATE TABLE IF NOT EXISTS accesos_sistema (
    id_acceso INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    fecha_ingreso DATETIME NOT NULL,
    INDEX ix_accesos_fecha_usuario (fecha_ingreso, id_usuario),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Actividades con cupos propios. La reserva no cobra online ni asigna una mesa.
CREATE TABLE IF NOT EXISTS experiencias (
    id_experiencia INT AUTO_INCREMENT PRIMARY KEY,
    id_restaurante INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    fecha_hora DATETIME NOT NULL,
    duracion_minutos INT NOT NULL CHECK (duracion_minutos BETWEEN 1 AND 1440),
    cupos INT NOT NULL CHECK (cupos > 0),
    precio DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
    estado ENUM('activa','cancelada') NOT NULL DEFAULT 'activa',
    INDEX ix_experiencias_fecha (id_restaurante, fecha_hora),
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservas_experiencias (
    id_reserva_experiencia INT AUTO_INCREMENT PRIMARY KEY,
    id_experiencia INT NOT NULL,
    id_usuario INT NOT NULL,
    cantidad_personas INT NOT NULL CHECK (cantidad_personas > 0),
    fecha_reserva DATETIME NOT NULL,
    estado ENUM('confirmada','cancelada') NOT NULL DEFAULT 'confirmada',
    precio_unitario DECIMAL(10,2) NOT NULL CHECK (precio_unitario >= 0),
    referencia CHAR(36) NULL,
    estado_pago ENUM('pendiente','pagado') NOT NULL DEFAULT 'pendiente',
    id_metodo INT NULL,
    fecha_pago DATETIME NULL,
    cobrado_por INT NULL,
    UNIQUE KEY uq_reserva_experiencia_referencia (id_usuario, referencia),
    INDEX ix_reserva_experiencia_cupos (id_experiencia, estado),
    FOREIGN KEY (id_experiencia) REFERENCES experiencias(id_experiencia) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_metodo) REFERENCES metodos_pago(id_metodo) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (cobrado_por) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;


