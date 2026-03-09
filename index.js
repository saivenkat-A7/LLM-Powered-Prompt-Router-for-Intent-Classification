const app = require('./src/app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 LLM Prompt Router running at http://localhost:${PORT}`);
    console.log(`   POST /api/chat    → classify + route + respond`);
    console.log(`   GET  /api/logs    → view recent route log`);
    console.log(`   GET  /api/personas→ view available personas`);
    console.log(`   GET  /health      → health check`);
});
