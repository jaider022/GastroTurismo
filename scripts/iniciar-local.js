'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.join(__dirname, '..');
process.chdir(root);
require('dotenv').config({ path: path.join(root, '.env') });

function available(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: process.env.DB_HOST || '127.0.0.1', port });
    let done = false;
    const finish = result => { if (!done) { done = true; socket.destroy(); resolve(result); } };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(700, () => finish(false));
  });
}
async function run() {
  const port = Number(process.env.DB_PORT) || 3306;
  const configPath = path.join(root, 'database', 'entorno-local.json');
  if (!(await available(port)) && fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (fs.existsSync(config.executable) && fs.existsSync(path.join(config.datadir, 'my.ini'))) {
      const child = spawn(config.executable, [`--defaults-file=${path.join(config.datadir, 'my.ini')}`, '--bind-address=127.0.0.1', `--port=${port}`, '--skip-name-resolve'], {
        detached: true, windowsHide: true, stdio: 'ignore'
      });
      child.on('error', () => console.warn('No fue posible iniciar el motor local. Revisa MySQL.'));
      child.unref();
      for (let i = 0; i < 20 && !(await available(port)); i++) await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  await require('../server').start();
}
run().catch(error => { console.error('No fue posible iniciar:', error.message); process.exitCode = 1; });
