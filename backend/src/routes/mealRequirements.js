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
  const { flight_id, meal_type_id, quantity, dispatcher_id, dispatcher_name, remark, waitlist_quantity } = req.body;

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
      INSERT INTO meal_requirements (flight_id, meal_type_id, quantity, waitlist_quantity, dispatcher_id, dispatcher_name, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(flight_id, meal_type_id, quantity, waitlist_quantity || 0, dispatcher_id, dispatcher_name, remark);
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

  const { quantity, status, remark, waitlist_quantity } = req.body;

  if (quantity !== undefined && quantity <= 0) {
    return res.status(400).json({ success: false, message: '数量必须大于0' });
  }

  const stmt = db.prepare(`
    UPDATE meal_requirements SET
      quantity = COALESCE(?, quantity),
      previous_quantity = CASE WHEN ? IS NOT NULL AND ? != quantity THEN quantity ELSE previous_quantity END,
      waitlist_quantity = COALESCE(?, waitlist_quantity),
      status = COALESCE(?, status),
      remark = COALESCE(?, remark),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(quantity, quantity, quantity, waitlist_quantity, status, remark, req.params.id);

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

router.get('/waitlist/:flight_id', (req, res) => {
  const waitlist = db.prepare(`
    SELECT wp.*, mt.code as meal_type_code, mt.name as meal_type_name, mt.is_allergy
    FROM waitlist_passengers wp
    JOIN meal_types mt ON wp.meal_type_id = mt.id
    WHERE wp.flight_id = ?
    ORDER BY wp.created_at DESC
  `).all(req.params.flight_id);
  res.json({ success: true, data: waitlist });
});

router.post('/waitlist', (req, res) => {
  const { flight_id, passenger_name, meal_type_id, quantity, operator_id, operator_name, remark } = req.body;

  if (!flight_id || !passenger_name || !meal_type_id) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(flight_id);
  if (!flight) {
    return res.status(404).json({ success: false, message: '航班不存在' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO waitlist_passengers (flight_id, passenger_name, meal_type_id, quantity, operator_id, operator_name, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(flight_id, passenger_name, meal_type_id, quantity || 1, operator_id, operator_name, remark);
    const waitlistItem = db.prepare('SELECT * FROM waitlist_passengers WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: waitlistItem });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/waitlist/:id/transfer', (req, res) => {
  const waitlistItem = db.prepare('SELECT * FROM waitlist_passengers WHERE id = ?').get(req.params.id);
  if (!waitlistItem) {
    return res.status(404).json({ success: false, message: '候补旅客不存在' });
  }

  if (waitlistItem.status !== 'waitlist') {
    return res.status(400).json({ success: false, message: '该候补旅客已处理' });
  }

  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(waitlistItem.flight_id);
  if (!flight) {
    return res.status(404).json({ success: false, message: '航班不存在' });
  }

  if (new Date(flight.scheduled_departure_time) <= new Date()) {
    return res.status(400).json({ success: false, message: '航班已起飞，不能处理候补' });
  }

  const { operator_id, operator_name } = req.body;

  const doTransfer = db.transaction(() => {
    db.prepare(`
      UPDATE waitlist_passengers SET status = 'transferred', transferred_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.params.id);

    const existingReq = db.prepare(
      'SELECT * FROM meal_requirements WHERE flight_id = ? AND meal_type_id = ? AND status != ?'
    ).get(waitlistItem.flight_id, waitlistItem.meal_type_id, 'cancelled');

    if (existingReq) {
      db.prepare(`
        UPDATE meal_requirements SET
          previous_quantity = quantity,
          quantity = quantity + ?,
          waitlist_quantity = waitlist_quantity + ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(waitlistItem.quantity, waitlistItem.quantity, existingReq.id);
      return db.prepare('SELECT * FROM meal_requirements WHERE id = ?').get(existingReq.id);
    } else {
      const stmt = db.prepare(`
        INSERT INTO meal_requirements (flight_id, meal_type_id, quantity, waitlist_quantity, dispatcher_id, dispatcher_name, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        waitlistItem.flight_id, waitlistItem.meal_type_id, waitlistItem.quantity,
        waitlistItem.quantity, operator_id || waitlistItem.operator_id,
        operator_name || waitlistItem.operator_name,
        '候补旅客转正'
      );
      return db.prepare('SELECT * FROM meal_requirements WHERE id = ?').get(result.lastInsertRowid);
    }
  });

  try {
    const updatedReq = doTransfer();
    res.json({ success: true, data: { waitlist: { ...waitlistItem, status: 'transferred' }, requirement: updatedReq } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/recalculate/:flight_id', (req, res) => {
  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.flight_id);
  if (!flight) {
    return res.status(404).json({ success: false, message: '航班不存在' });
  }

  if (new Date(flight.scheduled_departure_time) <= new Date()) {
    return res.status(400).json({ success: false, message: '航班已起飞，不能重算' });
  }

  const { operator_id, operator_name, adjustments } = req.body;

  if (!adjustments || !Array.isArray(adjustments)) {
    return res.status(400).json({ success: false, message: '缺少调整明细' });
  }

  const doRecalculate = db.transaction(() => {
    const results = [];
    for (const adj of adjustments) {
      const req = db.prepare('SELECT * FROM meal_requirements WHERE id = ?').get(adj.requirement_id);
      if (!req) continue;

      db.prepare(`
        UPDATE meal_requirements SET
          previous_quantity = quantity,
          quantity = ?,
          remark = COALESCE(?, remark),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(adj.new_quantity, adj.remark, adj.requirement_id);

      results.push(db.prepare('SELECT * FROM meal_requirements WHERE id = ?').get(adj.requirement_id));
    }
    return results;
  });

  try {
    const results = doRecalculate();
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
