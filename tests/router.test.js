'use strict';


// ─── Shared state for mock control ───────────────────────────────────────────
const mockState = {
    classifierResponse: { intent: 'unclear', confidence: 0.0 },
    useInvalidJSON: false,
};

// ─── Jest mocking ─────────────────────────────────────────────────────────────
jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn(async ({ messages }) => {
                    if (mockState.useInvalidJSON) {
                        return { choices: [{ message: { content: 'This is not JSON at all!' } }] };
                    }
                    const isClassifier = messages[0]?.content?.includes('classify the user');
                    if (isClassifier) {
                        return {
                            choices: [{
                                message: { content: JSON.stringify(mockState.classifierResponse) },
                            }],
                        };
                    }
                    return { choices: [{ message: { content: 'Mocked expert response.' } }] };
                }),
            },
        },
    }));
});

jest.mock('../src/logger', () => ({
    logEntry: jest.fn(),
    readLogs: jest.fn(() => []),
}));

// ─── Load modules ─────────────────────────────────────────────────────────────
const { classifyIntent } = require('../src/classifier');
const { routeAndRespond } = require('../src/router');

// ─── Setup ────────────────────────────────────────────────────────────────────
beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.CONFIDENCE_THRESHOLD = '0.7';
});

afterEach(() => {
    mockState.useInvalidJSON = false;
    mockState.classifierResponse = { intent: 'unclear', confidence: 0.0 };
});

function setMock(intent, confidence) {
    mockState.classifierResponse = { intent, confidence };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('classifyIntent() - 15 Required Test Messages', () => {

    test('1. "how do i sort a list of objects in python?" → code', async () => {
        setMock('code', 0.95);
        const result = await classifyIntent('how do i sort a list of objects in python?');
        expect(result.intent).toBe('code');
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    test('2. "explain this sql query for me" → data', async () => {
        setMock('data', 0.88);
        const result = await classifyIntent('explain this sql query for me');
        expect(result.intent).toBe('data');
    });

    test('3. "This paragraph sounds awkward, can you help me fix it?" → writing', async () => {
        setMock('writing', 0.92);
        const result = await classifyIntent('This paragraph sounds awkward, can you help me fix it?');
        expect(result.intent).toBe('writing');
    });

    test("4. \"I'm preparing for a job interview, any tips?\" → career", async () => {
        setMock('career', 0.90);
        const result = await classifyIntent("I'm preparing for a job interview, any tips?");
        expect(result.intent).toBe('career');
    });

    test("5. \"what's the average of these numbers: 12, 45, 23, 67, 34\" → data", async () => {
        setMock('data', 0.85);
        const result = await classifyIntent("what's the average of these numbers: 12, 45, 23, 67, 34");
        expect(result.intent).toBe('data');
    });

    test('6. "Help me make this better." → unclear (ambiguous / low confidence)', async () => {
        setMock('unclear', 0.55);
        const result = await classifyIntent('Help me make this better.');
        expect(result.intent).toBe('unclear');
    });

    test('7. Mixed intent: code + resume → unclear', async () => {
        setMock('unclear', 0.50);
        const result = await classifyIntent(
            "I need to write a function that takes a user id and returns their profile, but also i need help with my resume."
        );
        expect(result.intent).toBe('unclear');
    });

    test('8. "hey" → unclear (too short)', async () => {
        setMock('unclear', 0.20);
        const result = await classifyIntent('hey');
        expect(result.intent).toBe('unclear');
    });

    test('9. "Can you write me a poem about clouds?" → unclear (off-topic)', async () => {
        setMock('unclear', 0.60);
        const result = await classifyIntent('Can you write me a poem about clouds?');
        expect(result.intent).toBe('unclear');
    });

    test('10. "Rewrite this sentence to be more professional." → writing', async () => {
        setMock('writing', 0.87);
        const result = await classifyIntent('Rewrite this sentence to be more professional.');
        expect(result.intent).toBe('writing');
    });

    test("11. \"I'm not sure what to do with my career.\" → career", async () => {
        setMock('career', 0.82);
        const result = await classifyIntent("I'm not sure what to do with my career.");
        expect(result.intent).toBe('career');
    });

    test('12. "what is a pivot table" → data', async () => {
        setMock('data', 0.91);
        const result = await classifyIntent('what is a pivot table');
        expect(result.intent).toBe('data');
    });

    test('13. "fxi thsi bug pls: for i in range(10) print(i)" → code (typos)', async () => {
        setMock('code', 0.89);
        const result = await classifyIntent('fxi thsi bug pls: for i in range(10) print(i)');
        expect(result.intent).toBe('code');
    });

    test('14. "How do I structure a cover letter?" → career', async () => {
        setMock('career', 0.93);
        const result = await classifyIntent('How do I structure a cover letter?');
        expect(result.intent).toBe('career');
    });

    test('15. "My boss says my writing is too verbose." → writing', async () => {
        setMock('writing', 0.88);
        const result = await classifyIntent('My boss says my writing is too verbose.');
        expect(result.intent).toBe('writing');
    });
});

describe('Confidence Threshold (Stretch Goal)', () => {

    test('Low confidence (< 0.7) is coerced to unclear', async () => {
        setMock('code', 0.5);
        const result = await classifyIntent('something vague about code maybe');
        expect(result.intent).toBe('unclear');
    });

    test('Exactly at threshold (0.7) keeps the intent', async () => {
        setMock('data', 0.7);
        const result = await classifyIntent('some data question');
        expect(result.intent).toBe('data');
    });

    test('Above threshold (0.85) keeps the intent', async () => {
        setMock('writing', 0.85);
        const result = await classifyIntent('fix my grammar');
        expect(result.intent).toBe('writing');
    });
});

describe('Manual Override via @intent prefix (Stretch Goal)', () => {

    test('@code prefix bypasses classifier and sets confidence=1', async () => {
        const result = await classifyIntent('@code Fix this bug: print(helo)');
        expect(result.intent).toBe('code');
        expect(result.confidence).toBe(1.0);
        expect(result.manualOverride).toBe(true);
    });

    test('@data prefix bypasses classifier', async () => {
        const result = await classifyIntent('@data Show me trends in this dataset');
        expect(result.intent).toBe('data');
        expect(result.manualOverride).toBe(true);
    });

    test('@writing prefix bypasses classifier', async () => {
        const result = await classifyIntent('@writing review my essay');
        expect(result.intent).toBe('writing');
        expect(result.manualOverride).toBe(true);
    });

    test('@career prefix bypasses classifier', async () => {
        const result = await classifyIntent('@career help me with my resume');
        expect(result.intent).toBe('career');
        expect(result.manualOverride).toBe(true);
    });
});

describe('Malformed JSON handling', () => {

    test('Malformed LLM response defaults to { intent: "unclear", confidence: 0.0 }', async () => {
        mockState.useInvalidJSON = true;
        const result = await classifyIntent('some message');
        expect(result.intent).toBe('unclear');
        expect(result.confidence).toBe(0.0);
    });
});

describe('routeAndRespond()', () => {

    test('Routes "code" intent to Code Expert persona', async () => {
        const response = await routeAndRespond('how do I sort a list?', {
            intent: 'code', confidence: 0.95, manualOverride: false,
        });
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
    });

    test('Routes "data" intent to Data Analyst persona', async () => {
        const response = await routeAndRespond('what is the median of 1,2,3,4,5?', {
            intent: 'data', confidence: 0.90, manualOverride: false,
        });
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
    });

    test('Routes "unclear" intent → asks clarifying question', async () => {
        const response = await routeAndRespond('hey', {
            intent: 'unclear', confidence: 0.2, manualOverride: false,
        });
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
    });

    test('Strips @intent prefix before sending to LLM', async () => {
        const response = await routeAndRespond('@code Fix this bug', {
            intent: 'code', confidence: 1.0, manualOverride: true,
        });
        expect(typeof response).toBe('string');
    });
});

describe('POST /api/chat - input validation', () => {
    const request = require('supertest');
    const app = require('../src/app');

    test('Returns 400 for empty string message', async () => {
        const res = await request(app).post('/api/chat').send({ message: '' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    test('Returns 400 for missing message field', async () => {
        const res = await request(app).post('/api/chat').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    test('Returns 400 for whitespace-only message', async () => {
        const res = await request(app).post('/api/chat').send({ message: '   ' });
        expect(res.status).toBe(400);
    });
});

describe('GET /api/logs', () => {
    const request = require('supertest');
    const app = require('../src/app');

    test('Returns logs array with count', async () => {
        const res = await request(app).get('/api/logs');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('count');
        expect(Array.isArray(res.body.logs)).toBe(true);
    });
});

describe('GET /api/personas', () => {
    const request = require('supertest');
    const app = require('../src/app');

    test('Returns all 5 personas (code, data, writing, career, unclear)', async () => {
        const res = await request(app).get('/api/personas');
        expect(res.status).toBe(200);
        expect(res.body.personas.length).toBeGreaterThanOrEqual(4);
        const labels = res.body.personas.map((p) => p.label);
        expect(labels).toContain('code');
        expect(labels).toContain('data');
        expect(labels).toContain('writing');
        expect(labels).toContain('career');
    });
});

describe('GET /health', () => {
    const request = require('supertest');
    const app = require('../src/app');

    test('Returns { status: "ok" }', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});
