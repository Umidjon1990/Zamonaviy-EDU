import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { translations } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Clock, Users } from "lucide-react";

export default function Schedule() {
  const days = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  const times = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

  const { data: groupsData, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await fetch("/api/groups", { credentials: "include" });
      return res.json();
    },
  });
  const groups = (groupsData || []) as any[];

  const parseTime = (timeStr: string) => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:00`;
    }
    return null;
  };

  const getClassesForSlot = (time: string, dayName: string) => {
    return groups.filter((group: any) => {
      if (!group.days || !group.time) return false;
      
      const groupDays = Array.isArray(group.days) ? group.days : [];
      const hasDay = groupDays.some((d: string) => 
        d.toLowerCase() === dayName.toLowerCase()
      );
      
      if (!hasDay) return false;
      
      const groupStartTime = parseTime(group.time);
      return groupStartTime === time;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{translations.nav.schedule}</h1>
        <Badge variant="outline" className="w-fit">
          <Users className="w-4 h-4 mr-1" />
          {groups.length} ta guruh
        </Badge>
      </div>

      <Card className="shadow-sm overflow-x-auto">
        <CardHeader>
          <CardTitle>Haftalik dars jadvali</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="min-w-[900px]">
            <div className="grid grid-cols-7 border-b">
              <div className="p-4 font-medium text-muted-foreground border-r bg-muted/30">
                <Clock className="w-4 h-4 inline mr-1" /> Vaqt
              </div>
              {days.map(day => (
                <div key={day} className="p-4 font-medium text-center border-r last:border-r-0 bg-muted/10">
                  {day}
                </div>
              ))}
            </div>
            
            {times.map((time) => (
              <div key={time} className="grid grid-cols-7 border-b last:border-b-0">
                <div className="p-3 text-sm font-medium text-muted-foreground border-r bg-muted/5 flex items-center justify-center">
                  {time}
                </div>
                {days.map((dayName, index) => {
                  const slotGroups = getClassesForSlot(time, dayName);
                  return (
                    <div key={index} className="p-1 border-r last:border-r-0 min-h-[70px] relative group transition-colors hover:bg-muted/5">
                      {slotGroups.map((g: any) => (
                        <div 
                          key={g.id}
                          className="w-full mb-1 bg-primary/10 border-l-2 border-primary rounded-sm p-2 flex flex-col justify-center gap-0.5 cursor-pointer hover:bg-primary/20 transition-colors"
                          data-testid={`schedule-slot-${g.id}`}
                        >
                          <span className="text-xs font-bold text-primary truncate">{g.name}</span>
                          <span className="text-[10px] text-muted-foreground">{g.time}</span>
                          {g.room && <span className="text-[10px] text-primary/70">{g.room}</span>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {groups.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            Hozircha guruhlar yo'q. Guruhlar qo'shilganda jadvalda ko'rinadi.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
