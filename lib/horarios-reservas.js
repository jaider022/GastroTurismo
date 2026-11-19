'use strict';

const DURACION_RESERVA = 120;

function reservationSchedule(restaurant) {
  const name = String(restaurant?.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return { opening: name === 'cafe sorrento' ? 510 : 660, closing: 1350, duration: DURACION_RESERVA };
}

function reservationTimeError(restaurant, time) {
  const match = typeof time === 'string' && /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] || 0) > 59) return 'Indica una hora válida.';
  const minute = Number(match[1]) * 60 + Number(match[2]);
  const { opening, closing, duration } = reservationSchedule(restaurant);
  if (minute < opening || minute >= closing) {
    return `El restaurante está cerrado a esa hora. Atiende de ${opening === 510 ? '8:30' : '11:00'} a. m. a 10:30 p. m.`;
  }
  if (minute + duration > closing) return 'La reserva dura dos horas y debe terminar a más tardar a las 10:30 p. m. La última hora de llegada es a las 8:30 p. m.';
  if (minute % 15 !== 0 || Number(match[3] || 0) !== 0) return 'Selecciona una hora en intervalos de 15 minutos.';
  return '';
}

module.exports = { DURACION_RESERVA, reservationSchedule, reservationTimeError };
