import { useState } from "react";
import { addStudent, graduateAll } from "@/lib/queries";
import { StudentForm, type StudentFormData } from "@/components/StudentForm";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GraduationCap, Plus, Download } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { importStudentsCsv, resolveConflicts, type ImportConflict, type ImportResult } from "@/lib/import-csv";
import { importStudentsDb } from "@/lib/import-db";
import { ImportConflictDialog } from "@/components/ImportConflictDialog";
import { toast } from "sonner";

interface Props {
  onDataChange: () => void;
}

export function StudentActions({ onDataChange }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);

  const showImportResult = (result: ImportResult, label: string) => {
    if (result.added > 0) {
      toast.success(`Imported ${result.added} student${result.added > 1 ? "s" : ""}`);
    }
    if (result.duplicates > 0) {
      toast.info(`${result.duplicates} duplicate${result.duplicates > 1 ? "s" : ""} skipped (identical data)`);
    }
    if (result.skipped.length > 0) {
      toast.warning(`Skipped ${result.skipped.length} row${result.skipped.length > 1 ? "s" : ""}: ${result.skipped[0]}`);
    }
    if (result.errors.length > 0) {
      toast.error(`${result.errors.length} error${result.errors.length > 1 ? "s" : ""}: ${result.errors[0]}`);
    }
    if (result.conflicts.length > 0) {
      setConflicts(result.conflicts);
    } else if (result.added === 0 && result.errors.length === 0 && result.skipped.length === 0 && result.duplicates === 0) {
      toast.info(`No students found in ${label}`);
    }
    onDataChange();
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const result = await importStudentsCsv(file);
      showImportResult(result, "CSV");
    } catch {
      toast.error("Failed to import CSV");
    } finally {
      setImporting(false);
    }
  };

  const handleImportDb = async () => {
    setImporting(true);
    try {
      const result = await importStudentsDb();
      if (result) {
        showImportResult(result, "database");
      }
    } catch {
      toast.error("Failed to import database");
    } finally {
      setImporting(false);
    }
  };

  const handleResolveConflicts = async (resolutions: Map<number, "import" | "local">) => {
    try {
      const result = await resolveConflicts(conflicts, resolutions);
      const kept = conflicts.length - result.updated;
      if (result.updated > 0) {
        toast.success(`Updated ${result.updated} student${result.updated > 1 ? "s" : ""} from import`);
      }
      if (kept > 0) {
        toast.info(`Kept local data for ${kept} student${kept > 1 ? "s" : ""}`);
      }
      onDataChange();
    } catch {
      toast.error("Failed to resolve conflicts");
    } finally {
      setConflicts([]);
    }
  };

  const handleAdd = async (data: StudentFormData) => {
    try {
      await addStudent(data);
      setDialogOpen(false);
      toast.success("Student added");
      onDataChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add student");
    }
  };

  const handleGraduate = async () => {
    const result = await graduateAll();
    toast.success(
      `Graduated: ${result.promoted} promoted to Year 2, ${result.archived} archived`
    );
    onDataChange();
  };

  return (
    <>
      <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">
              <GraduationCap data-icon="inline-start" />
              Graduate All
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Graduate All Students?</AlertDialogTitle>
              <AlertDialogDescription>
                This will promote all Year 1 students to Year 2 and archive all
                Year 2 students. Year 2 fee assignments will be created for
                promoted students. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleGraduate}>
                Confirm Graduation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={importing}>
              <Download data-icon="inline-start" />
              {importing ? "Importing..." : "Import"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <label className="cursor-pointer">
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImportCsv}
                />
              </label>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportDb}>
              Import Database (.db)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ExportMenu context="dashboard" />

        <Button onClick={() => setDialogOpen(true)}>
          <Plus data-icon="inline-start" />
          Add Student
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
          </DialogHeader>
          <StudentForm onSubmit={handleAdd} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <ImportConflictDialog
        conflicts={conflicts}
        open={conflicts.length > 0}
        onResolve={handleResolveConflicts}
        onCancel={() => setConflicts([])}
      />
    </>
  );
}
