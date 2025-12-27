import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { translations } from "@/lib/i18n";
import { mockGroups } from "@/lib/mockData";
import { Plus, Users, Clock, MapPin } from "lucide-react";

export default function Groups() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{translations.groups.title}</h1>
        <Button className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> {translations.groups.addGroup}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockGroups.map((group) => (
          <Card key={group.id} className="overflow-hidden hover:shadow-md transition-all group border-l-4 border-l-primary">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{group.subject}</p>
                  <CardTitle className="text-xl">{group.name}</CardTitle>
                </div>
                <Badge variant="secondary">{group.level}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-4 space-y-3">
              <div className="flex items-center text-sm text-muted-foreground">
                <Users className="mr-2 h-4 w-4 text-primary" />
                <span>{group.teacher}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Clock className="mr-2 h-4 w-4 text-primary" />
                <span>{group.days.join(", ")} • {group.time}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="mr-2 h-4 w-4 text-primary" />
                <span>{group.room}</span>
              </div>
              
              <div className="pt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>O‘quvchilar</span>
                  <span>{group.studentsCount} / {group.maxStudents}</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full" 
                    style={{ width: `${(group.studentsCount / group.maxStudents) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 p-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="w-full text-xs">Jadval</Button>
              <Button variant="outline" size="sm" className="w-full text-xs">Tahrirlash</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
