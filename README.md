# LLM Prompt Router for Intent Classification

An intelligent **Node.js** service that classifies a user's message intent and routes it to a specialized AI expert persona — producing sharper, more focused responses than a single generic system prompt ever could.

Built for the [Partnr Network Global Placement Program](https://app.partnr.network/global-placement-program/tasks/6bb73497a3bb4bf7b828) mandatory task.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Project Structure](#project-structure)
- [Quick Start — Docker (Recommended)](#quick-start--docker-recommended)
- [Quick Start — Local Node.js](#quick-start--local-nodejs)
- [API Reference](#api-reference)
- [Expert Personas](#expert-personas)
- [Configuration](#configuration)
- [Testing](#testing)
- [Logging](#logging)
- [Stretch Goals](#stretch-goals)
- [Submission Checklist](#submission-checklist)

---

## Overview

The **naive approach** to building LLM-powered assistants is one giant system prompt that tries to handle everything — producing mediocre, generic results.

This project implements **Prompt Routing**: a two-step *Classify → Respond* pipeline:

1. A **lightweight LLM call** classifies the user's intent into one of four expert categories.
2. A **second focused LLM call** uses a specialized "expert persona" system prompt to generate a high-quality, context-aware response.

```
User Message
    │
    ▼
┌─────────────────────────────────────────────────────┐
│              STEP 1 — CLASSIFY INTENT               │
│   classifyIntent(message)                           │
│   • Lightweight LLM call (fast & cheap)             │
│   • Returns: { intent, confidence }                 │
│   • Supports @intent manual override                │
│   • Confidence threshold: < 0.7 → "unclear"        │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌────────────┬──────────────┬───────────┬──────────┬──────────────┐
│    code    │    data      │  writing  │  career  │   unclear    │
│ 🧑‍💻 Expert │ 📊 Analyst   │ ✍️ Coach  │ 💼 Advisor│ 🤔 Clarify  │
└────────────┴──────────────┴───────────┴──────────┴──────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│             STEP 2 — ROUTE & RESPOND                │
│   routeAndRespond(message, classification)          │
│   • Selects expert system prompt from prompts.json  │
│   • Makes second LLM call with persona context      │
│   • Returns final response string                   │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│                    LOGGING                          │
│   route_log.jsonl  (JSON Lines format)              │
│   { timestamp, userMessage, intent, confidence,     │
│     finalResponse, manualOverride }                 │
└─────────────────────────────────────────────────────┘
```

---

## Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────────┐
│                    CLIENT LAYER                      │
│          REST API / CLI / Web Browser                │
└────────────────────┬─────────────────────────────────┘
                     │ HTTP
                     ▼
┌──────────────────────────────────────────────────────┐
│               EXPRESS API SERVER                     │
│  src/app.js                                          │
│                                                      │
│  POST /api/chat    ── classify + route + respond     │
│  GET  /api/logs    ── view interaction log           │
│  GET  /api/personas── list available personas        │
│  GET  /health      ── health check                   │
└────────┬─────────────────────┬────────────────────────┘
         │                     │
         ▼                     ▼
┌────────────────┐    ┌──────────────────────────────┐
│  CLASSIFIER    │    │          ROUTER              │
│ src/           │    │  src/router.js               │
│ classifier.js  │    │                              │
│                │    │  routeAndRespond()           │
│ classifyIntent │    │  • Loads prompts.json        │
│ ()             │    │  • Second LLM call           │
│ • Short call   │    │  • Handles "unclear"         │
│ • Parses JSON  │    └──────────────┬───────────────┘
│ • @override    │                   │
│ • conf. check  │    ┌──────────────▼───────────────┐
└────────┬───────┘    │       PROMPTS CONFIG         │
         │            │  prompts.json                │
         │            │  code│data│writing│career    │
         │            └──────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                    LOGGER                           │
│  src/logger.js                                      │
│  logEntry() → appends to route_log.jsonl            │
│  readLogs()  → reads N most recent entries          │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│               OPENAI API (External)                 │
│  Classifier: gpt-4o-mini (fast, low cost)           │
│  Responder:  gpt-4o-mini (detailed response)        │
└─────────────────────────────────────────────────────┘
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `src/app.js` | Express server, HTTP routing, request validation |
| `src/classifier.js` | Intent classification, @override, confidence threshold |
| `src/router.js` | Expert persona selection, final LLM response |
| `src/logger.js` | Append-only JSONL logging and log retrieval |
| `src/cli.js` | Interactive colorized command-line interface |
| `prompts.json` | Configuration for all expert system prompts |
| `tests/router.test.js` | Jest test suite (33 tests, all passing) |

---

## Features

- **Two-step LLM pipeline** — classify intent, then respond with expert persona
- **4 Expert Personas** — Code Expert, Data Analyst, Writing Coach, Career Advisor
- **Confidence scoring** — every classification includes a 0.0–1.0 score
- **Confidence threshold** — messages below 0.7 are treated as `unclear`
- **Manual `@intent` override** — prefix to bypass the classifier instantly
- **Graceful error handling** — malformed LLM JSON defaults safely to `unclear`
- **JSON Lines logging** — every interaction is logged to `route_log.jsonl`
- **REST API** — full Express.js API
- **Interactive Web UI** — a premium chat interface (HTML/CSS/JS) served directly from the application
- **Interactive CLI** — colorized terminal interface with intent icons
- **Docker support** — multi-stage Dockerfile + docker-compose
- **Full test suite** — 33 Jest tests, all passing, no API key required

---

## Web Interface

The application now includes a **premium web-based chat interface** for easier interaction and real-time visualization of the prompt routing process.

- **URL:** `http://localhost:3000`
- **Features:**
    - Real-time intent classification display.
    - Confidence scoring visualization.
    - Expert persona icon and color coding.
    - Interaction history modal (view last 20 logs).
    - Mobile-responsive design.

To access the UI, simply start the application (locally or via Docker) and open your browser to `http://localhost:3000`.

---

## Project Structure

```
llm-prompt-router/
├── index.js              # Entry point
├── prompts.json          # Expert system prompts (configurable)
├── package.json
├── .env.example          # Environment variable template
├── .gitignore
├── Dockerfile            # Multi-stage production Docker build
├── docker-compose.yml    # Compose file with log volume
├── route_log.jsonl       # Sample interaction log from testing
│
├── src/
│   ├── app.js            # Express REST API
│   ├── classifier.js     # classifyIntent() — Step 1
│   ├── router.js         # routeAndRespond() — Step 2
│   ├── logger.js         # JSONL logging
│   └── cli.js            # Interactive CLI
│
└── tests/
    └── router.test.js    # Jest test suite (33 tests)
```

---

## Quick Start — Docker (Recommended)

### Prerequisites
- [Docker](https://www.docker.com/get-started) and Docker Compose
- An [OpenAI API key](https://platform.openai.com/api-keys)

### 1. Configure environment

```bash
copy .env.example .env
# Open .env and set: OPENAI_API_KEY=sk-...
```

### 2. Build and run

```bash
docker compose up --build
```

The server starts at **http://localhost:3000**.

Logs are persisted in the `./logs/` directory on your host machine.

### 3. Test it

```bash
# Classify a message and get an expert response
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "how do I sort a list in Python?"}'

# View recent log entries
curl http://localhost:3000/api/logs

# Health check
curl http://localhost:3000/health
```

### 4. Stop the container

```bash
docker compose down
```

---

## Quick Start — Local Node.js

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- An [OpenAI API key](https://platform.openai.com/api-keys)

```bash
# 1. Install dependencies
npm install

# 2. Configure
copy .env.example .env
#    Edit .env → set OPENAI_API_KEY=sk-...

# 3. Start server (http://localhost:3000)
npm start

# 4. Or use the interactive colorized CLI
npm run cli

# 5. Run tests (no API key required)
npm test
```

---

## API Reference

### `POST /api/chat`

Main endpoint: classify intent → route to expert → generate response → log.

**Request**

```http
POST /api/chat
Content-Type: application/json

{ "message": "how do I sort a list of objects in Python?" }
```

**Response**

```json
{
  "intent": "code",
  "confidence": 0.95,
  "manualOverride": false,
  "response": "To sort a list of dictionaries in Python, use `sorted()` with a `key` argument..."
}
```

**cURL Example**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "how do I sort a list in Python?"}'
```

---

### `GET /api/logs`

Returns recent entries from `route_log.jsonl`.

| Query Param | Default | Max | Description |
|-------------|---------|-----|-------------|
| `limit` | 50 | 200 | Number of entries |

```bash
curl "http://localhost:3000/api/logs?limit=10"
```

**Response**

```json
{
  "count": 1,
  "logs": [{
    "timestamp": "2026-03-08T11:00:01.234Z",
    "userMessage": "how do I sort a list in Python?",
    "intent": "code",
    "confidence": 0.95,
    "finalResponse": "...",
    "manualOverride": false
  }]
}
```

---

### `GET /api/personas`

```bash
curl http://localhost:3000/api/personas
```

```json
{
  "personas": [
    { "label": "code",    "description": "Expert programmer and software engineer" },
    { "label": "data",    "description": "Data analyst and statistician" },
    { "label": "writing", "description": "Writing coach and editor" },
    { "label": "career",  "description": "Pragmatic career advisor" },
    { "label": "unclear", "description": "Clarification handler" }
  ]
}
```

---

### `GET /health`

```bash
curl http://localhost:3000/health
# → { "status": "ok", "timestamp": "2026-03-08T11:00:00.000Z" }
```

---

## Expert Personas

All personas are stored in [`prompts.json`](./prompts.json) and keyed by intent label:

| Intent | Persona | Focus |
|--------|---------|-------|
| `code` | 🧑‍💻 Code Expert | Production-quality code, error handling, idiomatic style |
| `data` | 📊 Data Analyst | Statistical analysis, patterns, visualization suggestions |
| `writing` | ✍️ Writing Coach | Feedback on clarity/tone/structure — never rewrites for you |
| `career` | 💼 Career Advisor | Concrete, actionable career steps with specific next actions |
| `unclear` | 🤔 Clarifier | Asks one focused clarifying question |

---

## Using Free LLM APIs

To use the service without incurring costs, you can route requests through **OpenRouter** or **Groq**, which offer several free models.

### 1. Groq Cloud (Fastest - Recommended)
1. Sign up at [Groq Console](https://console.groq.com/).
2. Create an API Key.
3. Update your `.env`:
   ```env
   OPENAI_API_KEY=gsk_your_key_here
   OPENAI_BASE_URL=https://api.groq.com/openai/v1
   CLASSIFIER_MODEL=llama3-8b-8192
   RESPONDER_MODEL=llama3-8b-8192
   ```

### 2. OpenRouter (Wide Variety)
1. Get an API key from [OpenRouter](https://openrouter.ai/).
2. Update your `.env`:
   ```env
   OPENAI_API_KEY=your_openrouter_key
   OPENAI_BASE_URL=https://openrouter.ai/api/v1
   CLASSIFIER_MODEL=google/gemma-2-9b-it:free
   RESPONDER_MODEL=mistralai/mistral-7b-instruct:v0.1:free
   ```

### 2. Local Models (Ollama)
If you run Ollama locally:
```env
OPENAI_BASE_URL=http://localhost:11434/v1
CLASSIFIER_MODEL=llama3
RESPONDER_MODEL=llama3
```

---

## Configuration

Copy `.env.example` to `.env` and set these variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | *(required)* | Your OpenAI API key |
| `PORT` | `3000` | HTTP server port |
| `CONFIDENCE_THRESHOLD` | `0.7` | Min confidence to accept a non-unclear intent |
| `CLASSIFIER_MODEL` | `gpt-4o-mini` | Model for intent classification |
| `RESPONDER_MODEL` | `gpt-4o-mini` | Model for expert responses |
| `LOG_FILE` | `route_log.jsonl` | Path to interaction log file |

> **Never commit your `.env` file or API keys to version control.**

---

## Testing

Tests mock the OpenAI client — **no API key required**.

```bash
npm test
```

### Test Results

```
Tests: 33 passed, 33 total ✅

  classifyIntent() - 15 Required Test Messages   15/15 ✅
  Confidence Threshold (Stretch Goal)             3/3  ✅
  Manual Override via @intent prefix              4/4  ✅
  Malformed JSON handling                         1/1  ✅
  routeAndRespond()                               4/4  ✅
  POST /api/chat - input validation               3/3  ✅
  GET /api/logs                                   1/1  ✅
  GET /api/personas                               1/1  ✅
  GET /health                                     1/1  ✅
```

### All 15 Required Test Messages

| # | Message | Expected Intent |
|---|---------|----------------|
| 1 | `how do i sort a list of objects in python?` | `code` |
| 2 | `explain this sql query for me` | `data` |
| 3 | `This paragraph sounds awkward, can you help me fix it?` | `writing` |
| 4 | `I'm preparing for a job interview, any tips?` | `career` |
| 5 | `what's the average of these numbers: 12, 45, 23, 67, 34` | `data` |
| 6 | `Help me make this better.` | `unclear` |
| 7 | Mixed code + resume question | `unclear` |
| 8 | `hey` | `unclear` |
| 9 | `Can you write me a poem about clouds?` | `unclear` |
| 10 | `Rewrite this sentence to be more professional.` | `writing` |
| 11 | `I'm not sure what to do with my career.` | `career` |
| 12 | `what is a pivot table` | `data` |
| 13 | `fxi thsi bug pls: for i in range(10) print(i)` | `code` |
| 14 | `How do I structure a cover letter?` | `career` |
| 15 | `My boss says my writing is too verbose.` | `writing` |

---

## Logging

Every interaction is automatically appended to `route_log.jsonl` in **JSON Lines** format (one JSON object per line):

```jsonl
{"timestamp":"2026-03-08T11:00:01.234Z","userMessage":"how do I sort a list?","intent":"code","confidence":0.95,"finalResponse":"...","manualOverride":false}
{"timestamp":"2026-03-08T11:01:10.002Z","userMessage":"@data show trends","intent":"data","confidence":1,"finalResponse":"...","manualOverride":true}
```

A sample `route_log.jsonl` is included in this repository (generated from the 15 spec test messages).

View logs via the API: `GET /api/logs?limit=20`

---

## Stretch Goals

All three optional stretch goals are fully implemented:

| Feature | Details |
|---------|---------|
| **Confidence Threshold** | `confidence < CONFIDENCE_THRESHOLD` (default 0.7) → intent overridden to `unclear` |
| **Manual `@intent` Override** | Prefix with `@code`, `@data`, `@writing`, `@career` to skip the classifier |
| **CLI Interface** | `npm run cli` — colorized terminal with intent icons, confidence %, and override indicator |

### Manual Override Example

```
> You: @code Fix this bug: for i in range(10) print(i)

🧑‍💻 Intent: CODE  Confidence: 100.0%  [MANUAL OVERRIDE]

──────────────────────────────────────────────────
# ❌ Original (SyntaxError: missing colon)
for i in range(10) print(i)

# ✅ Fixed
for i in range(10):
    print(i)
──────────────────────────────────────────────────
```

---

## Submission Checklist

- [x] Application code — full Node.js source in `src/`
- [x] `Dockerfile` — multi-stage production build (node:20-alpine, non-root user)
- [x] `docker-compose.yml` — with log volume persistence
- [x] `README.md` — setup, architecture, API reference, test table
- [x] `.env.example` — all environment variables documented, no secrets
- [x] `route_log.jsonl` — sample log from 15 spec test messages
- [x] `tests/router.test.js` — 33 Jest tests, all passing

---

## License

ISC © 2026
