'use strict';

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.isAbsolute(process.env.LOG_FILE || '')
  ? process.env.LOG_FILE
  : path.join(__dirname, '..', process.env.LOG_FILE || 'route_log.jsonl');

/**
 * Appends a log entry to the JSONL log file.
 * Each entry is a JSON object on its own line (JSON Lines format).
 *
 * @param {Object} entry - The log entry object
 * @param {string} entry.userMessage   - Original user message
 * @param {string} entry.intent        - Classified intent label
 * @param {number} entry.confidence    - Confidence score (0.0–1.0)
 * @param {string} entry.finalResponse - Final response sent to the user
 * @param {boolean} [entry.manualOverride] - Whether the @intent prefix was used
 */
function logEntry(entry) {
  const record = {
    timestamp: new Date().toISOString(),
    userMessage: entry.userMessage,
    intent: entry.intent,
    confidence: entry.confidence,
    finalResponse: entry.finalResponse,
    manualOverride: entry.manualOverride || false,
  };

  const line = JSON.stringify(record) + '\n';

  try {
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (err) {
    console.error('[Logger] Failed to write log entry:', err.message);
  }
}

/**
 * Reads and returns the last N log entries from the JSONL file.
 *
 * @param {number} [limit=50] - Max number of entries to return
 * @returns {Object[]} Array of log entry objects
 */
function readLogs(limit = 50) {
  if (!fs.existsSync(LOG_FILE)) return [];

  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);
  const recent = lines.slice(-limit);

  return recent.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

module.exports = { logEntry, readLogs };
