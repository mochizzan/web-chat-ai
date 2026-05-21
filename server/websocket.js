/* eslint-disable */
// ============================================================
// WebSocket Server — Real-Time Sync for ai-chat-web
// Run: node server/websocket.js
// Port: 3003 (configurable via WS_PORT env)
// ============================================================
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const mysql = require('mysql2/promise');

const PORT = parseInt(process.env.WS_PORT || '3003');
const POLL_INTERVAL = parseInt(process.env.WS_POLL_INTERVAL || '30000'); // 30 detik

let wss;
let server;
let pool;

let modelsCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// --- Periodic Polling State ---
let lastSnapshot = null; // { count: number, maxUpdatedAt: string | null }

async function getModelsSnapshot() {
  if (!pool) return null;
  try {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as cnt, MAX(updated_at) as max_updated FROM models'
    );
    return { count: rows[0].cnt, maxUpdatedAt: rows[0].max_updated };
  } catch (err) {
    console.error('[WS] Polling snapshot error:', err.message);
    return null;
  }
}

async function startPeriodicPolling() {
  // Initial snapshot
  lastSnapshot = await getModelsSnapshot();
  console.log('[WS] Initial models snapshot:', lastSnapshot);

  setInterval(async () => {
    const currentSnapshot = await getModelsSnapshot();
    if (!currentSnapshot || !lastSnapshot) {
      lastSnapshot = currentSnapshot;
      return;
    }

    // Compare with previous snapshot
    const changed =
      currentSnapshot.count !== lastSnapshot.count ||
      currentSnapshot.maxUpdatedAt !== lastSnapshot.maxUpdatedAt;

    if (changed) {
      console.log('[WS] Models changed in DB — broadcasting models:changed');
      lastSnapshot = currentSnapshot;
      modelsCache = null; // invalidate cache

      // Broadcast to all connected clients
      const delivered = broadcast({ type: 'models:changed' });
      console.log(`[WS] Broadcast models:changed delivered to ${delivered} clients`);
    }
  }, POLL_INTERVAL);
}

async function startServer() {
  // Initialize DB Pool
  try {
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 5,
      idleTimeout: 60000,
      queueLimit: 0,
    });
    console.log('[WS] Database pool initialized');
  } catch (err) {
    console.error('[WS] Database pool initialization failed:', err);
  }

  // Create an HTTP server to handle both WebSocket upgrades and HTTP POST requests
  server = http.createServer((req, res) => {
    // Handle HTTP POST requests for broadcasting
    if (req.method === 'POST' && req.url === '/broadcast') {
      const apiKey = req.headers['x-api-key'];
      const requiredKey = process.env.WS_BROADCAST_KEY || 'strong-fallback-key-12345';

      if (!apiKey || apiKey !== requiredKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid or missing API Key' }));
        return;
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const count = broadcast(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, delivered: count }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
        }
      });
      return;
    }

    // Default response for other HTTP requests
    res.writeHead(404);
    res.end();
  });

  wss = new WebSocketServer({ server });

  console.log(`[WS] WebSocket & HTTP server running on port ${PORT}`);

  // Start periodic polling for DB changes
  startPeriodicPolling();

  // Heartbeat interval to keep connections alive and prune dead ones
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log('[WS] Terminating inactive client');
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.send(JSON.stringify({ type: 'ping' }));
    });
  }, 30000);

  server.on('close', () => {
    clearInterval(interval);
  });

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    
    // Initialize heartbeat state
    ws.isAlive = true;

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        // Handle pong from client
        if (msg.type === 'pong') {
          ws.isAlive = true;
          return;
        }
        
        // Handle ping from client (legacy support)
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        // Handle Initial Sync Request
        if (msg.type === 'request:initial_sync') {
          console.log(`[WS] Initial sync request for user: ${msg.userId || 'Anonymous'}`);
          
          try {
            if (!pool) throw new Error('Database pool not initialized');

            // 1. Fetch all active models (with caching)
            let mappedModels;
            const now = Date.now();
            if (modelsCache && (now - lastCacheTime < CACHE_TTL)) {
              mappedModels = modelsCache;
            } else {
              const models = await pool.execute('SELECT * FROM models');
              mappedModels = models[0].map(m => ({
                id: m.id,
                name: m.name,
                provider: m.provider,
                description: m.description,
                status: m.status || 'disabled',
                maxContext: m.max_context,
                thinking: !!m.thinking,
                inputPrice: parseFloat(m.input_price),
                outputPrice: parseFloat(m.output_price),
                free: !!m.free,
                speed: m.speed || 'normal',
                discountPercent: parseFloat(m.discount_percent) || 0,
                discountType: m.discount_type || 'none',
              }));
              modelsCache = mappedModels;
              lastCacheTime = now;
            }

            // 2. Fetch user data if userId is provided and valid
            let user = null;
            if (msg.userId && (typeof msg.userId === 'string' || typeof msg.userId === 'number')) {
              const userRows = await pool.execute('SELECT * FROM users WHERE id = ?', [msg.userId]);
              if (userRows[0].length > 0) {
                const u = userRows[0][0];
                user = {
                  id: u.id,
                  email: u.email,
                  name: u.name,
                  role: u.role,
                  credit: parseFloat(u.credit),
                  totalSpent: parseFloat(u.total_spent),
                  createdAt: u.created_at,
                };
              }
            }

            // 3. Send response
            ws.send(JSON.stringify({
              type: 'response:initial_sync',
              models: mappedModels,
              user: user || null,
              credit: user ? user.credit : 0,
            }));
          } catch (dbErr) {
            console.error('[WS] Database error during initial sync:', dbErr);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to sync initial data' }));
          }
        }
      } catch (err) {
        console.error('[WS] Error processing message:', err);
      }
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    });
  });

  server.listen(PORT, () => {
    console.log('[WS] Server started. Press Ctrl+C to stop.');
  });

  return { server, wss };
}

function broadcast(data) {
  if (!wss) return 0;
  const message = JSON.stringify(data);
  let count = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      count++;
    }
  });
  return count;
}

// If run directly: node server/websocket.js
if (require.main === module) {
  startServer();
}

module.exports = { startServer, broadcast };
