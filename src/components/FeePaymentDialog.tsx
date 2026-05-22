import { useState } from "react";
import { addFeePayment, type StudentFeeSummary } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";

interface Props {
  studentId: number;
  fees: StudentFeeSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function FeePaymentDialog({ studentId, fees, open, onOpenChange, onSuccess }: Props) {
  const unpaidFees = fees.filter((f) => f.remaining > 0);
  const [feeId, setFeeId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedFee = unpaidFees.find((f) => f.student_fee_id === feeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeId || !amount) return;

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
        student_id: studentId,
        student_fee_id: feeId,
        amount: numAmount,
        payment_method: method,
        payment_date: date,
        notes: notes || undefined,
      });
      toast.success("Payment recorded");
      setFeeId(null);
      setAmount("");
      setNotes("");
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Fee Payment</DialogTitle>
        </DialogHeader>
        {unpaidFees.length === 0 ? (
          <p className="text-sm text-muted-foreground">All fees are fully paid.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Fee Type</Label>
              <Select
                value={feeId ? String(feeId) : ""}
                onValueChange={(v) => setFeeId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select fee" />
                </SelectTrigger>
                <SelectContent>
                  {unpaidFees.map((f) => (
                    <SelectItem key={f.student_fee_id} value={String(f.student_fee_id)}>
                      {f.fee_type_name} (Year {f.academic_year}) — Remaining: {f.remaining.toLocaleString("en-IN")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={1}
                max={selectedFee?.remaining}
                required
              />
              {selectedFee && (
                <p className="text-xs text-muted-foreground">
                  Max: {selectedFee.remaining.toLocaleString("en-IN")}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Payment Method</Label>
              <ToggleGroup type="single" value={method} onValueChange={(v) => v && setMethod(v)}>
                <ToggleGroupItem value="cash">Cash</ToggleGroupItem>
                <ToggleGroupItem value="upi">UPI</ToggleGroupItem>
                <ToggleGroupItem value="cheque">Cheque</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Receipt number, etc."
              />
            </div>

            <Button type="submit" disabled={saving || !feeId}>
              {saving ? "Saving..." : "Record Payment"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
