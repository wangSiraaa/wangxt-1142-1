const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { flight_id } = req.query;
  let sql = `
    SELECT cr.*, f.flight_no, f.departure, f.arrival, f.scheduled_departure_time
    FROM cabin_receipts cr
    JOIN flights f ON cr.flight_id = f.id
    WHERE 1=1
  `;
  const params = [];

  if (flight_id) {
    sql += ' AND cr.flight_id = ?';
    params.push(flight_id);
  }

  sql += ' ORDER BY cr.created_at DESC';
  const receipts = db.prepare(sql).all(...params);
  res.json({ success: true, data: receipts });
});

router.get('/latest/:flight_id', (req, res) => {
  const receipt = db.prepare(`
    SELECT cr.*, f.flight_no, f.departure, f.arrival, f.scheduled_departure_time
    FROM cabin_receipts cr
    JOIN flights f ON cr.flight_id = f.id
    WHERE cr.flight_id = ?
    ORDER BY cr.id DESC
    LIMIT 1
  `).get(req.params.flight_id);

  res.json({ success: true, data: receipt || null });
});

router.get('/boxes/:flight_id', (req, res) => {
  const boxes = db.prepare(`
    SELECT mb.*, mt.code as meal_type_code, mt.name as meal_type_name, mt.is_allergy
    FROM meal_boxes mb
    JOIN meal_types mt ON mb.meal_type_id = mt.id
    WHERE mb.flight_id = ? AND mb.status = 'loaded'
    ORDER BY mb.created_at DESC
  `).all(req.params.flight_id);

  res.json({ success: true, data: boxes });
});

router.post('/confirm', (req, res) => {
  const { flight_id, purser_id, purser_name, remark, received_boxes } = req.body;

  if (!flight_id) {
    return res.status(400).json({ success: false, message: '缺少航班ID' });
  }

  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(flight_id);
  if (!flight) {
    return res.status(404).json({ success: false, message: '航班不存在' });
  }

  const boxes = db.prepare(`
    SELECT mb.*, mt.code as meal_type_code, mt.name as meal_type_name, mt.is_allergy
    FROM meal_boxes mb
    JOIN meal_types mt ON mb.meal_type_id = mt.id
    WHERE mb.flight_id = ? AND mb.status = 'loaded'
  `).all(flight_id);

  const issues = [];

  if (received_boxes && received_boxes.length > 0) {
    for (const rb of received_boxes) {
      const box = boxes.find(b => b.id === rb.box_id);
      if (!box) {
        issues.push({
          type: 'box_not_found',
          box_id: rb.box_id,
          message: `餐箱ID ${rb.box_id} 不存在或未装车`
        });
      } else if (rb.received_quantity !== undefined && rb.received_quantity !== box.quantity) {
        issues.push({
          type: 'quantity_mismatch',
          box_no: box.box_no,
          meal_type: box.meal_type_name,
          expected: box.quantity,
          received: rb.received_quantity,
          message: `${box.meal_type_name} 餐箱 ${box.box_no} 数量不符：装车${box.quantity}份，实收${rb.received_quantity}份`
        });
      }
    }
  }

  const allergyBoxes = boxes.filter(b => b.is_allergy);
  const unmarkedAllergyBoxes = allergyBoxes.filter(b => !b.is_allergy_marked);
  if (unmarkedAllergyBoxes.length > 0) {
    issues.push({
      type: 'allergy_unmarked',
      message: `有 ${unmarkedAllergyBoxes.length} 个过敏餐箱未单独标记`,
      boxes: unmarkedAllergyBoxes.map(b => b.box_no)
    });
  }

  const is_confirmed = issues.length === 0;

  const stmt = db.prepare(`
    INSERT INTO cabin_receipts (flight_id, purser_id, purser_name, receipt_time, is_confirmed, remark)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
  `);
  const result = stmt.run(
    flight_id,
    purser_id,
    purser_name,
    is_confirmed ? 1 : 0,
    remark
  );

  const receipt = db.prepare('SELECT * FROM cabin_receipts WHERE id = ?').get(result.lastInsertRowid);

  if (is_confirmed) {
    db.prepare(`
      UPDATE flights SET status = 'received', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(flight_id);
  }

  res.json({
    success: true,
    data: {
      ...receipt,
      boxes: boxes,
      issues: issues,
      is_confirmed: is_confirmed
    }
  });
});

module.exports = router;
