import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Plus, GraduationCap, MoreHorizontal, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export default function Students() {
  const [tab, setTab] = useState("year1");
  const [students, setStudents] = useState<StudentWithCourse[]>([]);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

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
    await addStudent(data);
    setSheetOpen(false);
    toast.success("Student added");
    load();
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

          <Button onClick={() => setSheetOpen(true)}>
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
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          to={`/students/${s.id}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{s.course_name}</Badge>
                      </TableCell>
                      <TableCell>{s.parent_name || "—"}</TableCell>
                      <TableCell>{s.batch_year}</TableCell>
                      <TableCell>
                        {new Date(s.enrollment_date).toLocaleDateString("en-IN")}
                      </TableCell>
                      {tab !== "archived" && (
                        <TableCell>
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Student</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <StudentForm onSubmit={handleAdd} onCancel={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

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
    </div>
  );
}
