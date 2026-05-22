import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getPendingFeeStudents, getStudentFeeSummary, getFeePayments, getStudent } from "./queries";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export async function exportPendingFeesPdf(batchYear?: number) {
  const students = await getPendingFeeStudents();
  const filtered = batchYear ? students.filter((s) => s.batch_year === batchYear) : students;

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(
    `Pending Fee Report${batchYear ? ` — Batch ${batchYear}` : ""}`,
    14,
    20
  );
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, 14, 28);

  autoTable(doc, {
    startY: 35,
    head: [["Name", "Course", "Year", "Batch", "Total Fee", "Paid", "Pending"]],
    body: filtered.map((s) => [
      s.student_name,
      s.course_name,
      `Year ${s.current_year}`,
      String(s.batch_year),
      formatCurrency(s.total_fee),
      formatCurrency(s.total_paid),
      formatCurrency(s.pending),
    ]),
  });

  doc.save(`pending-fees${batchYear ? `-${batchYear}` : ""}.pdf`);
}

export async function exportStudentReceiptPdf(studentId: number) {
  const student = await getStudent(studentId);
  if (!student) return;

  const feeSummary = await getStudentFeeSummary(studentId);
  const payments = await getFeePayments(studentId);

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Student Fee Receipt", 14, 20);
  doc.setFontSize(12);
  doc.text(student.name, 14, 30);
  doc.setFontSize(10);
  doc.text(
    `${student.course_name} | Year ${student.current_year} | Batch ${student.batch_year}`,
    14,
    37
  );
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, 14, 44);

  autoTable(doc, {
    startY: 52,
    head: [["Fee Type", "Year", "Total", "Paid", "Remaining"]],
    body: feeSummary.map((f) => [
      f.fee_type_name,
      `Year ${f.academic_year}`,
      formatCurrency(f.total_amount),
      formatCurrency(f.paid_amount),
      formatCurrency(f.remaining),
    ]),
  });

  const afterFeeTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 100;

  if (payments.length > 0) {
    doc.setFontSize(12);
    doc.text("Payment History", 14, afterFeeTable + 10);

    autoTable(doc, {
      startY: afterFeeTable + 15,
      head: [["Date", "Fee Type", "Method", "Amount", "Notes"]],
      body: payments.map((p) => [
        new Date(p.payment_date).toLocaleDateString("en-IN"),
        p.fee_type_name ?? "",
        p.payment_method.toUpperCase(),
        formatCurrency(p.amount),
        p.notes ?? "",
      ]),
    });
  }

  doc.save(`receipt-${student.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
