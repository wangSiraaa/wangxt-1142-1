const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { is_allergy } = req.query;
  let sql = 'SELECT * FROM meal_types WHERE 1=1';
  const params = [];

  if (is_allergy !== undefined) {
    sql += ' AND is_allergy = ?';
    params.push(is_allergy === 'true' ? 1 : 0);
  }

  sql += ' ORDER BY code ASC';
  const mealTypes = db.prepare(sql).all(...params);
  res.json({ success: true, data: mealTypes });
});

router.get('/:id', (req, res) => {
  const mealType = db.prepare('SELECT * FROM meal_types WHERE id = ?').get(req.params.id);
  if (!mealType) {
    return res.status(404).json({ success: false, message: '餐食类型不存在' });
  }
  res.json({ success: true, data: mealType });
});

module.exports = router;
