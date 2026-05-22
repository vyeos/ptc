import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { getStudents, getFeePayments, getPendingFeeStudents } from "./queries";

function buildCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  return lines.join("\n");
}

async function saveCsv(filename: string, headers: string[], rows: string[][]) {
  const path = await save({
    defaultPath: filename,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!path) return;
  await writeTextFile(path, buildCsv(headers, rows));
}

export async function exportStudentsCsv(filter?: { graduated?: boolean }) {
  const students = await getStudents(filter ?? { graduated: false });
  await saveCsv(
    "students.csv",
    ["Name", "Course", "Parent", "Gender", "Year", "Batch", "Enrolled", "Graduated"],
    students.map((s) => [
      s.name,
      s.course_name,
      s.parent_name ?? "",
      s.gender ?? "",
      String(s.current_year),
      String(s.batch_year),
      s.enrollment_date,
      s.graduated_date ?? "",
    ])
  );
}

export async function exportPaymentsCsv(studentId?: number) {
  if (studentId) {
    const payments = await getFeePayments(studentId);
    await saveCsv(
      `payments-student-${studentId}.csv`,
      ["Date", "Fee Type", "Method", "Amount", "Notes"],
      payments.map((p) => [
        p.payment_date,
        p.fee_type_name ?? "",
        p.payment_method,
        String(p.amount),
        p.notes ?? "",
      ])
    );
  }
}

export async function exportPendingFeesCsv(batchYear?: number) {
  const students = await getPendingFeeStudents();
  const filtered = batchYear ? students.filter((s) => s.batch_year === batchYear) : students;
  await saveCsv(
    `pending-fees${batchYear ? `-${batchYear}` : ""}.csv`,
    ["Name", "Course", "Year", "Batch", "Total Fee", "Paid", "Pending"],
    filtered.map((s) => [
      s.student_name,
      s.course_name,
      String(s.current_year),
      String(s.batch_year),
      String(s.total_fee),
      String(s.total_paid),
      String(s.pending),
    ])
  );
}
