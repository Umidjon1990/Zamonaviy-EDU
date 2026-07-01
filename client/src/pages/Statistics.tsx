import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart2, Calendar, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const monthNames = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktyabr", "Noyabr", "Dekabr",
];

export default function Statistics() {
  const [statsGroupId, setStatsGroupId] = useState<number | null>(null);
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth() + 1);
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [sortBy, setSortBy] = useState<"absent" | "best" | "name">("absent");

  const { data: groupsData } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await fetch("/api/groups", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const groups = (Array.isArray(groupsData) ? groupsData : []) as any[];

  const { data: statsAttendanceRaw } = useQuery({
    queryKey: ["stats-attendance", statsGroupId, statsMonth, statsYear],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?groupId=${statsGroupId}&month=${statsMonth}&year=${statsYear}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!statsGroupId,
  });
  const statsAttendance = (Array.isArray(statsAttendanceRaw) ? statsAttendanceRaw : []) as any[];

  const { data: statsStudentsRaw } = useQuery({
    queryKey: ["stats-group-students", statsGroupId],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${statsGroupId}/students`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!statsGroupId,
  });
  const statsStudents = (Array.isArray(statsStudentsRaw) ? statsStudentsRaw : []) as any[];

  const getStudentStats = (studentId: number) => {
    const records = statsAttendance.filter((a: any) => a.studentId === studentId);
    const present = records.filter((a: any) => a.status === "present").length;
    const absent = records.filter((a: any) => a.status === "absent").length;
    const late = records.filter((a: any) => a.status === "late").length;
    const total = records.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { present, absent, late, total, rate };
  };

  const rankedStudents = [...statsStudents]
    .map((s: any) => ({ ...s, _stats: getStudentStats(s.id) }))
    .sort((a: any, b: any) => {
      if (sortBy === "absent") {
        return b._stats.absent - a._stats.absent || a._stats.rate - b._stats.rate;
      }
      if (sortBy === "best") {
        return b._stats.rate - a._stats.rate || a._stats.absent - b._stats.absent;
      }
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });

  const selectedGroupObj = groups.find((g: any) => g.id === statsGroupId);

  const generateAttendancePDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const monthLabel = monthNames[statsMonth - 1];

    doc.setFontSize(16);
    doc.text("Davomat statistikasi", 14, 16);
    doc.setFontSize(10);
    doc.text(`Guruh: ${selectedGroupObj?.name || ""}`, 14, 24);
    doc.text(`Oy: ${monthLabel} ${statsYear}`, 14, 30);

    const summaryData = rankedStudents.map((s: any, i: number) => {
      const st = s._stats;
      return [i + 1, `${s.firstName} ${s.lastName}`, st.present, st.absent, st.late, st.total, `${st.rate}%`];
    });

    autoTable(doc, {
      startY: 36,
      head: [["#", "O'quvchi", "Bor", "Yo'q", "Kech", "Jami", "%"]],
      body: summaryData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [102, 126, 234], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 255] },
    });

    const uniqueDates = Array.from(new Set(
      statsAttendance.map((a: any) => a.date?.toString().slice(0, 10))
    )).filter(Boolean).sort() as string[];

    if (uniqueDates.length > 0) {
      const cellStatus = (studentId: number, dateStr: string) => {
        const rec = statsAttendance.find(
          (a: any) => a.studentId === studentId && a.date?.toString().slice(0, 10) === dateStr
        );
        if (rec?.status === "present") return "B";
        if (rec?.status === "absent") return "Y";
        if (rec?.status === "late") return "K";
        return "-";
      };
      const dayHeaders = uniqueDates.map((d) => new Date(d + "T00:00:00").getDate().toString());
      const gridData = rankedStudents.map((s: any) => [
        `${s.firstName} ${s.lastName}`,
        ...uniqueDates.map((d) => cellStatus(s.id, d)),
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [["O'quvchi", ...dayHeaders]],
        body: gridData,
        styles: { fontSize: 7, halign: "center" },
        headStyles: { fillColor: [102, 126, 234], textColor: 255 },
        columnStyles: { 0: { halign: "left", cellWidth: 45 } },
      });
    }

    doc.save(`davomat-${selectedGroupObj?.name || "guruh"}-${monthLabel}-${statsYear}.pdf`);
  };

  return (
    <div className="space-y-6" data-testid="page-statistics">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Statistika</h1>
        <p className="text-muted-foreground">Oylik davomat statistikasi</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-end flex-wrap">
        <div className="space-y-2 w-full sm:w-auto">
          <Label className="text-muted-foreground text-sm">Guruh</Label>
          <Select value={statsGroupId?.toString() || ""} onValueChange={(v) => setStatsGroupId(parseInt(v))}>
            <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-stats-group">
              <SelectValue placeholder="Guruhni tanlang" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g: any) => (
                <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 w-full sm:w-auto">
          <Label className="text-muted-foreground text-sm">Oy</Label>
          <Select value={statsMonth.toString()} onValueChange={(v) => setStatsMonth(parseInt(v))}>
            <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-stats-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((m, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 w-full sm:w-auto">
          <Label className="text-muted-foreground text-sm">Yil</Label>
          <Select value={statsYear.toString()} onValueChange={(v) => setStatsYear(parseInt(v))}>
            <SelectTrigger className="w-full sm:w-[110px]" data-testid="select-stats-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2023, 2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 w-full sm:w-auto">
          <Label className="text-muted-foreground text-sm">Saralash</Label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as "absent" | "best" | "name")}>
            <SelectTrigger className="w-full sm:w-[190px]" data-testid="select-stats-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="absent">Eng ko'p qoldirganlar</SelectItem>
              <SelectItem value="best">Eng yaxshi davomat</SelectItem>
              <SelectItem value="name">Ism bo'yicha</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {statsGroupId && statsStudents.length > 0 && (
          <Button onClick={generateAttendancePDF} className="w-full sm:w-auto" data-testid="button-download-pdf">
            <FileDown className="w-4 h-4 mr-2" /> PDF yuklab olish
          </Button>
        )}
      </div>

      {statsGroupId ? (
        statsStudents.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {(() => {
                const totalPresent = rankedStudents.reduce((acc: number, s: any) => acc + s._stats.present, 0);
                const totalAbsent = rankedStudents.reduce((acc: number, s: any) => acc + s._stats.absent, 0);
                const totalLate = rankedStudents.reduce((acc: number, s: any) => acc + s._stats.late, 0);
                return (
                  <>
                    <Card className="border-l-4 border-l-green-500">
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-green-600" data-testid="text-total-present">{totalPresent}</p>
                        <p className="text-xs text-muted-foreground mt-1">Bor</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-red-500">
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-red-600" data-testid="text-total-absent">{totalAbsent}</p>
                        <p className="text-xs text-muted-foreground mt-1">Yo'q</p>
                      </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-amber-500">
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-amber-600" data-testid="text-total-late">{totalLate}</p>
                        <p className="text-xs text-muted-foreground mt-1">Kech</p>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>

            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-lg">
                  {selectedGroupObj?.name} — {monthNames[statsMonth - 1]} {statsYear}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {sortBy === "absent"
                    ? "Eng ko'p dars qoldirganlar yuqorida"
                    : sortBy === "best"
                    ? "Eng yaxshi davomat yuqorida"
                    : "Ism bo'yicha tartiblangan"}
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">#</TableHead>
                      <TableHead className="font-semibold">O'quvchi</TableHead>
                      <TableHead className="text-center font-semibold text-green-700">Bor</TableHead>
                      <TableHead className="text-center font-semibold text-red-700">Yo'q</TableHead>
                      <TableHead className="text-center font-semibold text-amber-700">Kech</TableHead>
                      <TableHead className="text-center font-semibold">Jami</TableHead>
                      <TableHead className="text-center font-semibold">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankedStudents.map((student: any, index: number) => {
                      const st = student._stats;
                      const rankColor = sortBy === "absent" && st.absent > 0
                        ? (index === 0 ? "bg-red-500 text-white" : index < 3 ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground")
                        : "bg-muted text-muted-foreground";
                      return (
                        <TableRow key={student.id} className="hover:bg-primary/5 transition-colors" data-testid={`row-stats-${student.id}`}>
                          <TableCell>
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${rankColor}`}>{index + 1}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-medium">
                                {student.firstName?.[0]}{student.lastName?.[0]}
                              </div>
                              <span className="font-medium">{student.firstName} {student.lastName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{st.present}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{st.absent}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{st.late}</Badge>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">{st.total}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <Progress value={st.rate} className="w-12 h-2" />
                              <span className={`text-sm font-semibold ${st.rate >= 80 ? "text-green-600" : st.rate >= 60 ? "text-amber-600" : "text-red-600"}`}>
                                {st.rate}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {(() => {
              const uniqueDates = Array.from(new Set(
                statsAttendance.map((a: any) => a.date?.toString().slice(0, 10))
              )).filter(Boolean).sort() as string[];

              if (uniqueDates.length === 0) return null;

              const shortDay = (dateStr: string) => new Date(dateStr + "T00:00:00").getDate().toString();
              const weekLetter = (dateStr: string) =>
                ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"][new Date(dateStr + "T00:00:00").getDay()];
              const cellStatus = (studentId: number, dateStr: string) => {
                const rec = statsAttendance.find(
                  (a: any) => a.studentId === studentId && a.date?.toString().slice(0, 10) === dateStr
                );
                return rec?.status || null;
              };

              return (
                <Card className="overflow-hidden">
                  <CardHeader className="border-b bg-muted/30">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      Kunlik davomat jadvali — {monthNames[statsMonth - 1]} {statsYear}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Jami {uniqueDates.length} ta dars kuni qayd etilgan
                    </p>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-max">
                      <thead>
                        <tr className="bg-muted/40">
                          <th className="text-left px-4 py-2 font-semibold sticky left-0 bg-muted/40 z-10 min-w-[160px] border-r border-border/40">
                            O'quvchi
                          </th>
                          {uniqueDates.map((d) => (
                            <th key={d} className="px-2 py-2 text-center font-medium text-muted-foreground min-w-[44px]">
                              <div className="text-xs text-muted-foreground/70">{weekLetter(d)}</div>
                              <div className="text-sm font-semibold">{shortDay(d)}</div>
                            </th>
                          ))}
                          <th className="px-3 py-2 text-center font-semibold border-l border-border/40 min-w-[60px]">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankedStudents.map((student: any, idx: number) => {
                          const st = student._stats;
                          return (
                            <tr key={student.id} className={idx % 2 === 0 ? "bg-white" : "bg-muted/10"}>
                              <td className={`px-4 py-2.5 sticky left-0 z-10 border-r border-border/40 ${idx % 2 === 0 ? "bg-white" : "bg-muted/10"}`}>
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-primary/80 flex items-center justify-center text-white text-xs font-medium shrink-0">
                                    {student.firstName?.[0]}{student.lastName?.[0]}
                                  </div>
                                  <span className="font-medium truncate max-w-[110px]">{student.firstName} {student.lastName}</span>
                                </div>
                              </td>
                              {uniqueDates.map((d) => {
                                const status = cellStatus(student.id, d);
                                return (
                                  <td key={d} className="px-2 py-2 text-center">
                                    {status === "present" ? (
                                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 text-xs font-bold" title="Bor">✓</span>
                                    ) : status === "absent" ? (
                                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-600 text-xs font-bold" title="Yo'q">✗</span>
                                    ) : status === "late" ? (
                                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-600 text-xs font-bold" title="Kech">⏰</span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center w-7 h-7 text-muted-foreground/30 text-xs">—</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2 text-center border-l border-border/40">
                                <span className={`text-xs font-bold ${st.rate >= 80 ? "text-green-600" : st.rate >= 60 ? "text-amber-600" : "text-red-600"}`}>
                                  {st.rate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="flex items-center gap-4 px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs">✓</span> Bor</div>
                      <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs">✗</span> Yo'q</div>
                      <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">⏰</span> Kech qoldi</div>
                      <div className="flex items-center gap-1.5"><span className="text-muted-foreground/40">—</span> Qayd etilmagan</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <BarChart2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">Bu guruhda o'quvchilar yoki davomat ma'lumotlari yo'q</p>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <BarChart2 className="w-8 h-8 text-primary" />
            </div>
            <p className="text-muted-foreground">Statistikani ko'rish uchun guruh tanlang</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
