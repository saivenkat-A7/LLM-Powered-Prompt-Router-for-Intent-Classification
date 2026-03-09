'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { classifyIntent } = require('./classifier');
const { routeAndRespond, getPersonas } = require('./router');
const { logEntry, readLogs } = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/personas
 * Returns all available expert personas.
 */
app.get('/api/personas', (req, res) => {
    res.json({ personas: getPersonas() });
});

/**
 * POST /api/chat
 * Main endpoint: classify intent → route → generate response → log
 *
 * Request body: { "message": "string" }
 * Response:     { intent, confidence, manualOverride, response }
 */
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Request body must contain a non-empty "message" string.',
        });
    }

    const trimmedMessage = message.trim();

    try {
        // Step 1: Classify Intent
        const classification = await classifyIntent(trimmedMessage);

        // Step 2: Route and Respond
        const finalResponse = await routeAndRespond(trimmedMessage, classification);

        // Step 3: Log the interaction
        logEntry({
            userMessage: trimmedMessage,
            intent: classification.intent,
            confidence: classification.confidence,
            finalResponse,
            manualOverride: classification.manualOverride,
        });

        // Step 4: Return the response
        return res.json({
            intent: classification.intent,
            confidence: classification.confidence,
            manualOverride: classification.manualOverride,
            response: finalResponse,
        });
    } catch (err) {
        console.error('[App] Unhandled error in /api/chat:', err.message);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: err.message,
        });
    }
});

/**
 * GET /api/logs
 * Returns recent log entries from route_log.jsonl
 * Query params: ?limit=50 (default 50, max 200)
 */
app.get('/api/logs', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const logs = readLogs(limit);
    res.json({ count: logs.length, logs });
});

/**
 * 404 handler
 */
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
});

/**
 * Global error handler
 */
app.use((err, req, res, _next) => {
    console.error('[App] Global error:', err.stack);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// ─── Export ──────────────────────────────────────────────────────────────────
module.exports = app;
