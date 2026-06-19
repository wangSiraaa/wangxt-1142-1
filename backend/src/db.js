const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'catering.db');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS flights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_no TEXT NOT NULL UNIQUE,
      departure TEXT NOT NULL,
      arrival TEXT NOT NULL,
      scheduled_departure_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      passenger_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meal_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_allergy INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meal_requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id INTEGER NOT NULL,
      meal_type_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      previous_quantity INTEGER,
      waitlist_quantity INTEGER NOT NULL DEFAULT 0,
      dispatcher_id TEXT,
      dispatcher_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (flight_id) REFERENCES flights(id),
      FOREIGN KEY (meal_type_id) REFERENCES meal_types(id)
    );

    CREATE TABLE IF NOT EXISTS waitlist_passengers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id INTEGER NOT NULL,
      passenger_name TEXT NOT NULL,
      meal_type_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'waitlist',
      transferred_at TEXT,
      operator_id TEXT,
      operator_name TEXT,
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (flight_id) REFERENCES flights(id),
      FOREIGN KEY (meal_type_id) REFERENCES meal_types(id)
    );

    CREATE TABLE IF NOT EXISTS meal_boxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      box_no TEXT NOT NULL UNIQUE,
      flight_id INTEGER NOT NULL,
      meal_type_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      is_allergy_marked INTEGER NOT NULL DEFAULT 0,
      loader_id TEXT,
      loader_name TEXT,
      status TEXT NOT NULL DEFAULT 'prepared',
      replace_status TEXT DEFAULT NULL,
      replace_reason TEXT,
      replace_reviewer_id TEXT,
      replace_reviewer_name TEXT,
      replace_reviewed_at TEXT,
      loaded_time TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (flight_id) REFERENCES flights(id),
      FOREIGN KEY (meal_type_id) REFERENCES meal_types(id)
    );

    CREATE TABLE IF NOT EXISTS box_replacements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_box_id INTEGER NOT NULL,
      flight_id INTEGER NOT NULL,
      old_box_no TEXT NOT NULL,
      new_box_no TEXT NOT NULL,
      meal_type_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT NOT NULL,
      anomaly_type TEXT NOT NULL,
      operator_id TEXT,
      operator_name TEXT,
      reviewer_id TEXT,
      reviewer_name TEXT,
      review_status TEXT NOT NULL DEFAULT 'pending',
      reviewed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (original_box_id) REFERENCES meal_boxes(id),
      FOREIGN KEY (flight_id) REFERENCES flights(id),
      FOREIGN KEY (meal_type_id) REFERENCES meal_types(id)
    );

    CREATE TABLE IF NOT EXISTS allergy_isolations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id INTEGER NOT NULL,
      box_id INTEGER NOT NULL,
      meal_type_id INTEGER NOT NULL,
      isolation_method TEXT,
      operator_id TEXT,
      operator_name TEXT,
      confirmed_by TEXT,
      confirmed_name TEXT,
      confirmed_at TEXT,
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (flight_id) REFERENCES flights(id),
      FOREIGN KEY (box_id) REFERENCES meal_boxes(id),
      FOREIGN KEY (meal_type_id) REFERENCES meal_types(id)
    );

    CREATE TABLE IF NOT EXISTS loading_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id INTEGER NOT NULL,
      checker_id TEXT,
      checker_name TEXT,
      check_time TEXT,
      check_result TEXT,
      is_passed INTEGER NOT NULL DEFAULT 0,
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (flight_id) REFERENCES flights(id)
    );

    CREATE TABLE IF NOT EXISTS cabin_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flight_id INTEGER NOT NULL,
      purser_id TEXT,
      purser_name TEXT,
      receipt_time TEXT,
      is_confirmed INTEGER NOT NULL DEFAULT 0,
      is_locked INTEGER NOT NULL DEFAULT 0,
      diff_description TEXT,
      responsible_person TEXT,
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (flight_id) REFERENCES flights(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const mealTypeCount = db.prepare('SELECT COUNT(*) as count FROM meal_types').get().count;
  if (mealTypeCount === 0) {
    const insertMealType = db.prepare(`
      INSERT INTO meal_types (code, name, is_allergy, description)
      VALUES (?, ?, ?, ?)
    `);
    const mealTypes = [
      ['STD', '标准餐', 0, '普通标准餐食'],
      ['VGN', '素食餐', 0, '纯素食餐食'],
      ['VML', '西式素食', 0, '西式素食餐食'],
      ['AVML', '亚洲素食', 0, '亚洲风味素食'],
      ['CHML', '儿童餐', 0, '儿童专用餐食'],
      ['BBML', '婴儿餐', 0, '婴儿专用餐食'],
      ['GFML', '无麸质餐', 1, '麸质过敏餐食，需单独标记'],
      ['SFML', '海鲜过敏餐', 1, '海鲜过敏餐食，需单独标记'],
      ['NFML', '坚果过敏餐', 1, '坚果过敏餐食，需单独标记'],
      ['DBML', '糖尿病餐', 0, '糖尿病患者专用餐食'],
      ['LSML', '低盐餐', 0, '低盐健康餐食'],
      ['HNML', '印度教餐', 0, '印度教餐食'],
    ];
    const insertMany = db.transaction((types) => {
      for (const type of types) {
        insertMealType.run(...type);
      }
    });
    insertMany(mealTypes);
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (username, name, role)
      VALUES (?, ?, ?)
    `);
    const users = [
      ['dispatcher01', '张明', 'dispatcher'],
      ['dispatcher02', '李华', 'dispatcher'],
      ['loader01', '王强', 'loader'],
      ['loader02', '赵伟', 'loader'],
      ['purser01', '陈静', 'purser'],
      ['purser02', '刘芳', 'purser'],
    ];
    const insertMany = db.transaction((u) => {
      for (const user of u) {
        insertUser.run(...user);
      }
    });
    insertMany(users);
  }

  const flightCount = db.prepare('SELECT COUNT(*) as count FROM flights').get().count;
  if (flightCount === 0) {
    const insertFlight = db.prepare(`
      INSERT INTO flights (flight_no, departure, arrival, scheduled_departure_time, status, passenger_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const now = new Date();
    const flights = [
      ['CA1234', '北京', '上海', new Date(now.getTime() + 2 * 3600 * 1000).toISOString(), 'scheduled', 180],
      ['MU5678', '上海', '广州', new Date(now.getTime() + 4 * 3600 * 1000).toISOString(), 'scheduled', 220],
      ['CZ9012', '广州', '深圳', new Date(now.getTime() + 6 * 3600 * 1000).toISOString(), 'scheduled', 150],
      ['HU3456', '深圳', '北京', new Date(now.getTime() + 8 * 3600 * 1000).toISOString(), 'scheduled', 200],
    ];
    const insertMany = db.transaction((f) => {
      for (const flight of f) {
        insertFlight.run(...flight);
      }
    });
    insertMany(flights);
  }
}

initDatabase();

module.exports = db;
