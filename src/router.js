'use strict';

require('dotenv').config();
const OpenAI = require('openai');
const prompts = require('../prompts.json');

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined
});
const MODEL = process.env.RESPONDER_MODEL || 'gpt-4o-mini';

/**
 * Routes a classified message to the correct expert persona and generates a final response.
 *
 * @param {string} message - Original user message (with @prefix stripped if override was used)
 * @param {Object} classification - Result from classifyIntent()
 * @param {string} classification.intent - Classified intent label
 * @param {number} classification.confidence - Confidence score
 * @param {boolean} classification.manualOverride - Whether @intent prefix was used
 * @returns {Promise<string>} - Final response text for the user
 */
async function routeAndRespond(message, classification) {
    const { intent } = classification;

    // Strip @intent prefix from message if it was a manual override
    const cleanMessage = message.replace(/^@\w+\s+/i, '').trim();

    // Get the appropriate persona prompt
    const persona = prompts[intent] || prompts['unclear'];

    if (intent === 'unclear') {
        // Generate a clarifying question instead of an expert response
        try {
            const response = await client.chat.completions.create({
                model: MODEL,
                temperature: 0.7,
                max_tokens: 150,
                messages: [
                    { role: 'system', content: persona.systemPrompt },
                    { role: 'user', content: cleanMessage },
                ],
            });
            return response.choices[0]?.message?.content?.trim() ||
                "I'm not sure I understood your request. Could you provide more details about what you'd like help with?";
        } catch (err) {
            console.error('[Router] API error (unclear):', err.message);
            return "I'm not sure I understood your request. Could you provide more details about what you'd like help with?";
        }
    }

    // Generate expert response using the selected system prompt
    try {
        const response = await client.chat.completions.create({
            model: MODEL,
            temperature: 0.3,
            max_tokens: 1024,
            messages: [
                { role: 'system', content: persona.systemPrompt },
                { role: 'user', content: cleanMessage },
            ],
        });

        return response.choices[0]?.message?.content?.trim() ||
            'I encountered an issue generating a response. Please try again.';
    } catch (err) {
        console.error(`[Router] API error (${intent}):`, err.message);
        throw new Error(`Failed to generate response for intent "${intent}": ${err.message}`);
    }
}

/**
 * Returns metadata about all available personas.
 * @returns {Object[]}
 */
function getPersonas() {
    return Object.values(prompts).map(({ label, description }) => ({ label, description }));
}

module.exports = { routeAndRespond, getPersonas };
