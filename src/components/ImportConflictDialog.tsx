import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { ImportConflict } from "@/lib/import-csv";

interface Props {
  conflicts: ImportConflict[];
  open: boolean;
  onResolve: (resolutions: Map<number, "import" | "local">) => void;
  onCancel: () => void;
}

const fieldLabels: Record<string, string> = {
  parent: "Parent Name",
  gender: "Gender",
  course: "Course",
  "enrollment date": "Enrollment Date",
};

export function ImportConflictDialog({ conflicts, open, onResolve, onCancel }: Props) {
  const [resolutions, setResolutions] = useState<Map<number, "import" | "local">>(() => new Map());

  const setAll = (choice: "import" | "local") => {
    const m = new Map<number, "import" | "local">();
    for (const c of conflicts) {
      m.set(c.existingStudent.id, choice);
    }
    setResolutions(m);
  };

  const setOne = (id: number, choice: "import" | "local") => {
    setResolutions((prev) => {
      const m = new Map(prev);
      m.set(id, choice);
      return m;
    });
  };

  const allResolved = conflicts.every((c) => resolutions.has(c.existingStudent.id));

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-IN");
    } catch {
      return d;
    }
  };

  const getValue = (field: string, data: { parent_name: string | null; gender: string | null; course_name: string; enrollment_date: string }) => {
    switch (field) {
      case "parent": return data.parent_name || "—";
      case "gender": return data.gender || "—";
      case "course": return data.course_name;
      case "enrollment date": return formatDate(data.enrollment_date);
      default: return "—";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Import Conflicts ({conflicts.length})
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {conflicts.length} student{conflicts.length > 1 ? "s" : ""} already exist with different data.
          Choose which version to keep for each.
        </p>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAll("import")}>
            Prefer All Imported
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAll("local")}>
            Prefer All Local
          </Button>
        </div>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="flex flex-col gap-4">
            {conflicts.map((conflict) => {
              const choice = resolutions.get(conflict.existingStudent.id);
              return (
                <div
                  key={conflict.existingStudent.id}
                  className="rounded-lg border p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{conflict.existingStudent.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        Row {conflict.rowIndex}
                      </Badge>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant={choice === "local" ? "default" : "outline"}
                        onClick={() => setOne(conflict.existingStudent.id, "local")}
                      >
                        Keep Local
                      </Button>
                      <Button
                        size="sm"
                        variant={choice === "import" ? "default" : "outline"}
                        onClick={() => setOne(conflict.existingStudent.id, "import")}
                      >
                        Use Import
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr_1fr_1fr] gap-x-3 text-sm">
                    <div className="font-medium text-muted-foreground">Field</div>
                    <div className="font-medium text-muted-foreground">Local</div>
                    <div className="font-medium text-muted-foreground">Imported</div>
                    <Separator className="col-span-3 my-1" />
                    {conflict.fields.map((field) => (
                      <div key={field} className="contents">
                        <div className="py-1">{fieldLabels[field] || field}</div>
                        <div
                          className={`py-1 ${choice === "local" ? "font-medium" : "text-muted-foreground"}`}
                        >
                          {getValue(field, conflict.existingStudent)}
                        </div>
                        <div
                          className={`py-1 ${choice === "import" ? "font-medium" : "text-muted-foreground"}`}
                        >
                          {getValue(field, conflict.imported)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel Import
          </Button>
          <Button disabled={!allResolved} onClick={() => onResolve(resolutions)}>
            Apply ({conflicts.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
