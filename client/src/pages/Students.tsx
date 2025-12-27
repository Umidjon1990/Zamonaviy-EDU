import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { translations } from "@/lib/i18n";
import { useStudents } from "@/lib/api";
import { Plus, Search, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export default function Students() {
  const { data: students, isLoading } = useStudents();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{translations.students.title}</h1>
        <Button className="w-full sm:w-auto" data-testid="button-add-student">
          <Plus className="mr-2 h-4 w-4" /> {translations.students.addStudent}
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={translations.common.search}
            className="pl-9 bg-background"
            data-testid="input-search-students"
          />
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>F.I.SH</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Ota-ona</TableHead>
                <TableHead>Balans</TableHead>
                <TableHead>Holat</TableHead>
                <TableHead className="text-right">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students && students.length > 0 ? (
                students.map((student: any) => (
                  <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                    <TableCell className="font-medium" data-testid={`text-name-${student.id}`}>
                      {student.firstName} {student.lastName}
                    </TableCell>
                    <TableCell data-testid={`text-phone-${student.id}`}>{student.phone}</TableCell>
                    <TableCell>{student.parentPhone}</TableCell>
                    <TableCell>
                      <span className={student.balance < 0 ? "text-destructive font-medium" : "text-emerald-600 font-medium"} data-testid={`text-balance-${student.id}`}>
                        {student.balance.toLocaleString()} UZS
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        student.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        student.status === "paused" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                        "bg-gray-50 text-gray-700 border-gray-200"
                      } data-testid={`badge-status-${student.id}`}>
                        {translations.students.status[student.status as keyof typeof translations.students.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${student.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>{translations.common.view}</DropdownMenuItem>
                          <DropdownMenuItem>{translations.common.edit}</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">{translations.common.delete}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Hozircha o'quvchilar yo'q. Yangi o'quvchi qo'shing.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
