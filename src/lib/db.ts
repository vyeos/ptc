import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:ptc.db");
    await initSchema();
  }
  return db;
}

async function initSchema() {
  const d = db!;

  await d.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await d.execute(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      duration_years INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1
    )
  `);

  await d.execute(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_name TEXT,
      gender TEXT,
      address TEXT,
      course_id INTEGER NOT NULL,
      enrollment_date DATETIME NOT NULL,
      current_year INTEGER NOT NULL DEFAULT 1,
      batch_year INTEGER NOT NULL,
      graduated_date DATETIME,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `);

  await d.execute(`
    CREATE TABLE IF NOT EXISTS fee_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      is_active INTEGER DEFAULT 1
    )
  `);

  await d.execute(`
    CREATE TABLE IF NOT EXISTS student_fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      fee_type_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      academic_year INTEGER NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (fee_type_id) REFERENCES fee_types(id)
    )
  `);

  await d.execute(`
    CREATE TABLE IF NOT EXISTS fee_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      student_fee_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      payment_date DATETIME NOT NULL,
      notes TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (student_fee_id) REFERENCES student_fees(id) ON DELETE CASCADE
    )
  `);

  await migrateSchema(d);
  await seedDefaults();
}

async function migrateSchema(d: Database) {
  const cols = await d.select<{ name: string }[]>(
    "PRAGMA table_info(students)"
  );
  const colNames = cols.map((c) => c.name);
  if (!colNames.includes("cancelled_date")) {
    await d.execute("ALTER TABLE students ADD COLUMN cancelled_date DATETIME");
  }
  if (!colNames.includes("cancellation_note")) {
    await d.execute("ALTER TABLE students ADD COLUMN cancellation_note TEXT");
  }
}

async function seedDefaults() {
  const d = db!;

  const existing = await d.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = 'auth_email'"
  );
  if (existing.length === 0) {
    await d.execute(
      "INSERT INTO settings (key, value) VALUES ('auth_email', 'ripal@patel.com')"
    );
    await d.execute(
      "INSERT INTO settings (key, value) VALUES ('auth_password', 'RipalPatel')"
    );
  }

  const courses = await d.select<{ id: number }[]>(
    "SELECT id FROM courses LIMIT 1"
  );
  if (courses.length === 0) {
    await d.execute(
      "INSERT INTO courses (name, duration_years) VALUES ('PTC', 2)"
    );
  }
}
