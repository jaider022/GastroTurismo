-- ====================================================================
-- MIGRACIÓN v3: agrega experiencias, inscripciones, suscripciones y recordatorios
-- a una base gastronomia_turistica_academica creada con la versión de 16 tablas.
-- Alternativa más simple para la sustentación: npm run db:recrear (base nueva con datos).
-- Probado para MariaDB 10.4+ (XAMPP) y MySQL 8.0.19+.
-- ====================================================================
USE gastronomia_turistica_academica;

-- E13: Experiencias gastronómicas ofrecidas a turistas (catas, clases, tours)
CREATE TABLE IF NOT EXISTS experiencias (
    id_experiencia INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    tipo_experiencia ENUM('cata', 'clase_cocina', 'tour', 'maridaje', 'desayuno') NOT NULL,
    fecha_experiencia DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    duracion_minutos INT NOT NULL CHECK (duracion_minutos BETWEEN 30 AND 600),
    cupo_maximo INT NOT NULL CHECK (cupo_maximo > 0),
    precio_persona DECIMAL(10, 2) NOT NULL CHECK (precio_persona >= 0),
    idioma VARCHAR(50) NOT NULL DEFAULT 'Español',
    estado_experiencia ENUM('programada', 'cancelada', 'realizada') NOT NULL DEFAULT 'programada',
    id_restaurante INT NOT NULL,
    INDEX ix_experiencias_fecha (fecha_experiencia),
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- E14: Inscripciones de turistas a experiencias gastronómicas
CREATE TABLE IF NOT EXISTS inscripciones_experiencia (
    id_inscripcion INT AUTO_INCREMENT PRIMARY KEY,
    id_experiencia INT NOT NULL,
    id_usuario INT NOT NULL,
    cantidad_personas INT NOT NULL CHECK (cantidad_personas > 0),
    total DECIMAL(12, 2) NOT NULL CHECK (total >= 0),
    fecha_inscripcion DATETIME NOT NULL,
    estado_inscripcion ENUM('confirmada', 'cancelada', 'asistio') NOT NULL DEFAULT 'confirmada',
    UNIQUE (id_experiencia, id_usuario),
    FOREIGN KEY (id_experiencia) REFERENCES experiencias(id_experiencia) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Pagos: nuevo concepto "inscripción a experiencia".
ALTER TABLE pagos ADD COLUMN id_inscripcion INT NULL AFTER id_plan;
ALTER TABLE pagos DROP CONSTRAINT chk_pago_concepto;
ALTER TABLE pagos ADD CONSTRAINT chk_pago_concepto CHECK ((id_pedido IS NOT NULL) + (id_plan IS NOT NULL) + (id_inscripcion IS NOT NULL) = 1);
ALTER TABLE pagos ADD CONSTRAINT fk_pagos_inscripcion FOREIGN KEY (id_inscripcion) REFERENCES inscripciones_experiencia(id_inscripcion) ON UPDATE RESTRICT ON DELETE RESTRICT;

-- restaurantes.id_plan conserva el plan vigente; al vencer vuelve al plan Básico (1).
CREATE TABLE IF NOT EXISTS suscripciones (
    id_suscripcion INT AUTO_INCREMENT PRIMARY KEY,
    id_restaurante INT NOT NULL,
    id_plan INT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado_suscripcion ENUM('activa', 'vencida', 'cancelada') NOT NULL DEFAULT 'activa',
    id_pago INT NULL UNIQUE,
    CONSTRAINT chk_suscripcion_fechas CHECK (fecha_fin > fecha_inicio),
    INDEX ix_suscripciones_vigencia (estado_suscripcion, fecha_fin),
    FOREIGN KEY (id_restaurante) REFERENCES restaurantes(id_restaurante) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (id_plan) REFERENCES planes_suscripcion(id_plan) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (id_pago) REFERENCES pagos(id_pago) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- genera la notificación correspondiente y marca el recordatorio como enviado.
CREATE TABLE IF NOT EXISTS recordatorios (
    id_recordatorio INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    tipo_recordatorio ENUM('reserva', 'experiencia', 'plan', 'personal') NOT NULL DEFAULT 'personal',
    titulo VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,
    fecha_programada DATETIME NOT NULL,
    enviado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_envio DATETIME NULL,
    id_reserva INT NULL,
    id_inscripcion INT NULL,
    id_suscripcion INT NULL,
    INDEX ix_recordatorios_pendientes (enviado, fecha_programada),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (id_reserva) REFERENCES reservas(id_reserva) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (id_inscripcion) REFERENCES inscripciones_experiencia(id_inscripcion) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (id_suscripcion) REFERENCES suscripciones(id_suscripcion) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- Cada restaurante existente recibe la suscripción vigente de su plan actual.
INSERT INTO suscripciones (id_restaurante, id_plan, fecha_inicio, fecha_fin, estado_suscripcion)
SELECT r.id_restaurante, r.id_plan, CURDATE(), DATE_ADD(CURDATE(), INTERVAL p.duracion_meses MONTH), 'activa'
FROM restaurantes r JOIN planes_suscripcion p ON p.id_plan = r.id_plan
WHERE NOT EXISTS (SELECT 1 FROM suscripciones s WHERE s.id_restaurante = r.id_restaurante);
