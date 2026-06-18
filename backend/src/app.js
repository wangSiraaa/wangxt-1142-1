const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('./db');

const flightsRouter = require('./routes/flights');
const mealTypesRouter = require('./routes/mealTypes');
const mealRequirementsRouter = require('./routes/mealRequirements');
const mealBoxesRouter = require('./routes/mealBoxes');
const loadingChecksRouter = require('./routes/loadingChecks');
const cabinReceiptsRouter = require('./routes/cabinReceipts');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 19442;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '航空配餐特殊餐装机复核系统 API 运行正常' });
});

app.use('/api/flights', flightsRouter);
app.use('/api/meal-types', mealTypesRouter);
app.use('/api/meal-requirements', mealRequirementsRouter);
app.use('/api/meal-boxes', mealBoxesRouter);
app.use('/api/loading-checks', loadingChecksRouter);
app.use('/api/cabin-receipts', cabinReceiptsRouter);
app.use('/api/users', usersRouter);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, message: '服务器内部错误', error: err.message });
});

app.listen(PORT, () => {
  console.log(`航空配餐特殊餐装机复核系统后端服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
