import { useState, useEffect } from "react";
import { getCourses, type Course } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface StudentFormData {
  name: string;
  parent_name: string;
  gender: string;
  course_id: number;
  enrollment_date: string;
}

interface Props {
  initial?: StudentFormData;
  onSubmit: (data: StudentFormData) => Promise<void>;
  onCancel: () => void;
}

export function StudentForm({ initial, onSubmit, onCancel }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState<StudentFormData>(
    initial ?? {
      name: "",
      parent_name: "",
      gender: "",
      course_id: 0,
      enrollment_date: new Date().toISOString().split("T")[0],
    },
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCourses().then((c) => {
      setCourses(c);
      if (!initial && c.length > 0 && form.course_id === 0) {
        setForm((f) => ({ ...f, course_id: c[0].id }));
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="parent_name">Parent Name</Label>
        <Input
          id="parent_name"
          value={form.parent_name}
          onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="gender">Gender</Label>
        <Select
          value={form.gender}
          onValueChange={(v) => setForm({ ...form, gender: v })}
        >
          <SelectTrigger >
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="course">Course</Label>
        <Select
          value={form.course_id ? String(form.course_id) : ""}
          onValueChange={(v) => setForm({ ...form, course_id: Number(v) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name} ({c.duration_years} yr)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="enrollment_date">Enrollment Date *</Label>
        <Input
          id="enrollment_date"
          type="date"
          value={form.enrollment_date}
          onChange={(e) =>
            setForm({ ...form, enrollment_date: e.target.value })
          }
          required
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? "Saving..." : initial ? "Update" : "Add Student"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
