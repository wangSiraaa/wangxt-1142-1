const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { status, keyword } = req.query;
  let sql = `
    SELECT f.*,
      (SELECT COUNT(*) FROM meal_requirements mr WHERE mr.flight_id = f.id) as req_count,
      (SELECT COUNT(*) FROM meal_boxes mb WHERE mb.flight_id = f.id) as box_count,
      (SELECT is_passed FROM loading_checks lc WHERE lc.flight_id = f.id ORDER BY lc.id DESC LIMIT 1) as check_passed,
      (SELECT is_confirmed FROM cabin_receipts cr WHERE cr.flight_id = f.id ORDER BY cr.id DESC LIMIT 1) as receipt_confirmed
    FROM flights f
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += ' AND f.status = ?';
    params.push(status);
  }

  if (keyword) {
    sql += ' AND (f.flight_no LIKE ? OR f.departure LIKE ? OR f.arrival LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  sql += ' ORDER BY f.scheduled_departure_time ASC';

  const flights = db.prepare(sql).all(...params);
  res.json({ success: true, data: flights });
});

router.get('/:id', (req, res) => {
  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id);
  if (!flight) {
    return res.status(404).json({ success: false, message: '航班不存在' });
  }
  res.json({ success: true, data: flight });
});

router.post('/', (req, res) => {
  const { flight_no, departure, arrival, scheduled_departure_time, passenger_count } = req.body;

  if (!flight_no || !departure || !arrival || !scheduled_departure_time) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO flights (flight_no, departure, arrival, scheduled_departure_time, passenger_count)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(flight_no, departure, arrival, scheduled_departure_time, passenger_count || 0);
    const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: flight });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:id', (req, res) => {
  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id);
  if (!flight) {
    return res.status(404).json({ success: false, message: '航班不存在' });
  }

  const { departure, arrival, scheduled_departure_time, passenger_count, status } = req.body;

  const stmt = db.prepare(`
    UPDATE flights SET
      departure = COALESCE(?, departure),
      arrival = COALESCE(?, arrival),
      scheduled_departure_time = COALESCE(?, scheduled_departure_time),
      passenger_count = COALESCE(?, passenger_count),
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(departure, arrival, scheduled_departure_time, passenger_count, status, req.params.id);

  const updatedFlight = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updatedFlight });
});

router.delete('/:id', (req, res) => {
  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(req.params.id);
  if (!flight) {
    return res.status(404).json({ success: false, message: '航班不存在' });
  }

  db.prepare('DELETE FROM flights WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: '删除成功' });
});

module.exports = router;
