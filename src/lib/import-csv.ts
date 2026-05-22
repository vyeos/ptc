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

export interface ImportResult {
  added: number;
  skipped: string[];
  errors: string[];
}

export async function importStudentsCsv(file: File): Promise<ImportResult> {
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { added: 0, skipped: [], errors: ["CSV file is empty or has no data rows"] };
  }

  const colMap = matchHeader(rows[0]);
  if (colMap.name === -1) {
    return { added: 0, skipped: [], errors: ["Missing required 'Name' column"] };
  }

  const courses = await getCourses();
  const courseMap = new Map<string, Course>();
  for (const c of courses) {
    courseMap.set(c.name.toLowerCase(), c);
  }

  if (courses.length === 0) {
    return { added: 0, skipped: [], errors: ["No courses configured. Add a course first."] };
  }

  const defaultCourse = courses[0];
  const db = await getDb();
  const result: ImportResult = { added: 0, skipped: [], errors: [] };
  const today = new Date().toISOString().split("T")[0];

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

    try {
      const insertResult = await db.execute(
        `INSERT INTO students (name, parent_name, gender, course_id, enrollment_date, current_year, batch_year)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [
          name,
          get("parent") || null,
          get("gender") || null,
          course.id,
          enrollDate,
          batchYear,
        ]
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
