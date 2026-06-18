const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { flight_id } = req.query;
  let sql = `
    SELECT lc.*, f.flight_no, f.departure, f.arrival, f.scheduled_departure_time
    FROM loading_checks lc
    JOIN flights f ON lc.flight_id = f.id
    WHERE 1=1
  `;
  const params = [];

  if (flight_id) {
    sql += ' AND lc.flight_id = ?';
    params.push(flight_id);
  }

  sql += ' ORDER BY lc.created_at DESC';
  const checks = db.prepare(sql).all(...params);
  res.json({ success: true, data: checks });
});

router.get('/latest/:flight_id', (req, res) => {
  const check = db.prepare(`
    SELECT lc.*, f.flight_no, f.departure, f.arrival, f.scheduled_departure_time
    FROM loading_checks lc
    JOIN flights f ON lc.flight_id = f.id
    WHERE lc.flight_id = ?
    ORDER BY lc.id DESC
    LIMIT 1
  `).get(req.params.flight_id);

  res.json({ success: true, data: check || null });
});

router.post('/check', (req, res) => {
  const { flight_id, checker_id, checker_name, remark } = req.body;

  if (!flight_id) {
    return res.status(400).json({ success: false, message: '缺少航班ID' });
  }

  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(flight_id);
  if (!flight) {
    return res.status(404).json({ success: false, message: '航班不存在' });
  }

  const flightDepartureTime = new Date(flight.scheduled_departure_time);
  if (flightDepartureTime <= new Date()) {
    return res.status(400).json({ success: false, message: '航班已起飞，不能进行复核' });
  }

  const requirements = db.prepare(`
    SELECT mr.*, mt.code, mt.name, mt.is_allergy
    FROM meal_requirements mr
    JOIN meal_types mt ON mr.meal_type_id = mt.id
    WHERE mr.flight_id = ? AND mr.status != 'cancelled'
  `).all(flight_id);

  const boxes = db.prepare(`
    SELECT mb.*, mt.code, mt.name, mt.is_allergy
    FROM meal_boxes mb
    JOIN meal_types mt ON mb.meal_type_id = mt.id
    WHERE mb.flight_id = ? AND mb.status = 'loaded'
  `).all(flight_id);

  const issues = [];

  const reqSummary = {};
  for (const req of requirements) {
    if (!reqSummary[req.meal_type_id]) {
      reqSummary[req.meal_type_id] = { meal_type_id: req.meal_type_id, code: req.code, name: req.name, quantity: 0, is_allergy: req.is_allergy };
    }
    reqSummary[req.meal_type_id].quantity += req.quantity;
  }

  const boxSummary = {};
  for (const box of boxes) {
    if (!boxSummary[box.meal_type_id]) {
      boxSummary[box.meal_type_id] = { meal_type_id: box.meal_type_id, code: box.code, name: box.name, quantity: 0, is_allergy: box.is_allergy, allergy_marked: true };
    }
    boxSummary[box.meal_type_id].quantity += box.quantity;
    if (box.is_allergy && !box.is_allergy_marked) {
      boxSummary[box.meal_type_id].allergy_marked = false;
    }
  }

  for (const mealTypeId in reqSummary) {
    const req = reqSummary[mealTypeId];
    const box = boxSummary[mealTypeId];
    if (!box || box.quantity < req.quantity) {
      const shortfall = req.quantity - (box ? box.quantity : 0);
      issues.push({
        type: 'shortage',
        meal_type: req.name,
        meal_code: req.code,
        required: req.quantity,
        available: box ? box.quantity : 0,
        shortfall: shortfall,
        message: `${req.name}(${req.code}) 需求${req.quantity}份，实际仅${box ? box.quantity : 0}份，短缺${shortfall}份`
      });
    }
  }

  for (const box of boxes) {
    if (box.is_allergy && !box.is_allergy_marked) {
      issues.push({
        type: 'allergy_unmarked',
        meal_type: box.name,
        meal_code: box.code,
        box_no: box.box_no,
        message: `过敏餐 ${box.name}(${box.code}) 餐箱 ${box.box_no} 未单独标记`
      });
    }
  }

  const is_passed = issues.length === 0;

  const stmt = db.prepare(`
    INSERT INTO loading_checks (flight_id, checker_id, checker_name, check_time, check_result, is_passed, remark)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
  `);
  const result = stmt.run(
    flight_id,
    checker_id,
    checker_name,
    JSON.stringify({ summary: { requirements: reqSummary, boxes: boxSummary }, issues }),
    is_passed ? 1 : 0,
    remark
  );

  const check = db.prepare('SELECT * FROM loading_checks WHERE id = ?').get(result.lastInsertRowid);

  if (is_passed) {
    db.prepare(`
      UPDATE flights SET status = 'checked', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(flight_id);
  }

  res.json({
    success: true,
    data: {
      ...check,
      check_result: {
        summary: { requirements: reqSummary, boxes: boxSummary },
        issues: issues
      },
      is_passed: is_passed
    }
  });
});

module.exports = router;
