'use strict';

/**
 * LLM Prompt Router - Interactive CLI
 *
 * Usage: node src/cli.js
 * Tips:
 *   - Type @code, @data, @writing, or @career to manually override the router.
 *   - Type 'exit' or 'quit' to stop.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const readline = require('readline');
const { classifyIntent } = require('./classifier');
const { routeAndRespond } = require('./router');
const { logEntry } = require('./logger');

const COLORS = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
};

const INTENT_COLORS = {
    code: COLORS.cyan,
    data: COLORS.green,
    writing: COLORS.yellow,
    career: COLORS.magenta,
    unclear: COLORS.red,
};

const INTENT_ICONS = {
    code: '🧑‍💻',
    data: '📊',
    writing: '✍️ ',
    career: '💼',
    unclear: '🤔',
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function colorize(text, color) {
    return `${color}${text}${COLORS.reset}`;
}

function printBanner() {
    console.log('\n' + colorize('╔══════════════════════════════════════════╗', COLORS.cyan));
    console.log(colorize('║   LLM Prompt Router – Intent Classifier  ║', COLORS.cyan));
    console.log(colorize('╚══════════════════════════════════════════╝', COLORS.cyan));
    console.log(colorize('\nAvailable intents:', COLORS.dim));
    console.log('  🧑‍💻 @code    – Programming & debugging');
    console.log('  📊 @data    – Data analysis & statistics');
    console.log('  ✍️  @writing  – Writing & editing');
    console.log('  💼 @career  – Career advice');
    console.log(colorize('\nTip: prefix your message with @intent to override routing.\n', COLORS.dim));
}

async function processMessage(message) {
    try {
        console.log(colorize('\n⏳ Classifying intent...', COLORS.dim));
        const classification = await classifyIntent(message);

        const { intent, confidence, manualOverride } = classification;
        const icon = INTENT_ICONS[intent] || '❓';
        const col = INTENT_COLORS[intent] || COLORS.reset;

        console.log(
            `\n${icon} Intent: ${colorize(intent.toUpperCase(), col + COLORS.bold)}  ` +
            `Confidence: ${colorize((confidence * 100).toFixed(1) + '%', col)}` +
            (manualOverride ? colorize('  [MANUAL OVERRIDE]', COLORS.yellow) : '')
        );

        console.log(colorize('\n⏳ Generating response...', COLORS.dim));
        const finalResponse = await routeAndRespond(message, classification);

        console.log('\n' + colorize('─'.repeat(50), COLORS.dim));
        console.log(finalResponse);
        console.log(colorize('─'.repeat(50), COLORS.dim));

        logEntry({ userMessage: message, intent, confidence, finalResponse, manualOverride });
    } catch (err) {
        console.error(colorize('\n❌ Error: ' + err.message, COLORS.red));
    }
}

function prompt() {
    rl.question(colorize('\n> You: ', COLORS.bold), async (input) => {
        const trimmed = input.trim();

        if (!trimmed) {
            return prompt();
        }
        if (['exit', 'quit', 'q'].includes(trimmed.toLowerCase())) {
            console.log(colorize('\nGoodbye! 👋\n', COLORS.cyan));
            rl.close();
            return;
        }

        await processMessage(trimmed);
        prompt();
    });
}

printBanner();
prompt();
