import { useEffect, useState, useCallback } from "react";
import {
  getAllActiveStudents,
  getStudentFeeSummary,
  addFeePayment,
  type StudentFeeSummary,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { Check, ChevronsUpDown, IndianRupee } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveStudent {
  id: number;
  name: string;
  course_name: string;
  current_year: number;
}

export default function Payments() {
  const [students, setStudents] = useState<ActiveStudent[]>([]);
  const [comboOpen, setComboOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<ActiveStudent | null>(null);
  const [fees, setFees] = useState<StudentFeeSummary[]>([]);
  const [feeId, setFeeId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllActiveStudents().then(setStudents);
  }, []);

  const loadFees = useCallback(async (studentId: number) => {
    const summary = await getStudentFeeSummary(studentId);
    const unpaid = summary.filter((f) => f.remaining > 0);
    setFees(unpaid);
    setFeeId(null);
    setAmount("");
  }, []);

  const handleStudentSelect = (student: ActiveStudent) => {
    setSelectedStudent(student);
    setComboOpen(false);
    loadFees(student.id);
  };

  const selectedFee = fees.find((f) => f.student_fee_id === feeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !feeId || !amount) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (selectedFee && numAmount > selectedFee.remaining) {
      toast.error(`Amount cannot exceed remaining balance of ${selectedFee.remaining}`);
      return;
    }

    setSaving(true);
    try {
      await addFeePayment({
        student_id: selectedStudent.id,
        student_fee_id: feeId,
        amount: numAmount,
        payment_method: method,
        payment_date: date,
        notes: notes || undefined,
      });
      toast.success(`Payment of ₹${numAmount.toLocaleString("en-IN")} recorded for ${selectedStudent.name}`);

      // Reset for next payment
      setFeeId(null);
      setAmount("");
      setNotes("");
      // Reload fees for same student in case they want to add another
      loadFees(selectedStudent.id);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add payment");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setSelectedStudent(null);
    setFees([]);
    setFeeId(null);
    setAmount("");
    setNotes("");
    setMethod("cash");
    setDate(new Date().toISOString().split("T")[0]);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Quick Payment</h1>
        <p className="text-sm text-muted-foreground">
          Record fee payments without navigating to individual student pages
        </p>
      </div>

      <div className="mx-auto max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Student Search */}
          <div className="flex flex-col gap-2">
            <Label>Student *</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  className="justify-between font-normal"
                >
                  {selectedStudent
                    ? `${selectedStudent.name} — ${selectedStudent.course_name} (Year ${selectedStudent.current_year})`
                    : "Search student..."}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Type a name..." />
                  <CommandList>
                    <CommandEmpty>No student found.</CommandEmpty>
                    <CommandGroup>
                      {students.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={s.name}
                          onSelect={() => handleStudentSelect(s)}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              selectedStudent?.id === s.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{s.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {s.course_name} — Year {s.current_year}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Fee Type - only shown after student is selected */}
          {selectedStudent && (
            <div className="flex flex-col gap-2">
              <Label>Pending Fee *</Label>
              {fees.length === 0 ? (
                <p className="text-sm text-muted-foreground">All fees are fully paid.</p>
              ) : (
                <Select
                  value={feeId ? String(feeId) : ""}
                  onValueChange={(v) => {
                    const id = Number(v);
                    setFeeId(id);
                    const fee = fees.find((f) => f.student_fee_id === id);
                    if (fee) setAmount(String(fee.remaining));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pending fee" />
                  </SelectTrigger>
                  <SelectContent>
                    {fees.map((f) => (
                      <SelectItem key={f.student_fee_id} value={String(f.student_fee_id)}>
                        {f.fee_type_name} (Year {f.academic_year}) — Remaining: ₹{f.remaining.toLocaleString("en-IN")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Amount */}
          {selectedFee && (
            <div className="flex flex-col gap-2">
              <Label>Amount *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={1}
                  max={selectedFee.remaining}
                  required
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Max: ₹{selectedFee.remaining.toLocaleString("en-IN")}
              </p>
            </div>
          )}

          {/* Payment Method */}
          {selectedFee && (
            <div className="flex flex-col gap-2">
              <Label>Payment Method</Label>
              <ToggleGroup type="single" value={method} onValueChange={(v) => v && setMethod(v)} className="justify-start">
                <ToggleGroupItem value="cash">Cash</ToggleGroupItem>
                <ToggleGroupItem value="upi">UPI</ToggleGroupItem>
                <ToggleGroupItem value="cheque">Cheque</ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}

          {/* Date */}
          {selectedFee && (
            <div className="flex flex-col gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          )}

          {/* Notes */}
          {selectedFee && (
            <div className="flex flex-col gap-2">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Receipt number, etc."
              />
            </div>
          )}

          {/* Actions */}
          {selectedFee && (
            <div className="flex gap-3">
              <Button type="submit" disabled={saving || !feeId} className="flex-1">
                {saving ? "Saving..." : "Record Payment"}
              </Button>
              <Button type="button" variant="outline" onClick={handleClear}>
                Clear
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
