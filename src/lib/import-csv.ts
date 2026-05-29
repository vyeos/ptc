import { getDb } from "./db";
import { getCourses, type Course } from "./queries";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(current);
      current = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(current);
      current = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else {
      current += ch;
    }
  }
  row.push(current);
  if (row.some((c) => c.trim())) rows.push(row);

  return rows;
}

function matchHeader(headers: string[]): Record<string, number> {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const find = (candidates: string[]) =>
    normalized.findIndex((h) => candidates.includes(h));

  return {
    name: find(["name", "student name", "student"]),
    course: find(["course", "course name"]),
    parent: find(["parent", "parent name", "parent_name"]),
    gender: find(["gender", "sex"]),
    enrolled: find(["enrolled", "enrollment date", "enrollment_date", "enroll date"]),
  };
}

export interface ConflictFeeSummary {
  fee_type_name: string;
  total_amount: number;
  paid_amount: number;
  remaining: number;
}

export interface ConflictPayment {
  fee_type_name: string;
  amount: number;
  payment_method: string;
  payment_date: string;
}

export interface ImportConflict {
  rowIndex: number;
  existingStudent: {
    id: number;
    name: string;
    parent_name: string | null;
    gender: string | null;
    course_name: string;
    enrollment_date: string;
    current_year: number;
    batch_year: number;
    total_fee: number;
    total_paid: number;
    total_pending: number;
    fees: ConflictFeeSummary[];
    payments: ConflictPayment[];
  };
  imported: {
    name: string;
    parent_name: string | null;
    gender: string | null;
    course_name: string;
    course_id: number;
    enrollment_date: string;
    batch_year: number;
  };
  fields: string[];
}

export interface ImportResult {
  added: number;
  skipped: string[];
  duplicates: number;
  conflicts: ImportConflict[];
  errors: string[];
}

export async function importStudentsCsv(file: File): Promise<ImportResult> {
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { added: 0, skipped: [], duplicates: 0, conflicts: [], errors: ["CSV file is empty or has no data rows"] };
  }

  const colMap = matchHeader(rows[0]);
  if (colMap.name === -1) {
    return { added: 0, skipped: [], duplicates: 0, conflicts: [], errors: ["Missing required 'Name' column"] };
  }

  const courses = await getCourses();
  const courseMap = new Map<string, Course>();
  for (const c of courses) {
    courseMap.set(c.name.toLowerCase(), c);
  }

  if (courses.length === 0) {
    return { added: 0, skipped: [], duplicates: 0, conflicts: [], errors: ["No courses configured. Add a course first."] };
  }

  const defaultCourse = courses[0];
  const db = await getDb();
  const result: ImportResult = { added: 0, skipped: [], duplicates: 0, conflicts: [], errors: [] };
  const today = new Date().toISOString().split("T")[0];

  const existingStudents = await db.select<
    { id: number; name: string; parent_name: string | null; gender: string | null; course_id: number; course_name: string; enrollment_date: string; current_year: number; batch_year: number }[]
  >(
    `SELECT s.id, s.name, s.parent_name, s.gender, s.course_id, c.name as course_name, s.enrollment_date, s.current_year, s.batch_year
     FROM students s JOIN courses c ON s.course_id = c.id
     WHERE s.graduated_date IS NULL`
  );

  const studentsByName = new Map<string, typeof existingStudents>();
  for (const s of existingStudents) {
    const key = s.name.toLowerCase().trim();
    const list = studentsByName.get(key) || [];
    list.push(s);
    studentsByName.set(key, list);
  }

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (key: string) => {
      const idx = colMap[key];
      return idx >= 0 && idx < r.length ? r[idx].trim() : "";
    };

    const name = get("name");
    if (!name) {
      result.skipped.push(`Row ${i + 1}: empty name`);
      continue;
    }

    const courseStr = get("course");
    const course = courseStr ? courseMap.get(courseStr.toLowerCase()) : defaultCourse;
    if (!course) {
      result.errors.push(`Row ${i + 1} (${name}): unknown course "${courseStr}"`);
      continue;
    }

    const enrolledStr = get("enrolled") || today;
    const enrollDate = parseDate(enrolledStr) || today;
    const enrollYear = new Date(enrollDate).getFullYear();
    const batchYear = enrollYear + course.duration_years;
    const parentName = get("parent") || null;
    const gender = get("gender") || null;

    const matches = studentsByName.get(name.toLowerCase().trim());
    if (matches && matches.length > 0) {
      const existing = matches.find(
        (s) => s.course_name.toLowerCase() === course.name.toLowerCase()
      ) || matches[0];

      const diffFields: string[] = [];
      if ((existing.parent_name || "") !== (parentName || ""))
        diffFields.push("parent");
      if ((existing.gender || "") !== (gender || ""))
        diffFields.push("gender");
      if (existing.course_name.toLowerCase() !== course.name.toLowerCase())
        diffFields.push("course");
      if (existing.enrollment_date.slice(0, 10) !== enrollDate.slice(0, 10))
        diffFields.push("enrollment date");

      if (diffFields.length === 0) {
        result.duplicates++;
        continue;
      }

      result.conflicts.push({
        rowIndex: i + 1,
        existingStudent: {
          id: existing.id,
          name: existing.name,
          parent_name: existing.parent_name,
          gender: existing.gender,
          course_name: existing.course_name,
          enrollment_date: existing.enrollment_date,
        },
        imported: {
          name,
          parent_name: parentName,
          gender,
          course_name: course.name,
          course_id: course.id,
          enrollment_date: enrollDate,
          batch_year: batchYear,
        },
        fields: diffFields,
      });
      continue;
    }

    try {
      const insertResult = await db.execute(
        `INSERT INTO students (name, parent_name, gender, course_id, enrollment_date, current_year, batch_year)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [name, parentName, gender, course.id, enrollDate, batchYear]
      );

      const studentId = insertResult.lastInsertId as number;

      const feeTypes = await db.select<{ id: number; amount: number }[]>(
        "SELECT id, amount FROM fee_types WHERE is_active = 1"
      );
      for (const ft of feeTypes) {
        await db.execute(
          "INSERT INTO student_fees (student_id, fee_type_id, total_amount, academic_year) VALUES (?, ?, ?, 1)",
          [studentId, ft.id, ft.amount]
        );
      }

      result.added++;
    } catch (e) {
      result.errors.push(`Row ${i + 1} (${name}): ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  return result;
}

export async function resolveConflicts(
  conflicts: ImportConflict[],
  resolutions: Map<number, "import" | "local">
): Promise<{ updated: number }> {
  const db = await getDb();
  let updated = 0;

  for (const conflict of conflicts) {
    const resolution = resolutions.get(conflict.existingStudent.id);
    if (resolution !== "import") continue;

    const imp = conflict.imported;
    const enrollYear = new Date(imp.enrollment_date).getFullYear();

    const courses = await getCourses();
    const course = courses.find((c) => c.id === imp.course_id);
    const batchYear = course
      ? enrollYear + course.duration_years
      : imp.batch_year;

    await db.execute(
      `UPDATE students SET name = ?, parent_name = ?, gender = ?, course_id = ?, enrollment_date = ?, batch_year = ? WHERE id = ?`,
      [
        imp.name,
        imp.parent_name,
        imp.gender,
        imp.course_id,
        imp.enrollment_date,
        batchYear,
        conflict.existingStudent.id,
      ]
    );
    updated++;
  }

  return { updated };
}

function parseDate(s: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}
