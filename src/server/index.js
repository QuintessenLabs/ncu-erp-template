// Starts the web app: node src/server/index.js
// Then open http://127.0.0.1:3000 in your browser.

import http from 'node:http';
import { config } from '../config.js';
import { createApp } from './app.js';

const app = createApp();
const server = http.createServer(app);

server.listen(config.port, config.host, () => {
  console.log(`NCU ERP template running at http://${config.host}:${config.port}`);
  console.log('Press Ctrl+C to stop. Nothing you enter is written to disk.');
});

// Close cleanly on Ctrl+C so the terminal returns promptly.
process.on('SIGINT', () => server.close(() => process.exit(0)));
