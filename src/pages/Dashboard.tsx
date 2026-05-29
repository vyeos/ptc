import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboardStats, getPendingFeeStudents, type DashboardStats } from "@/lib/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, IndianRupee, AlertTriangle } from "lucide-react";
import { StudentActions } from "@/components/StudentActions";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof getPendingFeeStudents>>>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [s, p] = await Promise.all([getDashboardStats(), getPendingFeeStudents()]);
    setStats(s);
    setPending(p);
  }

  if (!stats) return <div className="flex items-center justify-center p-8">Loading...</div>;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Dashboard</h2>
        <StudentActions onDataChange={load} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Active Students</CardDescription>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActiveStudents}</div>
            <p className="text-xs text-muted-foreground">
              Year 1: {stats.year1Students} &middot; Year 2: {stats.year2Students}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Fee Expected</CardDescription>
            <IndianRupee className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalFeeExpected)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Collected</CardDescription>
            <IndianRupee className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatCurrency(stats.totalCollected)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total Pending</CardDescription>
            <AlertTriangle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(stats.totalPending)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Students with Pending Fees</CardTitle>
          <CardDescription>Sorted by highest pending amount</CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending fees</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Total Fee</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((s) => (
                  <TableRow
                    key={s.student_id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/students/${s.student_id}`)}
                  >
                    <TableCell>{s.student_name}</TableCell>
                    <TableCell>{s.course_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Year {s.current_year}</Badge>
                    </TableCell>
                    <TableCell>{s.batch_year}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.total_fee)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.total_paid)}</TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      {formatCurrency(s.pending)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
