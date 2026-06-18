const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { role } = req.query;
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params = [];

  if (role) {
    sql += ' AND role = ?';
    params.push(role);
  }

  sql += ' ORDER BY id ASC';
  const users = db.prepare(sql).all(...params);
  res.json({ success: true, data: users });
});

router.get('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }
  res.json({ success: true, data: user });
});

router.post('/login', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ success: false, message: '请输入用户名' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }

  res.json({ success: true, data: user });
});

module.exports = router;
