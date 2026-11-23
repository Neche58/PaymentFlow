'use strict';

const http = require('http');
const { checkLiveness } = require('./services/workerHeartbeat');

function createWorkerHealthServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/worker/health') {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'not_found' }));
      return;
    }

    const liveness = checkLiveness();
    const now = Date.now();
    const staleLimitMs = parseInt(process.env.WORKER_HEALTH_STALE_MS || '60000', 10);
    const staleWorkers = Object.entries(liveness.workers).filter(([, worker]) => {
      if (worker.lastBeatMs == null) return true;
      return now - worker.lastBeatMs > staleLimitMs;
    });
    const healthy = staleWorkers.length === 0;

    res.statusCode = healthy ? 200 : 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      staleLimitMs,
      staleWorkers: staleWorkers.map(([name]) => name),
      workers: liveness.workers,
    }));
  });
}

module.exports = { createWorkerHealthServer };
