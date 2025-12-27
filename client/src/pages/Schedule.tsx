import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { translations } from "@/lib/i18n";
import { mockSchedule } from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";

export default function Schedule() {
  const days = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  const times = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

  // Simple helper to find if a class exists at this time/day
  // In a real app, this would be more complex date logic
  const getClass = (time: string, dayIndex: number) => {
    // This is just a visual mock based on the simple mockSchedule structure
    // We'll map the simple mock data to this grid
    const scheduleRow = mockSchedule.find(s => s.time === time);
    if (!scheduleRow) return null;

    const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat"];
    const groupName = scheduleRow[dayKeys[dayIndex] as keyof typeof scheduleRow];
    
    return groupName ? groupName : null;
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{translations.nav.schedule}</h1>
      </div>

      <Card className="shadow-sm overflow-x-auto">
        <CardHeader>
          <CardTitle>Haftalik dars jadvali</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="min-w-[800px]">
            <div className="grid grid-cols-7 border-b">
              <div className="p-4 font-medium text-muted-foreground border-r bg-muted/30">Vaqt</div>
              {days.map(day => (
                <div key={day} className="p-4 font-medium text-center border-r last:border-r-0 bg-muted/10">
                  {day}
                </div>
              ))}
            </div>
            
            {times.map((time) => (
              <div key={time} className="grid grid-cols-7 border-b last:border-b-0">
                <div className="p-4 text-sm font-medium text-muted-foreground border-r bg-muted/5 flex items-center justify-center">
                  {time}
                </div>
                {days.map((_, index) => {
                  const group = getClass(time, index);
                  return (
                    <div key={index} className="p-2 border-r last:border-r-0 min-h-[80px] relative group transition-colors hover:bg-muted/5">
                      {group && (
                        <div className="w-full h-full bg-primary/10 border-l-2 border-primary rounded-sm p-2 flex flex-col justify-center gap-1 cursor-pointer hover:bg-primary/20 transition-colors">
                          <span className="text-xs font-bold text-primary">{group}</span>
                          <span className="text-[10px] text-primary/80">Xona 2</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
