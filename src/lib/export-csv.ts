import { getStudents, getFeePayments, getPendingFeeStudents } from "./queries";

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
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
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportStudentsCsv(filter?: { graduated?: boolean }) {
  const students = await getStudents(filter ?? { graduated: false });
  downloadCsv(
    "students.csv",
    ["Name", "Course", "Parent", "Gender", "Address", "Year", "Batch", "Enrolled", "Graduated"],
    students.map((s) => [
      s.name,
      s.course_name,
      s.parent_name ?? "",
      s.gender ?? "",
      s.address ?? "",
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
    downloadCsv(
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
  downloadCsv(
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
