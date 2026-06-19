const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { flight_id, status, is_allergy_marked, replace_status } = req.query;
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

  if (replace_status) {
    sql += ' AND mb.replace_status = ?';
    params.push(replace_status);
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

  if (box.replace_status === 'pending') {
    return res.status(400).json({ success: false, message: '餐箱正在换箱复核中，不能修改' });
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

  if (box.replace_status === 'pending') {
    return res.status(400).json({ success: false, message: '餐箱正在换箱复核中，不能直接装车放行，请先完成换箱复核' });
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

router.post('/:id/report-anomaly', (req, res) => {
  const box = db.prepare('SELECT * FROM meal_boxes WHERE id = ?').get(req.params.id);
  if (!box) {
    return res.status(404).json({ success: false, message: '餐箱不存在' });
  }

  if (box.replace_status === 'pending' || box.replace_status === 'approved') {
    return res.status(400).json({ success: false, message: '该餐箱已在换箱复核流程中' });
  }

  const flight = db.prepare('SELECT * FROM flights WHERE id = ?').get(box.flight_id);
  if (flight && new Date(flight.scheduled_departure_time) <= new Date()) {
    return res.status(400).json({ success: false, message: '航班已起飞，不能操作' });
  }

  const { reason, anomaly_type, operator_id, operator_name } = req.body;

  if (!reason || !anomaly_type) {
    return res.status(400).json({ success: false, message: '缺少异常原因或异常类型' });
  }

  const validAnomalyTypes = ['temp_control', 'label', 'seal', 'other'];
  if (!validAnomalyTypes.includes(anomaly_type)) {
    return res.status(400).json({ success: false, message: '无效的异常类型' });
  }

  const doReport = db.transaction(() => {
    db.prepare(`
      UPDATE meal_boxes SET
        status = 'anomaly',
        replace_status = 'pending',
        replace_reason = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reason, req.params.id);

    const new_box_no = generateBoxNo();

    const stmt = db.prepare(`
      INSERT INTO box_replacements (original_box_id, flight_id, old_box_no, new_box_no, meal_type_id, quantity, reason, anomaly_type, operator_id, operator_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(box.id, box.flight_id, box.box_no, new_box_no, box.meal_type_id, box.quantity, reason, anomaly_type, operator_id, operator_name);

    return db.prepare('SELECT * FROM box_replacements WHERE id = ?').get(result.lastInsertRowid);
  });

  try {
    const replacement = doReport();
    res.json({ success: true, data: { box: db.prepare('SELECT * FROM meal_boxes WHERE id = ?').get(req.params.id), replacement } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/replacements/:flight_id', (req, res) => {
  const replacements = db.prepare(`
    SELECT br.*, mt.code as meal_type_code, mt.name as meal_type_name, mt.is_allergy
    FROM box_replacements br
    JOIN meal_types mt ON br.meal_type_id = mt.id
    WHERE br.flight_id = ?
    ORDER BY br.created_at DESC
  `).all(req.params.flight_id);
  res.json({ success: true, data: replacements });
});

router.post('/replacements/:id/review', (req, res) => {
  const replacement = db.prepare('SELECT * FROM box_replacements WHERE id = ?').get(req.params.id);
  if (!replacement) {
    return res.status(404).json({ success: false, message: '换箱记录不存在' });
  }

  if (replacement.review_status !== 'pending') {
    return res.status(400).json({ success: false, message: '该换箱记录已审核' });
  }

  const { reviewer_id, reviewer_name, review_status } = req.body;

  if (!review_status || !['approved', 'rejected'].includes(review_status)) {
    return res.status(400).json({ success: false, message: '无效的审核状态' });
  }

  const doReview = db.transaction(() => {
    db.prepare(`
      UPDATE box_replacements SET review_status = ?, reviewer_id = ?, reviewer_name = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(review_status, reviewer_id, reviewer_name, req.params.id);

    if (review_status === 'approved') {
      const mealType = db.prepare('SELECT * FROM meal_types WHERE id = ?').get(replacement.meal_type_id);

      db.prepare(`
        UPDATE meal_boxes SET
          box_no = ?,
          status = 'prepared',
          replace_status = 'approved',
          replace_reviewer_id = ?,
          replace_reviewer_name = ?,
          replace_reviewed_at = CURRENT_TIMESTAMP,
          is_allergy_marked = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        replacement.new_box_no,
        reviewer_id, reviewer_name,
        mealType && mealType.is_allergy ? 1 : 0,
        replacement.original_box_id
      );
    } else {
      db.prepare(`
        UPDATE meal_boxes SET
          replace_status = 'rejected',
          replace_reviewer_id = ?,
          replace_reviewer_name = ?,
          replace_reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(reviewer_id, reviewer_name, replacement.original_box_id);
    }

    return db.prepare('SELECT * FROM box_replacements WHERE id = ?').get(req.params.id);
  });

  try {
    const result = doReview();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/allergy-isolation', (req, res) => {
  const { flight_id, box_id, meal_type_id, isolation_method, operator_id, operator_name, remark } = req.body;

  if (!flight_id || !box_id || !meal_type_id) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  const box = db.prepare('SELECT * FROM meal_boxes WHERE id = ?').get(box_id);
  if (!box) {
    return res.status(404).json({ success: false, message: '餐箱不存在' });
  }

  const mealType = db.prepare('SELECT * FROM meal_types WHERE id = ?').get(meal_type_id);
  if (!mealType || !mealType.is_allergy) {
    return res.status(400).json({ success: false, message: '仅过敏餐需要隔离记录' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO allergy_isolations (flight_id, box_id, meal_type_id, isolation_method, operator_id, operator_name, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(flight_id, box_id, meal_type_id, isolation_method, operator_id, operator_name, remark);

    db.prepare(`
      UPDATE meal_boxes SET is_allergy_marked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(box_id);

    const isolation = db.prepare('SELECT * FROM allergy_isolations WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: isolation });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/allergy-isolations/:flight_id', (req, res) => {
  const isolations = db.prepare(`
    SELECT ai.*, mt.code as meal_type_code, mt.name as meal_type_name,
      mb.box_no
    FROM allergy_isolations ai
    JOIN meal_types mt ON ai.meal_type_id = mt.id
    JOIN meal_boxes mb ON ai.box_id = mb.id
    WHERE ai.flight_id = ?
    ORDER BY ai.created_at DESC
  `).all(req.params.flight_id);
  res.json({ success: true, data: isolations });
});

module.exports = router;
