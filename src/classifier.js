'use strict';

require('dotenv').config();
const OpenAI = require('openai');

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined
});
const MODEL = process.env.CLASSIFIER_MODEL || 'gpt-4o-mini';
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.7');

const VALID_INTENTS = ['code', 'data', 'writing', 'career', 'unclear'];

const CLASSIFIER_PROMPT = `Your task is to classify the user's intent.

Based on the user message below, choose EXACTLY ONE of the following labels:
- code     : Programming, debugging, code review, software architecture, scripts
- data     : Data analysis, statistics, SQL, spreadsheets, datasets, numbers
- writing  : Editing text, grammar, clarity, tone, structure of written content
- career   : Job search, resume, interviews, professional development, career advice
- unclear  : The message is ambiguous, off-topic, or doesn't fit the above categories

Respond with ONLY a single valid JSON object and NO other text:
{"intent": "<label>", "confidence": <float 0.0-1.0>}`;

/**
 * Classifies the user's intent by making a lightweight LLM call.
 * Supports the @intent manual override prefix.
 *
 * @param {string} message - The raw user message
 * @returns {Promise<{intent: string, confidence: number, manualOverride: boolean}>}
 */
async function classifyIntent(message) {
    // --- Stretch Goal: Manual Override via @intent prefix ---
    const overrideMatch = message.match(/^@(\w+)\s/i);
    if (overrideMatch) {
        const overrideIntent = overrideMatch[1].toLowerCase();
        if (VALID_INTENTS.includes(overrideIntent) && overrideIntent !== 'unclear') {
            return { intent: overrideIntent, confidence: 1.0, manualOverride: true };
        }
    }

    try {
        const response = await client.chat.completions.create({
            model: MODEL,
            temperature: 0,
            max_tokens: 80,
            messages: [
                { role: 'system', content: CLASSIFIER_PROMPT },
                { role: 'user', content: message },
            ],
        });

        const rawText = response.choices[0]?.message?.content?.trim() || '';
        let parsed;

        try {
            // Handle JSON wrapped in markdown code blocks (e.g. ```json ... ```)
            const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        } catch {
            console.warn('[Classifier] Malformed JSON from LLM, defaulting to unclear. Raw:', rawText);
            return { intent: 'unclear', confidence: 0.0, manualOverride: false };
        }

        const intent = VALID_INTENTS.includes(parsed.intent) ? parsed.intent : 'unclear';
        const confidence = typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0.0;

        // --- Stretch Goal: Confidence Threshold ---
        if (intent !== 'unclear' && confidence < CONFIDENCE_THRESHOLD) {
            console.log(`[Classifier] Low confidence (${confidence}) for "${intent}", treating as unclear.`);
            return { intent: 'unclear', confidence, manualOverride: false };
        }

        return { intent, confidence, manualOverride: false };
    } catch (err) {
        console.error('[Classifier] API error:', err.message);
        return { intent: 'unclear', confidence: 0.0, manualOverride: false };
    }
}

module.exports = { classifyIntent };
