import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { translations } from "@/lib/i18n";
import { useLeads } from "@/lib/api";
import { Plus, Search, Phone, MessageCircle, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Leads() {
  const { data: leads, isLoading } = useLeads();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200";
      case "contacted": return "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200";
      case "trial": return "bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200";
      case "converted": return "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200";
      case "lost": return "bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200";
      default: return "bg-gray-100 text-gray-700";
    }
  };

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
        <h1 className="text-3xl font-bold tracking-tight">{translations.leads.title}</h1>
        <Button className="w-full sm:w-auto" data-testid="button-add-lead">
          <Plus className="mr-2 h-4 w-4" /> {translations.leads.addLead}
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={translations.common.search}
            className="pl-9 bg-background"
            data-testid="input-search-leads"
          />
        </div>
      </div>

      {/* Desktop View */}
      <Card className="hidden md:block shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translations.leads.columns.name}</TableHead>
                <TableHead>{translations.leads.columns.phone}</TableHead>
                <TableHead>{translations.leads.columns.source}</TableHead>
                <TableHead>{translations.leads.columns.interest}</TableHead>
                <TableHead>{translations.common.status}</TableHead>
                <TableHead>{translations.leads.columns.date}</TableHead>
                <TableHead className="text-right">{translations.common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads && leads.length > 0 ? (
                leads.map((lead: any) => (
                  <TableRow key={lead.id} data-testid={`row-lead-${lead.id}`}>
                    <TableCell className="font-medium" data-testid={`text-name-${lead.id}`}>
                      {lead.firstName} {lead.lastName}
                    </TableCell>
                    <TableCell data-testid={`text-phone-${lead.id}`}>{lead.phone}</TableCell>
                    <TableCell>{lead.source}</TableCell>
                    <TableCell>{lead.interest}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(lead.status)}>
                        {translations.leads.status[lead.status as keyof typeof translations.leads.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(lead.createdAt).toLocaleDateString('uz-UZ')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" data-testid={`button-call-${lead.id}`}>
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" data-testid={`button-message-${lead.id}`}>
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Hozircha lidlar yo'q. Yangi lid qo'shing.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {leads && leads.length > 0 ? (
          leads.map((lead: any) => (
            <Card key={lead.id} className="shadow-sm" data-testid={`card-lead-${lead.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-lg">{lead.firstName} {lead.lastName}</h3>
                    <div className="flex items-center text-sm text-muted-foreground mt-1">
                      <Phone className="h-3 w-3 mr-1" />
                      {lead.phone}
                    </div>
                  </div>
                  <Badge variant="outline" className={getStatusColor(lead.status)}>
                    {translations.leads.status[lead.status as keyof typeof translations.leads.status]}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Qiziqish</p>
                    <p className="font-medium">{lead.interest}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Manba</p>
                    <p className="font-medium">{lead.source}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t mt-2">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(lead.createdAt).toLocaleDateString('uz-UZ')}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-green-600 border-green-200 bg-green-50">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-blue-600 border-blue-200 bg-blue-50">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="shadow-sm">
            <CardContent className="p-8 text-center text-muted-foreground">
              Hozircha lidlar yo'q. Yangi lid qo'shing.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
