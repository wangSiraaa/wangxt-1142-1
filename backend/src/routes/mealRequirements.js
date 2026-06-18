const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { flight_id, status } = req.query;
  let sql = `
    SELECT mr.*, mt.code as meal_type_code, mt.name as meal_type_name, mt.is_allergy,
      f.flight_no, f.departure, f.arrival, f.scheduled_departure_time, f.status as flight_status
    FROM meal_requirements mr
    JOIN meal_types mt ON mr.meal_type_id = mt.id
    JOIN flights f ON mr.flight_id = f.id
    WHERE 1=1
  `;
  const params = [];

  if (flight_id) {
    sql += ' AND mr.flight_id = ?';
    params.push(flight_id);
  }

  if (status) {
    sql += ' AND mr.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY mr.created_at DESC';
  const requirements = db.prepare(sql).all(...params);
  res.json({ success: true, data: requirements });
});

router.get('/:id', (req, res) => {
  const requirement = db.prepare(`
    SELECT mr.*, mt.code as meal_type_code, mt.name as meal_type_name, mt.is_allergy,
      f.flight_no, f.departure, f.arrival, f.scheduled_departure_time
    FROM meal_requirements mr
    JOIN meal_types mt ON mr.meal_type_id = mt.id
    JOIN flights f ON mr.flight_id = f.id
    WHERE mr.id = ?
  `).get(req.params.id);

  if (!requirement) {
    return res.status(404).json({ success: false, message: '餐食需求不存在' });
  }
  res.json({ success: true, data: requirement });
});

router.post('/', (req, res) => {
  const { flight_id, meal_type_id, quantity, dispatcher_id, dispatcher_name, remark } = req.body;

  if (!flight_id || !meal_type_id || !quantity) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  if (quantity <= 0) {
    return res.status(400).json({ success: false, message: '数量必须大于0' });
  }

  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(flight_id);
  if (!flight) {
    return res.status(404).json({ success: false, message: '航班不存在' });
  }

  const flightDepartureTime = new Date(flight.scheduled_departure_time);
  if (flightDepartureTime <= new Date()) {
    return res.status(400).json({ success: false, message: '航班已起飞，不能添加或修改餐食需求' });
  }

  const mealType = db.prepare('SELECT * FROM meal_types WHERE id = ?').get(meal_type_id);
  if (!mealType) {
    return res.status(404).json({ success: false, message: '餐食类型不存在' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO meal_requirements (flight_id, meal_type_id, quantity, dispatcher_id, dispatcher_name, remark)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(flight_id, meal_type_id, quantity, dispatcher_id, dispatcher_name, remark);
    const requirement = db.prepare('SELECT * FROM meal_requirements WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: requirement });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:id', (req, res) => {
  const requirement = db.prepare('SELECT * FROM meal_requirements WHERE id = ?').get(req.params.id);
  if (!requirement) {
    return res.status(404).json({ success: false, message: '餐食需求不存在' });
  }

  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(requirement.flight_id);
  if (flight && new Date(flight.scheduled_departure_time) <= new Date()) {
    return res.status(400).json({ success: false, message: '航班已起飞，不能修改餐食需求' });
  }

  const { quantity, status, remark } = req.body;

  if (quantity !== undefined && quantity <= 0) {
    return res.status(400).json({ success: false, message: '数量必须大于0' });
  }

  const stmt = db.prepare(`
    UPDATE meal_requirements SET
      quantity = COALESCE(?, quantity),
      status = COALESCE(?, status),
      remark = COALESCE(?, remark),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(quantity, status, remark, req.params.id);

  const updatedRequirement = db.prepare('SELECT * FROM meal_requirements WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updatedRequirement });
});

router.delete('/:id', (req, res) => {
  const requirement = db.prepare('SELECT * FROM meal_requirements WHERE id = ?').get(req.params.id);
  if (!requirement) {
    return res.status(404).json({ success: false, message: '餐食需求不存在' });
  }

  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(requirement.flight_id);
  if (flight && new Date(flight.scheduled_departure_time) <= new Date()) {
    return res.status(400).json({ success: false, message: '航班已起飞，不能删除餐食需求' });
  }

  db.prepare('DELETE FROM meal_requirements WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: '删除成功' });
});

module.exports = router;
