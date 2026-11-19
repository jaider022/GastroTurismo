'use strict';
const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  if (!stored.startsWith('scrypt$')) {
    // Compatibilidad con claves antiguas; el servidor genera el hash al validar el acceso.
    const provided = Buffer.from(password);
    const existing = Buffer.from(stored);
    return provided.length === existing.length && timingSafeEqual(provided, existing);
  }
  const [, salt, expected] = stored.split('$');
  if (!/^[0-9a-f]{32}$/.test(salt || '') || !/^[0-9a-f]{128}$/.test(expected || '')) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(expected, 'hex'));
}

module.exports = { hashPassword, verifyPassword };
