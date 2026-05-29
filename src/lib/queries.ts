import { getDb } from "./db";

// --- Types ---

export interface Course {
  id: number;
  name: string;
  duration_years: number;
  is_active: number;
}

export interface Student {
  id: number;
  name: string;
  parent_name: string | null;
  gender: string | null;
  course_id: number;
  enrollment_date: string;
  current_year: number;
  batch_year: number;
  graduated_date: string | null;
  created_at: string;
}

export interface StudentWithCourse extends Student {
  course_name: string;
}

export interface FeeType {
  id: number;
  name: string;
  amount: number;
  is_active: number;
}

export interface StudentFee {
  id: number;
  student_id: number;
  fee_type_id: number;
  total_amount: number;
  academic_year: number;
  fee_type_name?: string;
}

export interface FeePayment {
  id: number;
  student_id: number;
  student_fee_id: number;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string | null;
  fee_type_name?: string;
}

export interface StudentFeeSummary {
  student_fee_id: number;
  fee_type_name: string;
  academic_year: number;
  total_amount: number;
  paid_amount: number;
  remaining: number;
}

// --- Settings ---

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = ?",
    [key]
  );
  return rows.length > 0 ? rows[0].value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
    [key, value, value]
  );
}

// --- Courses ---

export async function getBatchYears(): Promise<number[]> {
  const db = await getDb();
  const rows: { batch_year: number }[] = await db.select(
    "SELECT DISTINCT batch_year FROM students ORDER BY batch_year DESC"
  );
  return rows.map((r) => r.batch_year);
}

export async function getCourses(activeOnly = true): Promise<Course[]> {
  const db = await getDb();
  if (activeOnly) {
    return db.select("SELECT * FROM courses WHERE is_active = 1 ORDER BY name");
  }
  return db.select("SELECT * FROM courses ORDER BY name");
}

export async function addCourse(name: string, durationYears: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO courses (name, duration_years) VALUES (?, ?)",
    [name, durationYears]
  );
}

export async function updateCourse(id: number, name: string, durationYears: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE courses SET name = ?, duration_years = ? WHERE id = ?",
    [name, durationYears, id]
  );
}

export async function deleteCourse(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE courses SET is_active = 0 WHERE id = ?", [id]);
}

// --- Students ---

export async function getStudents(filter: {
  year?: number;
  graduated?: boolean;
  search?: string;
}): Promise<StudentWithCourse[]> {
  const db = await getDb();
  let query = `
    SELECT s.*, c.name as course_name
    FROM students s
    JOIN courses c ON s.course_id = c.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (filter.graduated) {
    query += " AND s.graduated_date IS NOT NULL";
  } else {
    query += " AND s.graduated_date IS NULL";
    if (filter.year) {
      query += " AND s.current_year = ?";
      params.push(filter.year);
    }
  }

  if (filter.search) {
    query += " AND s.name LIKE ?";
    params.push(`%${filter.search}%`);
  }

  query += " ORDER BY s.name";
  return db.select(query, params);
}

export async function getStudent(id: number): Promise<StudentWithCourse | null> {
  const db = await getDb();
  const rows = await db.select<StudentWithCourse[]>(
    `SELECT s.*, c.name as course_name
     FROM students s
     JOIN courses c ON s.course_id = c.id
     WHERE s.id = ?`,
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function addStudent(data: {
  name: string;
  parent_name?: string;
  gender?: string;
  course_id: number;
  enrollment_date: string;
}): Promise<number> {
  const db = await getDb();

  const courses = await db.select<Course[]>(
    "SELECT * FROM courses WHERE id = ?",
    [data.course_id]
  );
  if (courses.length === 0) throw new Error("Course not found");

  const course = courses[0];
  const enrollYear = new Date(data.enrollment_date).getFullYear();
  const batchYear = enrollYear + course.duration_years;

  const result = await db.execute(
    `INSERT INTO students (name, parent_name, gender, course_id, enrollment_date, current_year, batch_year)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [
      data.name,
      data.parent_name || null,
      data.gender || null,
      data.course_id,
      data.enrollment_date,
      batchYear,
    ]
  );

  const studentId = result.lastInsertId as number;

  const feeTypes = await db.select<FeeType[]>(
    "SELECT * FROM fee_types WHERE is_active = 1"
  );
  const perYearAmount = (amount: number) => amount / course.duration_years;
  for (const ft of feeTypes) {
    await db.execute(
      "INSERT INTO student_fees (student_id, fee_type_id, total_amount, academic_year) VALUES (?, ?, ?, 1)",
      [studentId, ft.id, perYearAmount(ft.amount)]
    );
  }

  return studentId;
}

export async function updateStudent(
  id: number,
  data: {
    name: string;
    parent_name?: string;
    gender?: string;
    course_id: number;
    enrollment_date: string;
  }
): Promise<void> {
  const db = await getDb();

  const courses = await db.select<Course[]>(
    "SELECT * FROM courses WHERE id = ?",
    [data.course_id]
  );
  if (courses.length === 0) throw new Error("Course not found");

  const course = courses[0];
  const enrollYear = new Date(data.enrollment_date).getFullYear();
  const batchYear = enrollYear + course.duration_years;

  await db.execute(
    `UPDATE students
     SET name = ?, parent_name = ?, gender = ?, course_id = ?, enrollment_date = ?, batch_year = ?
     WHERE id = ?`,
    [
      data.name,
      data.parent_name || null,
      data.gender || null,
      data.course_id,
      data.enrollment_date,
      batchYear,
      id,
    ]
  );
}

export async function deleteStudent(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM students WHERE id = ?", [id]);
}

export async function graduateAll(): Promise<{ promoted: number; archived: number }> {
  const db = await getDb();

  const archivedResult = await db.execute(
    "UPDATE students SET graduated_date = datetime('now') WHERE current_year >= 2 AND graduated_date IS NULL"
  );
  const archived = archivedResult.rowsAffected;

  const year1Students = await db.select<Student[]>(
    "SELECT * FROM students WHERE current_year = 1 AND graduated_date IS NULL"
  );

  await db.execute(
    "UPDATE students SET current_year = current_year + 1 WHERE current_year = 1 AND graduated_date IS NULL"
  );
  const promoted = year1Students.length;

  const allCourses = await db.select<Course[]>(
    "SELECT * FROM courses"
  );
  const courseDuration = Object.fromEntries(
    allCourses.map((c) => [c.id, c.duration_years])
  );

  const feeTypes = await db.select<FeeType[]>(
    "SELECT * FROM fee_types WHERE is_active = 1"
  );
  const perYearAmount = (amount: number, years: number) => amount / years;
  for (const student of year1Students) {
    const years = courseDuration[student.course_id] || 1;
    for (const ft of feeTypes) {
      await db.execute(
        "INSERT INTO student_fees (student_id, fee_type_id, total_amount, academic_year) VALUES (?, ?, ?, 2)",
        [student.id, ft.id, perYearAmount(ft.amount, years)]
      );
    }
  }

  return { promoted, archived };
}

// --- Fee Types ---

export async function getFeeTypes(activeOnly = true): Promise<FeeType[]> {
  const db = await getDb();
  if (activeOnly) {
    return db.select("SELECT * FROM fee_types WHERE is_active = 1 ORDER BY name");
  }
  return db.select("SELECT * FROM fee_types ORDER BY name");
}

export async function addFeeType(name: string, amount: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO fee_types (name, amount) VALUES (?, ?)",
    [name, amount]
  );
}

export async function updateFeeType(id: number, name: string, amount: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE fee_types SET name = ?, amount = ? WHERE id = ?",
    [name, amount, id]
  );
}

export async function deleteFeeType(id: number): Promise<boolean> {
  const db = await getDb();
  const payments = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM fee_payments fp
     JOIN student_fees sf ON fp.student_fee_id = sf.id
     WHERE sf.fee_type_id = ?`,
    [id]
  );
  if (payments[0].cnt > 0) return false;
  await db.execute("DELETE FROM student_fees WHERE fee_type_id = ?", [id]);
  await db.execute("DELETE FROM fee_types WHERE id = ?", [id]);
  return true;
}

// --- Student Fees ---

export async function getStudentFees(studentId: number): Promise<StudentFee[]> {
  const db = await getDb();
  return db.select(
    `SELECT sf.*, ft.name as fee_type_name
     FROM student_fees sf
     JOIN fee_types ft ON sf.fee_type_id = ft.id
     WHERE sf.student_id = ?
     ORDER BY sf.academic_year, ft.name`,
    [studentId]
  );
}

export async function getStudentFeeSummary(studentId: number): Promise<StudentFeeSummary[]> {
  const db = await getDb();
  return db.select(
    `SELECT
       sf.id as student_fee_id,
       ft.name as fee_type_name,
       sf.academic_year,
       sf.total_amount,
       COALESCE(SUM(fp.amount), 0) as paid_amount,
       sf.total_amount - COALESCE(SUM(fp.amount), 0) as remaining
     FROM student_fees sf
     JOIN fee_types ft ON sf.fee_type_id = ft.id
     LEFT JOIN fee_payments fp ON fp.student_fee_id = sf.id
     WHERE sf.student_id = ?
     GROUP BY sf.id
     ORDER BY sf.academic_year, ft.name`,
    [studentId]
  );
}

export async function addStudentFee(
  studentId: number,
  feeTypeId: number,
  totalAmount: number,
  academicYear: number
): Promise<void> {
  const db = await getDb();
  const existing = await db.select<{ id: number }[]>(
    "SELECT id FROM student_fees WHERE student_id = ? AND fee_type_id = ? AND academic_year = ?",
    [studentId, feeTypeId, academicYear]
  );
  if (existing.length > 0) throw new Error("This fee type is already assigned for this year");
  await db.execute(
    "INSERT INTO student_fees (student_id, fee_type_id, total_amount, academic_year) VALUES (?, ?, ?, ?)",
    [studentId, feeTypeId, totalAmount, academicYear]
  );
}

export async function updateStudentFee(
  studentFeeId: number,
  newTotalAmount: number
): Promise<void> {
  const db = await getDb();

  const summary = await db.select<{ paid_amount: number }[]>(
    `SELECT COALESCE(SUM(fp.amount), 0) as paid_amount
     FROM student_fees sf
     LEFT JOIN fee_payments fp ON fp.student_fee_id = sf.id
     WHERE sf.id = ?
     GROUP BY sf.id`,
    [studentFeeId]
  );

  if (summary.length === 0) throw new Error("Fee record not found");
  if (newTotalAmount < summary[0].paid_amount) {
    throw new Error("New amount cannot be less than already paid amount");
  }

  await db.execute(
    "UPDATE student_fees SET total_amount = ? WHERE id = ?",
    [newTotalAmount, studentFeeId]
  );
}

export async function deleteStudentFee(studentFeeId: number): Promise<boolean> {
  const db = await getDb();
  const payments = await db.select<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM fee_payments WHERE student_fee_id = ?",
    [studentFeeId]
  );
  if (payments[0].cnt > 0) return false;
  await db.execute("DELETE FROM student_fees WHERE id = ?", [studentFeeId]);
  return true;
}

// --- Fee Payments ---

export async function getFeePayments(studentId: number): Promise<FeePayment[]> {
  const db = await getDb();
  return db.select(
    `SELECT fp.*, ft.name as fee_type_name
     FROM fee_payments fp
     JOIN student_fees sf ON fp.student_fee_id = sf.id
     JOIN fee_types ft ON sf.fee_type_id = ft.id
     WHERE fp.student_id = ?
     ORDER BY fp.payment_date DESC`,
    [studentId]
  );
}

export async function addFeePayment(data: {
  student_id: number;
  student_fee_id: number;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes?: string;
}): Promise<void> {
  const db = await getDb();

  const summary = await db.select<{ remaining: number }[]>(
    `SELECT sf.total_amount - COALESCE(SUM(fp.amount), 0) as remaining
     FROM student_fees sf
     LEFT JOIN fee_payments fp ON fp.student_fee_id = sf.id
     WHERE sf.id = ?
     GROUP BY sf.id`,
    [data.student_fee_id]
  );

  if (summary.length === 0) throw new Error("Fee not found");
  if (data.amount > summary[0].remaining) throw new Error("Amount exceeds remaining balance");

  await db.execute(
    `INSERT INTO fee_payments (student_id, student_fee_id, amount, payment_method, payment_date, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.student_id,
      data.student_fee_id,
      data.amount,
      data.payment_method,
      data.payment_date,
      data.notes || null,
    ]
  );
}

export async function deleteFeePayment(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM fee_payments WHERE id = ?", [id]);
}

// --- Quick Payment (search active students) ---

export async function searchActiveStudents(search: string): Promise<
  { id: number; name: string; course_name: string; current_year: number }[]
> {
  const db = await getDb();
  return db.select(
    `SELECT s.id, s.name, c.name as course_name, s.current_year
     FROM students s
     JOIN courses c ON s.course_id = c.id
     WHERE s.graduated_date IS NULL AND s.name LIKE ?
     ORDER BY s.name
     LIMIT 20`,
    [`%${search}%`]
  );
}

export async function getAllActiveStudents(): Promise<
  { id: number; name: string; course_name: string; current_year: number }[]
> {
  const db = await getDb();
  return db.select(
    `SELECT s.id, s.name, c.name as course_name, s.current_year
     FROM students s
     JOIN courses c ON s.course_id = c.id
     WHERE s.graduated_date IS NULL
     ORDER BY s.name`
  );
}

// --- Dashboard Stats ---

export interface DashboardStats {
  totalActiveStudents: number;
  year1Students: number;
  year2Students: number;
  totalFeeExpected: number;
  totalCollected: number;
  totalPending: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDb();

  const counts = await db.select<{ current_year: number; cnt: number }[]>(
    "SELECT current_year, COUNT(*) as cnt FROM students WHERE graduated_date IS NULL GROUP BY current_year"
  );

  const year1 = counts.find((c) => c.current_year === 1)?.cnt || 0;
  const year2 = counts.find((c) => c.current_year === 2)?.cnt || 0;

  const feeStats = await db.select<
    { total_expected: number; total_paid: number }[]
  >(
    `SELECT
       COALESCE(SUM(sf.total_amount), 0) as total_expected,
       COALESCE((SELECT SUM(fp.amount) FROM fee_payments fp
                 JOIN student_fees sf2 ON fp.student_fee_id = sf2.id
                 JOIN students s2 ON sf2.student_id = s2.id
                 WHERE s2.graduated_date IS NULL), 0) as total_paid
     FROM student_fees sf
     JOIN students s ON sf.student_id = s.id
     WHERE s.graduated_date IS NULL`
  );

  const expected = feeStats[0]?.total_expected || 0;
  const paid = feeStats[0]?.total_paid || 0;

  return {
    totalActiveStudents: year1 + year2,
    year1Students: year1,
    year2Students: year2,
    totalFeeExpected: expected,
    totalCollected: paid,
    totalPending: expected - paid,
  };
}

export async function getPendingFeeStudents(): Promise<
  {
    student_id: number;
    student_name: string;
    course_name: string;
    batch_year: number;
    current_year: number;
    total_fee: number;
    total_paid: number;
    pending: number;
  }[]
> {
  const db = await getDb();
  return db.select(`
    SELECT
      s.id as student_id,
      s.name as student_name,
      c.name as course_name,
      s.batch_year,
      s.current_year,
      COALESCE(SUM(sf.total_amount), 0) as total_fee,
      COALESCE(paid.total_paid, 0) as total_paid,
      COALESCE(SUM(sf.total_amount), 0) - COALESCE(paid.total_paid, 0) as pending
    FROM students s
    JOIN courses c ON s.course_id = c.id
    JOIN student_fees sf ON sf.student_id = s.id
    LEFT JOIN (
      SELECT fp.student_id, SUM(fp.amount) as total_paid
      FROM fee_payments fp
      GROUP BY fp.student_id
    ) paid ON paid.student_id = s.id
    WHERE s.graduated_date IS NULL
    GROUP BY s.id
    HAVING pending > 0
    ORDER BY pending DESC
  `);
}
