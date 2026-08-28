const app = require('./app');
const { runAutoApprove } = require('./jobs/autoApprove');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const AUTO_APPROVE_INTERVAL_MS = 60 * 60 * 1000; // vsako uro

runAutoApprove();
setInterval(runAutoApprove, AUTO_APPROVE_INTERVAL_MS);
