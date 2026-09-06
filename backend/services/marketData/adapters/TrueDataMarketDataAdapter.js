const WebSocket = require('ws');
const https = require('https');
const { TrueDataInstrumentMapper } = require('./TrueDataInstrumentMapper');

class TrueDataMarketDataAdapter {
    /**
     * TrueData Authorized Real-Time Market Data Adapter
     * 
     * Connects to TrueData Real-Time Market Data Feed via WebSocket / REST endpoints.
     * TrueData is an authorized NSE/BSE market data vendor.
     * 
     * Requirements:
     * - Vendor Credentials: TRUEDATA_USERNAME, TRUEDATA_PASSWORD (or TRUEDATA_TOKEN).
     * - Zero Broker/Demat Account required.
     */
    constructor(options = {}) {
        this.username = options.username !== undefined ? options.username : process.env.TRUEDATA_USERNAME;
        this.password = options.password !== undefined ? options.password : process.env.TRUEDATA_PASSWORD;
        this.port = options.port || process.env.TRUEDATA_PORT || '8084';
        this.wsUrl = options.wsUrl || process.env.TRUEDATA_WEBSOCKET_URL || `wss://realtime.truedata.in:${this.port}`;
        this.restUrl = options.restUrl || process.env.TRUEDATA_REST_URL || 'https://api.truedata.in';

        this.ws = null;
        this.isConnected = false;
        this.isReconnecting = false;
        this.tickCallback = null;
        this.subscribedSymbols = new Set();

        this.reconnectTimer = null;
        this.pingTimer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.isExplicitlyStopped = false;
    }

    /**
     * Verify credentials and initialize provider connection
     */
    async init() {
        if (!this.username || !this.password) {
            throw new Error('[TrueDataMarketDataAdapter] Credentials missing. TRUEDATA_USERNAME and TRUEDATA_PASSWORD must be configured in environment variables.');
        }

        this.isExplicitlyStopped = false;
        return new Promise((resolve, reject) => {
            let resolved = false;
            try {
                this.connectWebSocket((err) => {
                    if (resolved) return;
                    resolved = true;
                    if (err) {
                        reject(err);
                    } else {
                        resolve(true);
                    }
                });
            } catch (err) {
                if (!resolved) {
                    resolved = true;
                    reject(err);
                }
            }
        });
    }

    onTick(callback) {
        this.tickCallback = callback;
    }

    connectWebSocket(onInitialConnect) {
        if (this.isExplicitlyStopped) return;

        const authParams = `user=${encodeURIComponent(this.username)}&pwd=${encodeURIComponent(this.password)}`;
        const fullWsUrl = `${this.wsUrl}?${authParams}`;

        try {
            this.ws = new WebSocket(fullWsUrl);
        } catch (err) {
            if (onInitialConnect) onInitialConnect(err);
            return;
        }

        this.ws.on('open', () => {
            this.isConnected = true;
            this.isReconnecting = false;
            this.reconnectAttempts = 0;
            console.log('[TrueDataMarketDataAdapter] Connected to TrueData WebSocket feed.');

            // Start heartbeat ping
            this.startHeartbeat();

            // Resubscribe symbols if reconnecting
            if (this.subscribedSymbols.size > 0) {
                this.subscribe(Array.from(this.subscribedSymbols));
            }

            if (onInitialConnect) onInitialConnect(null);
        });

        this.ws.on('message', (data) => {
            this.handleMessage(data);
        });

        this.ws.on('error', (err) => {
            console.error('[TrueDataMarketDataAdapter] WebSocket error:', err.message);
            if (onInitialConnect && !this.isConnected) {
                onInitialConnect(new Error(`TrueData connection error: ${err.message}`));
            }
        });

        this.ws.on('close', (code, reason) => {
            this.isConnected = false;
            this.stopHeartbeat();

            if (!this.isExplicitlyStopped) {
                console.warn(`[TrueDataMarketDataAdapter] Connection closed (code ${code}). Attempting reconnect...`);
                this.scheduleReconnect();
            }
        });
    }

    subscribe(symbols = []) {
        if (!Array.isArray(symbols) || symbols.length === 0) return;

        const truedataSymbols = [];
        for (const s of symbols) {
            const tdSym = TrueDataInstrumentMapper.toTrueDataSymbol(s);
            this.subscribedSymbols.add(s);
            if (tdSym) truedataSymbols.push(tdSym);
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN && truedataSymbols.length > 0) {
            const subscribeMsg = JSON.stringify({
                method: 'SUBSCRIBE',
                symbols: truedataSymbols
            });
            this.ws.send(subscribeMsg);
        }
    }

    unsubscribe(symbols = []) {
        if (!Array.isArray(symbols) || symbols.length === 0) return;

        const truedataSymbols = [];
        for (const s of symbols) {
            this.subscribedSymbols.delete(s);
            const tdSym = TrueDataInstrumentMapper.toTrueDataSymbol(s);
            if (tdSym) truedataSymbols.push(tdSym);
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN && truedataSymbols.length > 0) {
            const unsubscribeMsg = JSON.stringify({
                method: 'UNSUBSCRIBE',
                symbols: truedataSymbols
            });
            this.ws.send(unsubscribeMsg);
        }
    }

    handleMessage(rawData) {
        try {
            const text = rawData.toString('utf8');
            const msg = JSON.parse(text);

            // Handle Heartbeat / Ping Response
            if (msg.type === 'PING' || msg.status === 'HEARTBEAT') {
                return;
            }

            // Parse Tick Data
            const normalized = this.normalizeTick(msg);
            if (normalized && this.tickCallback) {
                this.tickCallback([normalized]);
            }
        } catch (err) {
            // Malformed message handling
            console.error('[TrueDataMarketDataAdapter] Failed to parse message:', err.message);
        }
    }

    normalizeTick(msg) {
        if (!msg || (!msg.symbol && !msg.raw_symbol)) return null;

        const rawSymbol = msg.symbol || msg.raw_symbol;
        const canonicalSymbol = TrueDataInstrumentMapper.toCanonicalSymbol(rawSymbol);

        const ltp = parseFloat(msg.ltp || msg.last_price || msg.price || 0);
        const previousClose = parseFloat(msg.prev_close || msg.close || ltp);
        const open = parseFloat(msg.open || ltp);
        const high = parseFloat(msg.high || ltp);
        const low = parseFloat(msg.low || ltp);
        const volume = parseInt(msg.volume || msg.v || 0, 10);
        const change = parseFloat(msg.change !== undefined ? msg.change : (ltp - previousClose));
        const changePercent = previousClose > 0 ? ((ltp - previousClose) / previousClose) * 100 : 0;

        return {
            symbol: canonicalSymbol,
            exchange: msg.exchange || 'NSE',
            ltp,
            open,
            high,
            low,
            close: previousClose,
            previousClose,
            change,
            changePercent,
            volume,
            bid: parseFloat(msg.bid || ltp),
            ask: parseFloat(msg.ask || ltp),
            timestamp: msg.timestamp ? (typeof msg.timestamp === 'number' ? msg.timestamp : new Date(msg.timestamp).getTime()) : Date.now(),
            source: 'TRUEDATA',
            feedType: 'AUTHORIZED_VENDOR_FEED',
            marketState: msg.market_state || 'REGULAR'
        };
    }

    async fetchQuotes(symbols = []) {
        // Fallback REST quote fetch if WebSocket snapshot is requested
        const truedataSymbols = symbols.map(s => TrueDataInstrumentMapper.toTrueDataSymbol(s)).filter(Boolean);
        if (truedataSymbols.length === 0) return [];

        const url = `${this.restUrl}/v2/getquote?symbols=${encodeURIComponent(truedataSymbols.join(','))}&user=${encodeURIComponent(this.username)}&pwd=${encodeURIComponent(this.password)}`;

        return new Promise((resolve, reject) => {
            const req = https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        const rawList = Array.isArray(parsed) ? parsed : (parsed.records || parsed.data || []);
                        const normalizedQuotes = rawList.map(item => this.normalizeTick(item)).filter(Boolean);
                        resolve(normalizedQuotes);
                    } catch (err) {
                        reject(new Error(`Failed to parse TrueData REST quotes: ${err.message}`));
                    }
                });
            });

            req.on('error', err => reject(new Error(`TrueData REST request error: ${err.message}`)));
            req.end();
        });
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.pingTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ method: 'PING' }));
            }
        }, 15000);
    }

    stopHeartbeat() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    scheduleReconnect() {
        if (this.isExplicitlyStopped || this.reconnectTimer) return;
        this.reconnectAttempts++;

        if (this.reconnectAttempts > this.maxReconnectAttempts) {
            console.error(`[TrueDataMarketDataAdapter] Exceeded maximum reconnect attempts (${this.maxReconnectAttempts}).`);
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`[TrueDataMarketDataAdapter] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms...`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connectWebSocket();
        }, delay);
    }

    stop() {
        this.isExplicitlyStopped = true;
        this.stopHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        console.log('[TrueDataMarketDataAdapter] Adapter stopped.');
    }
}

module.exports = { TrueDataMarketDataAdapter };
