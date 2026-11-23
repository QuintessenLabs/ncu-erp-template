// Starts the web app: node src/server/index.js
// Then open http://127.0.0.1:3000 in your browser.

import http from 'node:http';
import { config } from '../config.js';
import { createApp } from './app.js';

// The app relies on built-in fetch and AbortSignal.timeout (Node 18.17+).
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 18 || (major === 18 && minor < 17) || typeof globalThis.fetch !== 'function') {
  console.error(`This app needs Node.js 18.17 or newer. You have ${process.version}.`);
  console.error('Install the current LTS from https://nodejs.org and run "npm start" again.');
  process.exit(1);
}

const app = createApp();
const server = http.createServer(app);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use. Close the other program, or pick another port:`);
    console.error('  PowerShell:   $env:PORT = "3001"; npm start');
    console.error('  macOS/Linux:  PORT=3001 npm start');
  } else {
    console.error('Could not start the server:', err.message);
  }
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  console.log(`NCU ERP template running at http://${config.host}:${config.port}`);
  console.log('Open that address in your browser. Do not open public/index.html directly.');
  console.log('Press Ctrl+C to stop. Nothing you enter is written to disk.');
});

// Close cleanly on Ctrl+C so the terminal returns promptly.
process.on('SIGINT', () => server.close(() => process.exit(0)));
