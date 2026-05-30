import Database from "@tauri-apps/plugin-sql";
import { open } from "@tauri-apps/plugin-dialog";
import { getDb } from "./db";
import { getCourses, type Course } from "./queries";
import type { ImportResult } from "./import-csv";

interface ImportedStudent {
  name: string;
  parent_name: string | null;
  gender: string | null;
  course_name: string;
  enrollment_date: string;
  current_year: number;
  batch_year: number;
}

export async function importStudentsDb(): Promise<ImportResult | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "SQLite Database", extensions: ["db"] }],
  });

  if (!selected) return null;

  const importDb = await Database.load(`sqlite:${selected}`);

  try {
    const tables = await importDb.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='students'"
    );
    if (tables.length === 0) {
      return { added: 0, skipped: [], duplicates: 0, conflicts: [], errors: ["No 'students' table found in the database"] };
    }

    const hasCourses = (await importDb.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='courses'"
    )).length > 0;

    let rows: ImportedStudent[];
    if (hasCourses) {
      rows = await importDb.select<ImportedStudent[]>(
        `SELECT s.name, s.parent_name, s.gender, c.name as course_name,
                s.enrollment_date, s.current_year, s.batch_year
         FROM students s LEFT JOIN courses c ON s.course_id = c.id
         WHERE s.graduated_date IS NULL`
      );
    } else {
      rows = await importDb.select<ImportedStudent[]>(
        `SELECT name, parent_name, gender, '' as course_name,
                enrollment_date, current_year, batch_year
         FROM students WHERE graduated_date IS NULL`
      );
    }

    if (rows.length === 0) {
      return { added: 0, skipped: [], duplicates: 0, conflicts: [], errors: ["No active students found in the database"] };
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
      { id: number; name: string; parent_name: string | null; gender: string | null; course_id: number; course_name: string; enrollment_date: string }[]
    >(
      `SELECT s.id, s.name, s.parent_name, s.gender, s.course_id, c.name as course_name, s.enrollment_date
       FROM students s JOIN courses c ON s.course_id = c.id
       WHERE s.graduated_date IS NULL AND s.cancelled_date IS NULL`
    );

    const studentsByName = new Map<string, typeof existingStudents>();
    for (const s of existingStudents) {
      const key = s.name.toLowerCase().trim();
      const list = studentsByName.get(key) || [];
      list.push(s);
      studentsByName.set(key, list);
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.name?.trim()) {
        result.skipped.push(`Row ${i + 1}: empty name`);
        continue;
      }

      const courseName = r.course_name?.trim() || "";
      const course = courseName ? courseMap.get(courseName.toLowerCase()) : defaultCourse;
      if (!course) {
        result.errors.push(`${r.name}: unknown course "${courseName}"`);
        continue;
      }

      const enrollDate = r.enrollment_date?.slice(0, 10) || today;
      const enrollYear = new Date(enrollDate).getFullYear();
      const batchYear = r.batch_year || enrollYear + course.duration_years;
      const parentName = r.parent_name || null;
      const gender = r.gender || null;

      const matches = studentsByName.get(r.name.toLowerCase().trim());
      if (matches && matches.length > 0) {
        const existing = matches.find(
          (s) => s.course_name.toLowerCase() === course.name.toLowerCase()
        ) || matches[0];

        const diffFields: string[] = [];
        if ((existing.parent_name || "") !== (parentName || "")) diffFields.push("parent");
        if ((existing.gender || "") !== (gender || "")) diffFields.push("gender");
        if (existing.course_name.toLowerCase() !== course.name.toLowerCase()) diffFields.push("course");
        if (existing.enrollment_date.slice(0, 10) !== enrollDate.slice(0, 10)) diffFields.push("enrollment date");

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
            name: r.name,
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
          [r.name, parentName, gender, course.id, enrollDate, batchYear]
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
        result.errors.push(`${r.name}: ${e instanceof Error ? e.message : "unknown error"}`);
      }
    }

    return result;
  } finally {
    await importDb.close();
  }
}
