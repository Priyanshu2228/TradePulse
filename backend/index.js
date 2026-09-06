require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const { connectDB } = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');
const { simulatorInstance } = require('./services/marketSimulator');
const { executionEngineInstance } = require('./services/executionEngine');

const authRoutes = require('./routes/authRoutes');
const tradingRoutes = require('./routes/tradingRoutes');

const PORT = process.env.PORT || 8080;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Primary API Routes
app.use('/api/auth', authRoutes);
app.use('/api', tradingRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'TradePulse Backend' });
});

// Backward compatibility legacy routes for existing frontend calls before migration
const { HoldingsModel } = require('./models/Holding');
const { PositionModel } = require('./models/Position');
const { OrderModel } = require('./models/Order');

app.get('/allHoldings', async (req, res) => {
    try {
        const holdings = await HoldingsModel.find({});
        res.status(200).json(holdings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/allPositions', async (req, res) => {
    try {
        const positions = await PositionModel.find({});
        res.status(200).json(positions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/allOrders', async (req, res) => {
    try {
        const orders = await OrderModel.find({});
        res.status(200).json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Centralized error handling
app.use(errorHandler);

// HTTP Server
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected.');

    // Send initial snapshot of all market prices
    ws.send(JSON.stringify({
        type: 'SNAPSHOT',
        data: simulatorInstance.getAllInstruments()
    }));

    ws.on('close', () => {
        console.log('[WebSocket] Client disconnected.');
    });

    ws.on('error', (err) => {
        console.error('[WebSocket] Error:', err);
    });
});

// Broadcast market ticks to connected WebSocket clients
simulatorInstance.subscribe((updatedInstruments) => {
    const payload = JSON.stringify({
        type: 'TICK',
        data: updatedInstruments
    });

    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // OPEN
            client.send(payload);
        }
    });
});

// Connect execution engine to market simulator
simulatorInstance.setExecutionEngineCallback((pricesMap) => {
    executionEngineInstance.processOpenOrders(pricesMap);
});

// Start Server
async function startServer() {
    try {
        await connectDB();
        await simulatorInstance.init();
        simulatorInstance.start(2000); // 2 second tick interval

        server.listen(PORT, () => {
            console.log(`[TradePulse Server] Running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

if (process.env.NODE_ENV !== 'test') {
    startServer();
}

module.exports = { app, server, simulatorInstance, executionEngineInstance };