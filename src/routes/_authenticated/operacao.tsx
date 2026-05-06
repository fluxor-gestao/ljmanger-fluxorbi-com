import { useState } from "react";
import { useNavigate, useParams, Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Settings2 } from "lucide-react";

const serviceStatusColors: Record<string, string> = {
  a_iniciar: "bg-accent/30 text-accent-foreground border-accent/40",
  pendente: "bg-warning/20 text-warning border-warning/30",
  em_andamento: "bg-primary/20 text-primary border-primary/30",
  concluido: "bg-success/20 text-success border-success/30",
  cancelado: "bg-destructive/20 text-destructive border-destructive/30",
};

const statusLabels: Record<string, string> = {
  a_iniciar: "A iniciar",
  pendente: "Pendente",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function Operacao() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", business_unit: "", start_date: "", expected_end_date: "" });

  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: async () => { const { data } = await supabase.from("services").select("*").order("created_at", { ascending: false }); return data ?? []; },
  });

  const createService = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("services").insert({
        ...form,
        start_date: form.start_date || null,
        expected_end_date: form.expected_end_date || null,
        assigned_to: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Serviço criado!"); queryClient.invalidateQueries({ queryKey: ["services"] }); setDialogOpen(false); setForm({ title: "", description: "", business_unit: "", start_date: "", expected_end_date: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "concluido") updates.actual_end_date = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("services").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado!"); queryClient.invalidateQueries({ queryKey: ["services"] }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Operação</h1>
          <p className="text-muted-foreground mt-1">Serviços e processos operacionais</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Serviço</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Serviço</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Input placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Input placeholder="Negócio" value={form.business_unit} onChange={(e) => setForm({ ...form, business_unit: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Início</label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><label className="text-xs text-muted-foreground">Previsão</label><Input type="date" value={form.expected_end_date} onChange={(e) => setForm({ ...form, expected_end_date: e.target.value })} /></div>
              </div>
              <Button className="w-full" onClick={() => createService.mutate()} disabled={!form.title}>Salvar</Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {(["pendente", "em_andamento", "concluido", "cancelado"] as const).map((s) => (
          <Card key={s}><CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold font-display">{services.filter((sv) => sv.status === s).length}</p>
            <p className="text-xs text-muted-foreground">{statusLabels[s]}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead><TableHead>Negócio</TableHead><TableHead>Setor</TableHead><TableHead>Início</TableHead><TableHead>Previsão</TableHead><TableHead>Conclusão</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum serviço cadastrado</TableCell></TableRow>
            ) : services.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.title}</TableCell>
                <TableCell>{s.business_unit}</TableCell>
                <TableCell>{(s as any).responsible_sector || "—"}</TableCell>
                <TableCell>{s.start_date}</TableCell>
                <TableCell>{s.expected_end_date}</TableCell>
                <TableCell>{s.actual_end_date}</TableCell>
                <TableCell><Badge variant="outline" className={serviceStatusColors[s.status] || ""}>{statusLabels[s.status] || s.status}</Badge></TableCell>
                <TableCell>
                  <Select value="" onValueChange={(v) => updateStatus.mutate({ id: s.id, status: v })}>
                    <SelectTrigger className="w-36 h-8"><SelectValue placeholder="Alterar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_iniciar">A iniciar</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/operacao")({
  component: Operacao,
});
