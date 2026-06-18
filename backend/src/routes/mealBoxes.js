const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { flight_id, status, is_allergy_marked } = req.query;
  let sql = `
    SELECT mb.*, mt.code as meal_type_code, mt.name as meal_type_name, mt.is_allergy,
      f.flight_no, f.departure, f.arrival, f.scheduled_departure_time, f.status as flight_status
    FROM meal_boxes mb
    JOIN meal_types mt ON mb.meal_type_id = mt.id
    JOIN flights f ON mb.flight_id = f.id
    WHERE 1=1
  `;
  const params = [];

  if (flight_id) {
    sql += ' AND mb.flight_id = ?';
    params.push(flight_id);
  }

  if (status) {
    sql += ' AND mb.status = ?';
    params.push(status);
  }

  if (is_allergy_marked !== undefined) {
    sql += ' AND mb.is_allergy_marked = ?';
    params.push(is_allergy_marked === 'true' ? 1 : 0);
  }

  sql += ' ORDER BY mb.created_at DESC';
  const boxes = db.prepare(sql).all(...params);
  res.json({ success: true, data: boxes });
});

router.get('/:id', (req, res) => {
  const box = db.prepare(`
    SELECT mb.*, mt.code as meal_type_code, mt.name as meal_type_name, mt.is_allergy,
      f.flight_no, f.departure, f.arrival, f.scheduled_departure_time
    FROM meal_boxes mb
    JOIN meal_types mt ON mb.meal_type_id = mt.id
    JOIN flights f ON mb.flight_id = f.id
    WHERE mb.id = ?
  `).get(req.params.id);

  if (!box) {
    return res.status(404).json({ success: false, message: '餐箱不存在' });
  }
  res.json({ success: true, data: box });
});

function generateBoxNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `BX${dateStr}${random}`;
}

router.post('/', (req, res) => {
  const { flight_id, meal_type_id, quantity, loader_id, loader_name, is_allergy_marked } = req.body;

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
    return res.status(400).json({ success: false, message: '航班已起飞，不能添加餐箱' });
  }

  const mealType = db.prepare('SELECT * FROM meal_types WHERE id = ?').get(meal_type_id);
  if (!mealType) {
    return res.status(404).json({ success: false, message: '餐食类型不存在' });
  }

  if (mealType.is_allergy && !is_allergy_marked) {
    return res.status(400).json({ success: false, message: '过敏餐必须单独标记' });
  }

  const box_no = generateBoxNo();

  try {
    const stmt = db.prepare(`
      INSERT INTO meal_boxes (box_no, flight_id, meal_type_id, quantity, is_allergy_marked, loader_id, loader_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(box_no, flight_id, meal_type_id, quantity, is_allergy_marked ? 1 : 0, loader_id, loader_name);
    const box = db.prepare('SELECT * FROM meal_boxes WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: box });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:id', (req, res) => {
  const box = db.prepare('SELECT * FROM meal_boxes WHERE id = ?').get(req.params.id);
  if (!box) {
    return res.status(404).json({ success: false, message: '餐箱不存在' });
  }

  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(box.flight_id);
  if (flight && new Date(flight.scheduled_departure_time) <= new Date()) {
    return res.status(400).json({ success: false, message: '航班已起飞，不能修改餐箱' });
  }

  const { quantity, status, is_allergy_marked, remark } = req.body;

  if (quantity !== undefined && quantity <= 0) {
    return res.status(400).json({ success: false, message: '数量必须大于0' });
  }

  const mealType = db.prepare('SELECT * FROM meal_types WHERE id = ?').get(box.meal_type_id);
  if (mealType && mealType.is_allergy && is_allergy_marked === false) {
    return res.status(400).json({ success: false, message: '过敏餐必须单独标记' });
  }

  const stmt = db.prepare(`
    UPDATE meal_boxes SET
      quantity = COALESCE(?, quantity),
      status = COALESCE(?, status),
      is_allergy_marked = COALESCE(?, is_allergy_marked),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(quantity, status, is_allergy_marked !== undefined ? (is_allergy_marked ? 1 : 0) : undefined, req.params.id);

  const updatedBox = db.prepare('SELECT * FROM meal_boxes WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updatedBox });
});

router.post('/:id/load', (req, res) => {
  const box = db.prepare('SELECT * FROM meal_boxes WHERE id = ?').get(req.params.id);
  if (!box) {
    return res.status(404).json({ success: false, message: '餐箱不存在' });
  }

  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(box.flight_id);
  if (flight && new Date(flight.scheduled_departure_time) <= new Date()) {
    return res.status(400).json({ success: false, message: '航班已起飞，不能操作餐箱' });
  }

  const loader_id = req.body ? req.body.loader_id : undefined;
  const loader_name = req.body ? req.body.loader_name : undefined;

  const stmt = db.prepare(`
    UPDATE meal_boxes SET
      status = 'loaded',
      loader_id = COALESCE(?, loader_id),
      loader_name = COALESCE(?, loader_name),
      loaded_time = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(loader_id, loader_name, req.params.id);

  const updatedBox = db.prepare('SELECT * FROM meal_boxes WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updatedBox });
});

router.delete('/:id', (req, res) => {
  const box = db.prepare('SELECT * FROM meal_boxes WHERE id = ?').get(req.params.id);
  if (!box) {
    return res.status(404).json({ success: false, message: '餐箱不存在' });
  }

  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(box.flight_id);
  if (flight && new Date(flight.scheduled_departure_time) <= new Date()) {
    return res.status(400).json({ success: false, message: '航班已起飞，不能删除餐箱' });
  }

  db.prepare('DELETE FROM meal_boxes WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: '删除成功' });
});

module.exports = router;
