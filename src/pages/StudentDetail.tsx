import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getStudent,
  updateStudent,
  getStudentFeeSummary,
  getFeePayments,
  deleteFeePayment,
  getFeeTypes,
  addStudentFee,
  deleteStudentFee,
  type StudentWithCourse,
  type StudentFeeSummary,
  type FeePayment,
  type FeeType,
} from "@/lib/queries";
import { StudentForm, type StudentFormData } from "@/components/StudentForm";
import { FeePaymentDialog } from "@/components/FeePaymentDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ExportMenu";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const studentId = Number(id);

  const [student, setStudent] = useState<StudentWithCourse | null>(null);
  const [feeSummary, setFeeSummary] = useState<StudentFeeSummary[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null);
  const [addFeeOpen, setAddFeeOpen] = useState(false);
  const [allFeeTypes, setAllFeeTypes] = useState<FeeType[]>([]);
  const [selectedFeeTypeId, setSelectedFeeTypeId] = useState<string>("");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeYear, setFeeYear] = useState("1");
  const [addingFee, setAddingFee] = useState(false);
  const [deleteFeeId, setDeleteFeeId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [s, fs, fp] = await Promise.all([
      getStudent(studentId),
      getStudentFeeSummary(studentId),
      getFeePayments(studentId),
    ]);
    setStudent(s);
    setFeeSummary(fs);
    setPayments(fp);
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdate = async (data: StudentFormData) => {
    await updateStudent(studentId, data);
    setEditOpen(false);
    toast.success("Student updated");
    load();
  };

  const handleDeletePayment = async () => {
    if (deletePaymentId === null) return;
    await deleteFeePayment(deletePaymentId);
    setDeletePaymentId(null);
    toast.success("Payment deleted");
    load();
  };

  const openAddFeeDialog = async () => {
    const types = await getFeeTypes();
    setAllFeeTypes(types);
    setSelectedFeeTypeId("");
    setFeeAmount("");
    setFeeYear("1");
    setAddFeeOpen(true);
  };

  const handleAddFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeeTypeId) return;
    setAddingFee(true);
    try {
      await addStudentFee(
        studentId,
        Number(selectedFeeTypeId),
        Number(feeAmount),
        Number(feeYear)
      );
      toast.success("Fee type added");
      setAddFeeOpen(false);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add fee");
    } finally {
      setAddingFee(false);
    }
  };

  const handleDeleteFee = async () => {
    if (deleteFeeId === null) return;
    const ok = await deleteStudentFee(deleteFeeId);
    if (!ok) {
      toast.error("Cannot remove: payments exist for this fee");
      setDeleteFeeId(null);
      return;
    }
    toast.success("Fee type removed");
    setDeleteFeeId(null);
    load();
  };

  const selectedFeeType = allFeeTypes.find(
    (ft) => ft.id === Number(selectedFeeTypeId)
  );

  if (!student) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  const totalFee = feeSummary.reduce((s, f) => s + f.total_amount, 0);
  const totalPaid = feeSummary.reduce((s, f) => s + f.paid_amount, 0);
  const totalRemaining = totalFee - totalPaid;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/students")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold">{student.name}</h2>
          <p className="text-sm text-muted-foreground">
            {student.course_name} &middot; Year {student.current_year} &middot; Batch{" "}
            {student.batch_year}
            {student.graduated_date && (
              <Badge variant="secondary" className="ml-2">Graduated</Badge>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu context="student" studentId={studentId} />
          {!student.graduated_date && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil data-icon="inline-start" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Student Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Parent</dt>
              <dd>{student.parent_name || "—"}</dd>
              <dt className="text-muted-foreground">Gender</dt>
              <dd className="capitalize">{student.gender || "—"}</dd>
              <dt className="text-muted-foreground">Enrolled</dt>
              <dd>{new Date(student.enrollment_date).toLocaleDateString("en-IN")}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fee Overview</CardTitle>
            <CardDescription>
              Total: {formatCurrency(totalFee)} &middot; Paid:{" "}
              <span className="text-success">{formatCurrency(totalPaid)}</span>{" "}
              &middot; Remaining:{" "}
              <span className="text-destructive">{formatCurrency(totalRemaining)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!student.graduated_date && (
              <Button onClick={() => setPaymentOpen(true)} className="mb-4">
                <Plus data-icon="inline-start" />
                Add Payment
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fee Summary</CardTitle>
          {!student.graduated_date && (
            <Button size="sm" variant="outline" onClick={openAddFeeDialog}>
              <Plus data-icon="inline-start" />
              Add Fee Type
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {feeSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fees assigned</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee Type</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  {!student.graduated_date && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeSummary.map((f) => (
                  <TableRow key={f.student_fee_id}>
                    <TableCell className="font-medium">{f.fee_type_name}</TableCell>
                    <TableCell>Year {f.academic_year}</TableCell>
                    <TableCell className="text-right">{formatCurrency(f.total_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(f.paid_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(f.remaining)}</TableCell>
                    <TableCell>
                      {f.remaining === 0 ? (
                        <Badge className="bg-success/10 text-success dark:bg-success/20">Paid</Badge>
                      ) : f.paid_amount > 0 ? (
                        <Badge className="bg-warning/10 text-warning dark:bg-warning/20">Pending</Badge>
                      ) : (
                        <Badge variant="destructive">Unpaid</Badge>
                      )}
                    </TableCell>
                    {!student.graduated_date && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          onClick={() => setDeleteFeeId(f.student_fee_id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Fee Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  {!student.graduated_date && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {new Date(p.payment_date).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell>{p.fee_type_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase">
                        {p.payment_method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(p.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.notes || "—"}</TableCell>
                    {!student.graduated_date && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          onClick={() => setDeletePaymentId(p.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          <StudentForm
            initial={{
              name: student.name,
              parent_name: student.parent_name || "",
              gender: student.gender || "",
              course_id: student.course_id,
              enrollment_date: student.enrollment_date.split("T")[0],
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <FeePaymentDialog
        studentId={studentId}
        fees={feeSummary}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onSuccess={load}
      />

      <AlertDialog
        open={deletePaymentId !== null}
        onOpenChange={(open) => !open && setDeletePaymentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the payment record. The remaining balance will increase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addFeeOpen} onOpenChange={setAddFeeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Fee Type</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddFee} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Fee Type</Label>
              <Select
                value={selectedFeeTypeId}
                onValueChange={(v) => {
                  setSelectedFeeTypeId(v);
                  const ft = allFeeTypes.find((t) => t.id === Number(v));
                  if (ft) setFeeAmount(String(ft.amount));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select fee type" />
                </SelectTrigger>
                <SelectContent>
                  {allFeeTypes.map((ft) => (
                    <SelectItem key={ft.id} value={String(ft.id)}>
                      {ft.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min={0}
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                required
              />
              {selectedFeeType && (
                <p className="text-xs text-muted-foreground">
                  Default: {formatCurrency(selectedFeeType.amount)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Academic Year</Label>
              <Select value={feeYear} onValueChange={setFeeYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Year 1</SelectItem>
                  <SelectItem value="2">Year 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={addingFee || !selectedFeeTypeId}>
              {addingFee ? "Adding..." : "Add Fee"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteFeeId !== null}
        onOpenChange={(open) => !open && setDeleteFeeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Fee Type?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the fee from this student. Cannot remove if payments exist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFee}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
