'use strict';

function bogotaDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function formatDate(date) { return date.toISOString().slice(0, 10); }
function nextDay(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return formatDate(date);
}

// The strings are local Colombian calendar dates. MySQL connections use -05:00.
function comparisonPeriods(query = {}, now = new Date()) {
  const cutoff = query.fecha_corte || bogotaDate(now);
  if (!validDate(cutoff) || cutoff > bogotaDate(now)) {
    throw new Error('La fecha de corte debe ser válida y no puede estar en el futuro.');
  }
  const mode = query.comparacion || 'mismo_corte';
  if (!['mismo_corte', 'mes_completo'].includes(mode)) {
    throw new Error('La comparación debe ser mismo_corte o mes_completo.');
  }
  const [year, month, day] = cutoff.split('-').map(Number);
  const currentStart = `${cutoff.slice(0, 7)}-01`;
  const previousStart = formatDate(new Date(Date.UTC(year, month - 2, 1)));
  const previousLast = new Date(Date.UTC(year, month - 1, 0));
  const previousEnd = mode === 'mes_completo'
    ? formatDate(previousLast)
    : formatDate(new Date(Date.UTC(year, month - 2, Math.min(day, previousLast.getUTCDate()))));
  return [
    { periodo: 'Mes anterior', desde: previousStart, hasta: previousEnd, hasta_exclusivo: nextDay(previousEnd) },
    { periodo: 'Mes actual', desde: currentStart, hasta: cutoff, hasta_exclusivo: nextDay(cutoff) }
  ];
}

module.exports = { bogotaDate, validDate, comparisonPeriods };
