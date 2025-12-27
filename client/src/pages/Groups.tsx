import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { translations } from "@/lib/i18n";
import { useGroups } from "@/lib/api";
import { Plus, Users, Clock, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Groups() {
  const { data: groups, isLoading } = useGroups();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{translations.groups.title}</h1>
        <Button className="w-full sm:w-auto" data-testid="button-add-group">
          <Plus className="mr-2 h-4 w-4" /> {translations.groups.addGroup}
        </Button>
      </div>

      {groups && groups.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group: any) => (
            <Card key={group.id} className="overflow-hidden hover:shadow-md transition-all group border-l-4 border-l-primary" data-testid={`card-group-${group.id}`}>
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Guruh</p>
                    <CardTitle className="text-xl" data-testid={`text-name-${group.id}`}>{group.name}</CardTitle>
                  </div>
                  <Badge variant="secondary">{group.level}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-4 space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Users className="mr-2 h-4 w-4 text-primary" />
                  <span>O'qituvchi ID: {group.teacherId}</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="mr-2 h-4 w-4 text-primary" />
                  <span>{group.days.join(", ")} • {group.time}</span>
                </div>
                {group.room && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="mr-2 h-4 w-4 text-primary" />
                    <span>{group.room}</span>
                  </div>
                )}
                
                <div className="pt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Sig'im</span>
                    <span>0 / {group.maxStudents}</span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{ width: `0%` }}
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
      ) : (
        <Card className="shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            Hozircha guruhlar yo'q. Yangi guruh qo'shing.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
