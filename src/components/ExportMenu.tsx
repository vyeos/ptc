import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Label } from "@/components/ui/label";
import { FileText, FileSpreadsheet, Upload } from "lucide-react";
import { exportPendingFeesPdf, exportStudentReceiptPdf } from "@/lib/export-pdf";
import { exportStudentsCsv, exportPaymentsCsv, exportPendingFeesCsv } from "@/lib/export-csv";
import { getBatchYears } from "@/lib/queries";
import { toast } from "sonner";

interface Props {
  context: "dashboard" | "student";
  studentId?: number;
}

export function ExportMenu({ context, studentId }: Props) {
  const [batchDialog, setBatchDialog] = useState<{ action: string } | null>(null);
  const [batchYear, setBatchYear] = useState("all");
  const [batchYears, setBatchYears] = useState<number[]>([]);

  useEffect(() => {
    getBatchYears().then(setBatchYears);
  }, []);

  const handleExport = async (action: string, batch?: number) => {
    try {
      switch (action) {
        case "pending-pdf":
          await exportPendingFeesPdf(batch);
          break;
        case "pending-csv":
          await exportPendingFeesCsv(batch);
          break;
        case "students-csv":
          await exportStudentsCsv();
          break;
        case "receipt-pdf":
          if (studentId) await exportStudentReceiptPdf(studentId);
          break;
        case "payments-csv":
          if (studentId) await exportPaymentsCsv(studentId);
          break;
      }
      toast.success("Export complete");
    } catch {
      toast.error("Export failed");
    }
  };

  const handleBatchConfirm = () => {
    if (!batchDialog) return;
    const year = batchYear !== "all" ? Number(batchYear) : undefined;
    handleExport(batchDialog.action, year);
    setBatchDialog(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Upload data-icon="inline-start" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {context === "dashboard" && (
            <>
              <DropdownMenuItem onClick={() => setBatchDialog({ action: "pending-pdf" })}>
                <FileText data-icon="inline-start" />
                Pending Fees (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBatchDialog({ action: "pending-csv" })}>
                <FileSpreadsheet data-icon="inline-start" />
                Pending Fees (CSV)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport("students-csv")}>
                <FileSpreadsheet data-icon="inline-start" />
                All Students (CSV)
              </DropdownMenuItem>
            </>
          )}
          {context === "student" && studentId && (
            <>
              <DropdownMenuItem onClick={() => handleExport("receipt-pdf")}>
                <FileText data-icon="inline-start" />
                Fee Receipt (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("payments-csv")}>
                <FileSpreadsheet data-icon="inline-start" />
                Payments (CSV)
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={batchDialog !== null} onOpenChange={(open) => !open && setBatchDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filter by Batch Year</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Batch Year</Label>
              <Select value={batchYear} onValueChange={setBatchYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {batchYears.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleBatchConfirm}>Export</Button>
              <Button variant="outline" onClick={() => setBatchDialog(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
