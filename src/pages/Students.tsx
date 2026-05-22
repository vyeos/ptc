import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getStudents,
  addStudent,
  deleteStudent,
  graduateAll,
  type StudentWithCourse,
} from "@/lib/queries";
import { StudentForm, type StudentFormData } from "@/components/StudentForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { Plus, GraduationCap, MoreHorizontal, Trash2, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { importStudentsCsv, resolveConflicts, type ImportConflict, type ImportResult } from "@/lib/import-csv";
import { importStudentsDb } from "@/lib/import-db";
import { ImportConflictDialog } from "@/components/ImportConflictDialog";

export default function Students() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("year1");
  const [students, setStudents] = useState<StudentWithCourse[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);

  const showImportResult = (result: ImportResult, label: string) => {
    if (result.added > 0) {
      toast.success(`Imported ${result.added} student${result.added > 1 ? "s" : ""}`);
      load();
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
      load();
    } catch {
      toast.error("Failed to resolve conflicts");
    } finally {
      setConflicts([]);
    }
  };

  const load = useCallback(async () => {
    const filter =
      tab === "archived"
        ? { graduated: true, search }
        : { year: tab === "year1" ? 1 : 2, graduated: false, search };
    setStudents(await getStudents(filter));
  }, [tab, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (data: StudentFormData) => {
    try {
      await addStudent(data);
      setDialogOpen(false);
      toast.success("Student added");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add student");
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    await deleteStudent(deleteId);
    setDeleteId(null);
    toast.success("Student deleted");
    load();
  };

  const handleGraduate = async () => {
    const result = await graduateAll();
    toast.success(
      `Graduated: ${result.promoted} promoted to Year 2, ${result.archived} archived`
    );
    load();
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Students</h2>
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

          <Button onClick={() => setDialogOpen(true)}>
            <Plus data-icon="inline-start" />
            Add Student
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="year1">Year 1</TabsTrigger>
          <TabsTrigger value="year2">Year 2</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>

        {["year1", "year2", "archived"].map((t) => (
          <TabsContent key={t} value={t}>
            {students.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No students found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Enrolled</TableHead>
                    {tab !== "archived" && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/students/${s.id}`)}
                    >
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{s.course_name}</Badge>
                      </TableCell>
                      <TableCell>{s.parent_name || "—"}</TableCell>
                      <TableCell>{s.batch_year}</TableCell>
                      <TableCell>
                        {new Date(s.enrollment_date).toLocaleDateString("en-IN")}
                      </TableCell>
                      {tab !== "archived" && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteId(s.id)}
                              >
                                <Trash2 data-icon="inline-start" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
          </DialogHeader>
          <StudentForm onSubmit={handleAdd} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the student and all their fee records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportConflictDialog
        conflicts={conflicts}
        open={conflicts.length > 0}
        onResolve={handleResolveConflicts}
        onCancel={() => setConflicts([])}
      />
    </div>
  );
}
