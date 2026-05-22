import { useEffect, useState } from "react";
import {
  getCourses,
  addCourse,
  updateCourse,
  deleteCourse,
  getFeeTypes,
  addFeeType,
  updateFeeType,
  deleteFeeType,
  getSetting,
  setSetting,
  type Course,
  type FeeType,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Moon } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);

  const [courseDialog, setCourseDialog] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [courseName, setCourseName] = useState("");
  const [courseDuration, setCourseDuration] = useState("2");

  const [feeDialog, setFeeDialog] = useState(false);
  const [editFee, setEditFee] = useState<FeeType | null>(null);
  const [feeName, setFeeName] = useState("");
  const [feeAmount, setFeeAmount] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{ type: "course" | "fee"; id: number } | null>(null);

  const [darkMode, setDarkMode] = useState(false);

  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [c, f] = await Promise.all([getCourses(false), getFeeTypes(false)]);
    setCourses(c.filter((x) => x.is_active));
    setFeeTypes(f.filter((x) => x.is_active));
    const e = await getSetting("auth_email");
    if (e) setEmail(e);
    const dm = await getSetting("dark_mode");
    const isDark = dm === "true";
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }

  const openCourseDialog = (course?: Course) => {
    if (course) {
      setEditCourse(course);
      setCourseName(course.name);
      setCourseDuration(String(course.duration_years));
    } else {
      setEditCourse(null);
      setCourseName("");
      setCourseDuration("2");
    }
    setCourseDialog(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editCourse) {
      await updateCourse(editCourse.id, courseName, Number(courseDuration));
      toast.success("Course updated");
    } else {
      await addCourse(courseName, Number(courseDuration));
      toast.success("Course added");
    }
    setCourseDialog(false);
    loadAll();
  };

  const openFeeDialog = (fee?: FeeType) => {
    if (fee) {
      setEditFee(fee);
      setFeeName(fee.name);
      setFeeAmount(String(fee.amount));
    } else {
      setEditFee(null);
      setFeeName("");
      setFeeAmount("");
    }
    setFeeDialog(true);
  };

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editFee) {
      await updateFeeType(editFee.id, feeName, Number(feeAmount));
      toast.success("Fee type updated");
    } else {
      await addFeeType(feeName, Number(feeAmount));
      toast.success("Fee type added");
    }
    setFeeDialog(false);
    loadAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "course") {
      await deleteCourse(deleteTarget.id);
      toast.success("Course removed");
    } else {
      const ok = await deleteFeeType(deleteTarget.id);
      if (!ok) {
        toast.error("Cannot delete: payments exist for this fee type");
        setDeleteTarget(null);
        return;
      }
      toast.success("Fee type removed");
    }
    setDeleteTarget(null);
    loadAll();
  };

  const handleDarkMode = async (checked: boolean) => {
    setDarkMode(checked);
    document.documentElement.classList.toggle("dark", checked);
    await setSetting("dark_mode", String(checked));
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const storedPassword = await getSetting("auth_password");
    if (currentPassword !== storedPassword) {
      toast.error("Current password is incorrect");
      return;
    }
    await setSetting("auth_email", email);
    if (newPassword) {
      await setSetting("auth_password", newPassword);
    }
    setCurrentPassword("");
    setNewPassword("");
    toast.success("Credentials updated");
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <h2 className="text-2xl font-semibold">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the look of the app</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p className="text-sm text-muted-foreground">
                  Switch to a darker color scheme
                </p>
              </div>
            </div>
            <Switch checked={darkMode} onCheckedChange={handleDarkMode} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Courses</CardTitle>
            <CardDescription>Manage courses and their duration</CardDescription>
          </div>
          <Button size="sm" onClick={() => openCourseDialog()}>
            <Plus data-icon="inline-start" />
            Add Course
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Duration (years)</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.duration_years}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openCourseDialog(c)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        onClick={() => setDeleteTarget({ type: "course", id: c.id })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Fee Types</CardTitle>
            <CardDescription>
              Default fee types auto-assigned to new students
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => openFeeDialog()}>
            <Plus data-icon="inline-start" />
            Add Fee Type
          </Button>
        </CardHeader>
        <CardContent>
          {feeTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fee types configured. Add fee types before adding students.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Default Amount</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeTypes.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell className="text-right">
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 0,
                      }).format(f.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openFeeDialog(f)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          onClick={() => setDeleteTarget({ type: "fee", id: f.id })}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
          <CardDescription>Change login email and password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCredentials} className="flex max-w-sm flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="settings-email">Email</Label>
              <Input
                id="settings-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="current-pw">Current Password *</Label>
              <Input
                id="current-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-pw">New Password (leave blank to keep)</Label>
              <Input
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="self-start">Save Credentials</Button>
          </form>
        </CardContent>
      </Card>

      {/* Course Dialog */}
      <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCourse ? "Edit Course" : "Add Course"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCourse} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Course Name</Label>
              <Input value={courseName} onChange={(e) => setCourseName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Duration (years)</Label>
              <Input
                type="number"
                min={1}
                value={courseDuration}
                onChange={(e) => setCourseDuration(e.target.value)}
                required
              />
            </div>
            <Button type="submit">{editCourse ? "Update" : "Add"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fee Type Dialog */}
      <Dialog open={feeDialog} onOpenChange={setFeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editFee ? "Edit Fee Type" : "Add Fee Type"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveFee} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Fee Name</Label>
              <Input value={feeName} onChange={(e) => setFeeName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Default Amount</Label>
              <Input
                type="number"
                min={0}
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                required
              />
            </div>
            <Button type="submit">{editFee ? "Update" : "Add"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === "course" ? "Course" : "Fee Type"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "course"
                ? "This will deactivate the course. Existing students won't be affected."
                : "This will remove the fee type and any unassigned fee records. Cannot delete if payments exist."}
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
