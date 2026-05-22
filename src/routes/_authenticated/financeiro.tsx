import { useState, useMemo } from "react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Search, Download, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight,
  ArrowLeft, Wallet, TrendingUp, CheckCircle2, CircleDashed,
} from "lucide-react";
import * as XLSX from "xlsx";
import { FxTicker } from "@/components/financeiro/FxTicker";

const statusColors: Record<string, string> = {
  pendente: "bg-warning/15 text-warning border-warning/30",
  conciliado: "bg-success/15 text-success border-success/30",
  divergente: "bg-destructive/15 text-destructive border-destructive/30",
  ignorado: "bg-muted text-muted-foreground border-border",
};

const typeBadge = (type: string | null | undefined) => {
  if (type === "transferencia") return "bg-primary/15 text-primary border-primary/30";
  if (type === "receita") return "bg-success/15 text-success border-success/30";
  if (type === "despesa") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-muted text-muted-foreground border-border";
};

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

type Entry = {
  id: string;
  entry_date: string;
  competence_month: string | null;
  business_unit: string | null;
  movement_account: string | null;
  movement_description: string | null;
  counterparty_name: string | null;
  amount_in: number | null;
  amount_out: number | null;
  entry_type: string | null;
  source_type: string;
  conciliation_status: string;
  document_reference: string | null;
  bank_account_id: string | null;
  transfer_pair_id: string | null;
  currency: string;
  exchange_rate: number;
  original_amount: number | null;
  total_brl: number | null;
  fx_status: string | null;
};

type BankAccount = {
  id: string;
  bank_name: string;
  account_number: string | null;
  agency: string | null;
};

function getOrigem(e: Entry): "comercial" | "manual" | "ofx" | "transferência" {
  if (e.entry_type === "transferencia") return "transferência";
  if (e.source_type === "ofx" || e.source_type === "extrato") return "ofx";
  if (e.document_reference) return "comercial";
  return "manual";
}

function isPrevisto(e: Entry) {
  return e.conciliation_status === "pendente";
}

function Financeiro() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ---------- Filtros ----------
  const [search, setSearch] = useState("");
  const [competence, setCompetence] = useState<string>("");
  const [businessFilter, setBusinessFilter] = useState<string>("");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [realizedFilter, setRealizedFilter] = useState<string>("all");

  const [tab, setTab] = useState<"consolidado" | "previsoes" | "realizados" | "fluxo" | "analitico">(
    "consolidado",
  );

  // ---------- Dialog Novo Lançamento ----------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    entry_date: "", competence_month: "", business_unit: "", movement_account: "",
    movement_description: "", counterparty_name: "", amount_in: "", amount_out: "",
    entry_type: "receita", bank_account_id: "",
  });

  // ---------- Dados ----------
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["financial-entries", competence, businessFilter, search],
    queryFn: async () => {
      let q = supabase
        .from("financial_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .limit(500);
      if (competence) q = q.eq("competence_month", competence);
      if (businessFilter) q = q.eq("business_unit", businessFilter);
      if (search)
        q = q.or(
          `movement_description.ilike.%${search}%,counterparty_name.ilike.%${search}%`,
        );
      const { data } = await q;
      return (data ?? []) as Entry[];
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_accounts")
        .select("id, bank_name, account_number, agency")
        .eq("active", true)
        .order("bank_name");
      return (data ?? []) as BankAccount[];
    },
  });

  const bankMap = useMemo(() => {
    const m = new Map<string, BankAccount>();
    bankAccounts.forEach((b) => m.set(b.id, b));
    return m;
  }, [bankAccounts]);

  const bankLabel = (id: string | null) => {
    if (!id) return "—";
    const b = bankMap.get(id);
    if (!b) return "—";
    return `${b.bank_name}${b.account_number ? ` · ${b.account_number}` : ""}`;
  };

  // ---------- Aplica filtros locais ----------
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (bankFilter !== "all" && e.bank_account_id !== bankFilter) return false;
      if (typeFilter !== "all" && (e.entry_type ?? "") !== typeFilter) return false;
      if (statusFilter !== "all" && e.conciliation_status !== statusFilter) return false;
      if (originFilter !== "all" && getOrigem(e) !== originFilter) return false;
      if (realizedFilter === "previsto" && !isPrevisto(e)) return false;
      if (realizedFilter === "realizado" && isPrevisto(e)) return false;
      return true;
    });
  }, [entries, bankFilter, typeFilter, statusFilter, originFilter, realizedFilter]);

  // ---------- Visíveis por tab ----------
  const visible = useMemo(() => {
    if (tab === "previsoes") return filtered.filter(isPrevisto);
    if (tab === "realizados") return filtered.filter((e) => !isPrevisto(e));
    return filtered;
  }, [filtered, tab]);

  // ---------- Métricas dos cards ----------
  const metrics = useMemo(() => {
    const realized = filtered.filter((e) => !isPrevisto(e) && e.entry_type !== "transferencia");
    const totalIn = realized.reduce((s, e) => s + Number(e.amount_in || 0), 0);
    const totalOut = realized.reduce((s, e) => s + Number(e.amount_out || 0), 0);
    const transfers = filtered
      .filter((e) => e.entry_type === "transferencia")
      .reduce((s, e) => s + Number(e.amount_in || 0) + Number(e.amount_out || 0), 0);
    const previstoIn = filtered
      .filter((e) => isPrevisto(e) && e.entry_type !== "transferencia")
      .reduce((s, e) => s + Number(e.amount_in || 0), 0);
    return {
      saldoInicial: 0, // placeholder — pode evoluir com tabela de saldos
      totalIn,
      totalOut,
      transfers,
      saldoFinal: totalIn - totalOut,
      disponivel: totalIn - totalOut + previstoIn * 0,
      previstoIn,
    };
  }, [filtered]);

  // ---------- Novo lançamento ----------
  const createEntry = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("financial_entries").insert({
        entry_date: form.entry_date,
        competence_month: form.competence_month || null,
        business_unit: form.business_unit || null,
        movement_account: form.movement_account || null,
        movement_description: form.movement_description,
        counterparty_name: form.counterparty_name || null,
        amount_in: Number(form.amount_in) || 0,
        amount_out: Number(form.amount_out) || 0,
        entry_type: form.entry_type as any,
        bank_account_id: form.bank_account_id || null,
        source_type: "manual" as const,
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento criado!");
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      setDialogOpen(false);
      setForm({
        entry_date: "", competence_month: "", business_unit: "", movement_account: "",
        movement_description: "", counterparty_name: "", amount_in: "", amount_out: "",
        entry_type: "receita", bank_account_id: "",
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportXLSX = () => {
    const headers = [
      "Data", "Competência", "Negócio", "Banco/Conta", "Tipo", "Origem",
      "Conta Mov.", "Descrição", "Fornecedor/Cliente",
      "Entrada", "Saída", "Status", "Previsto/Realizado",
    ];
    const rows = visible.map((e) => [
      e.entry_date,
      e.competence_month,
      e.business_unit,
      bankLabel(e.bank_account_id),
      e.entry_type ?? "",
      getOrigem(e),
      e.movement_account,
      e.movement_description,
      e.counterparty_name,
      Number(e.amount_in || 0),
      Number(e.amount_out || 0),
      e.conciliation_status,
      isPrevisto(e) ? "Previsto" : "Realizado",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentação");
    XLSX.writeFile(wb, "movimentacao_financeira.xlsx");
  };

  // ---------- Agrupamento por banco (Fluxo) ----------
  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    visible.forEach((e) => {
      const k = e.bank_account_id ?? "__none__";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    });
    return Array.from(map.entries());
  }, [visible]);

  // ---------- Receitas x Despesas (analítico por competência) ----------
  const analitico = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>();
    filtered
      .filter((e) => e.entry_type !== "transferencia")
      .forEach((e) => {
        const k = e.competence_month ?? "—";
        if (!map.has(k)) map.set(k, { in: 0, out: 0 });
        const acc = map.get(k)!;
        acc.in += Number(e.amount_in || 0);
        acc.out += Number(e.amount_out || 0);
      });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // ---------- Render ----------
  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Central Financeira</h1>
          <p className="text-muted-foreground mt-1">
            Esteira: Comercial → Previsão → Conciliação → Realizado
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <Card
            role="button"
            tabIndex={0}
            onClick={() => navigate({ to: "/conciliacao" })}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") navigate({ to: "/conciliacao" });
            }}
            className="group w-full sm:w-[260px] cursor-pointer border-0 bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                <ArrowLeftRight className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-base font-semibold leading-tight">Conciliação</p>
                <p className="truncate text-xs text-primary-foreground/80">
                  Conferir cobranças e pagamentos
                </p>
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportXLSX}>
              <Download className="h-4 w-4 mr-2" /> Exportar XLSX
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Novo Lançamento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Lançamento</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    type="date"
                    value={form.entry_date}
                    onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                  />
                  <Input
                    placeholder="Competência (ex: 2025-03)"
                    value={form.competence_month}
                    onChange={(e) => setForm({ ...form, competence_month: e.target.value })}
                  />
                  <Select
                    value={form.entry_type}
                    onValueChange={(v) => setForm({ ...form, entry_type: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="transferencia">Transferência interna</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={form.bank_account_id || "__none__"}
                    onValueChange={(v) => setForm({ ...form, bank_account_id: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Banco / Conta" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem banco (previsto)</SelectItem>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.bank_name}{b.account_number ? ` · ${b.account_number}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Negócio"
                    value={form.business_unit}
                    onChange={(e) => setForm({ ...form, business_unit: e.target.value })}
                  />
                  <Input
                    placeholder="Conta Movimentação"
                    value={form.movement_account}
                    onChange={(e) => setForm({ ...form, movement_account: e.target.value })}
                  />
                  <Input
                    placeholder="Descrição"
                    value={form.movement_description}
                    onChange={(e) => setForm({ ...form, movement_description: e.target.value })}
                  />
                  <Input
                    placeholder="Fornecedor/Cliente"
                    value={form.counterparty_name}
                    onChange={(e) => setForm({ ...form, counterparty_name: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      placeholder="Entrada (R$)"
                      value={form.amount_in}
                      onChange={(e) => setForm({ ...form, amount_in: e.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Saída (R$)"
                      value={form.amount_out}
                      onChange={(e) => setForm({ ...form, amount_out: e.target.value })}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createEntry.mutate()}
                    disabled={!form.entry_date}
                  >
                    Salvar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Cards superiores — 6 indicadores */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <SummaryCard icon={<Wallet className="h-5 w-5 text-muted-foreground" />} label="Saldo Inicial" value={fmt(metrics.saldoInicial)} />
        <SummaryCard icon={<ArrowDownCircle className="h-5 w-5 text-success" />} label="Total Receitas" value={fmt(metrics.totalIn)} />
        <SummaryCard icon={<ArrowUpCircle className="h-5 w-5 text-destructive" />} label="Total Despesas" value={fmt(metrics.totalOut)} />
        <SummaryCard icon={<ArrowLeftRight className="h-5 w-5 text-primary" />} label="Transferências" value={fmt(metrics.transfers)} />
        <SummaryCard icon={<TrendingUp className="h-5 w-5 text-primary" />} label="Saldo Final" value={fmt(metrics.saldoFinal)} highlight />
        <SummaryCard icon={<CheckCircle2 className="h-5 w-5 text-success" />} label="Disponível Atual" value={fmt(metrics.disponivel)} />
      </div>

      {/* Ticker de cotações */}
      <FxTicker />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar descrição ou fornecedor..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Input
          placeholder="Competência (YYYY-MM)"
          className="w-44"
          value={competence}
          onChange={(e) => setCompetence(e.target.value)}
        />
        <Input
          placeholder="Negócio"
          className="w-36"
          value={businessFilter}
          onChange={(e) => setBusinessFilter(e.target.value)}
        />
        <Select value={bankFilter} onValueChange={setBankFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Banco" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os bancos</SelectItem>
            {bankAccounts.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="receita">Receita</SelectItem>
            <SelectItem value="despesa">Despesa</SelectItem>
            <SelectItem value="transferencia">Transferência</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="conciliado">Conciliado</SelectItem>
            <SelectItem value="divergente">Divergente</SelectItem>
            <SelectItem value="ignorado">Ignorado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            <SelectItem value="comercial">Comercial</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="ofx">OFX</SelectItem>
            <SelectItem value="transferência">Transferência</SelectItem>
          </SelectContent>
        </Select>
        <Select value={realizedFilter} onValueChange={setRealizedFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Previsto/Realizado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Previsto + Realizado</SelectItem>
            <SelectItem value="previsto">Apenas previstos</SelectItem>
            <SelectItem value="realizado">Apenas realizados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
        <TabsList>
          <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
          <TabsTrigger value="previsoes">Previsões</TabsTrigger>
          <TabsTrigger value="realizados">Realizados</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo Bancário</TabsTrigger>
          <TabsTrigger value="analitico">Receitas × Despesas</TabsTrigger>
        </TabsList>

        <TabsContent value="consolidado" className="mt-4">
          <EntriesTable rows={visible} bankLabel={bankLabel} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="previsoes" className="mt-4">
          <EntriesTable rows={visible} bankLabel={bankLabel} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="realizados" className="mt-4">
          <EntriesTable rows={visible} bankLabel={bankLabel} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="fluxo" className="mt-4 space-y-4">
          {grouped.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum lançamento</CardContent></Card>
          ) : grouped.map(([key, list]) => {
            const subIn = list.reduce((s, e) => s + Number(e.amount_in || 0), 0);
            const subOut = list.reduce((s, e) => s + Number(e.amount_out || 0), 0);
            return (
              <Card key={key} className="overflow-hidden">
                <div className="flex items-center justify-between bg-muted/40 px-4 py-2 border-b">
                  <div className="font-display font-semibold">
                    {key === "__none__" ? "Sem banco vinculado (previsões)" : bankLabel(key)}
                  </div>
                  <div className="flex gap-4 text-sm tabular-nums">
                    <span className="text-success">+ {fmt(subIn)}</span>
                    <span className="text-destructive">− {fmt(subOut)}</span>
                    <span className="font-semibold">{fmt(subIn - subOut)}</span>
                  </div>
                </div>
                <EntriesTable rows={list} bankLabel={bankLabel} isLoading={false} hideBank />
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="analitico" className="mt-4">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-right">Receitas</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analitico.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem dados</TableCell></TableRow>
                ) : analitico.map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell className="font-medium">{k}</TableCell>
                    <TableCell className="text-right text-success tabular-nums">{fmt(v.in)}</TableCell>
                    <TableCell className="text-right text-destructive tabular-nums">{fmt(v.out)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmt(v.in - v.out)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rodapé fixo */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-[var(--sidebar-width,16rem)] bg-card border-t px-6 py-3 z-40">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CircleDashed className="h-4 w-4" />
            <span>{visible.length} lançamento(s) na visão atual</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 tabular-nums">
            <span><span className="text-muted-foreground">Entradas:</span> <span className="font-semibold text-success">{fmt(metrics.totalIn)}</span></span>
            <span><span className="text-muted-foreground">Saídas:</span> <span className="font-semibold text-destructive">{fmt(metrics.totalOut)}</span></span>
            <span><span className="text-muted-foreground">Transferências:</span> <span className="font-semibold text-primary">{fmt(metrics.transfers)}</span></span>
            <span><span className="text-muted-foreground">Saldo Final:</span> <span className="font-bold">{fmt(metrics.saldoFinal)}</span></span>
            
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Subcomponents -----

function SummaryCard({
  icon, label, value, highlight,
}: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40" : ""}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-lg font-bold font-display tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function EntriesTable({
  rows, bankLabel, isLoading, hideBank,
}: {
  rows: Entry[];
  bankLabel: (id: string | null) => string;
  isLoading: boolean;
  hideBank?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="font-semibold">Data</TableHead>
            <TableHead className="font-semibold">Negócio</TableHead>
            {!hideBank && <TableHead className="font-semibold">Banco/Conta</TableHead>}
            <TableHead className="font-semibold">Tipo</TableHead>
            <TableHead className="font-semibold">Origem</TableHead>
            <TableHead className="font-semibold">Descrição</TableHead>
            <TableHead className="font-semibold">Fornecedor/Cliente</TableHead>
            <TableHead className="font-semibold text-right">Entrada</TableHead>
            <TableHead className="font-semibold text-right">Saída</TableHead>
            <TableHead className="font-semibold">P/R</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={hideBank ? 10 : 11} className="text-center py-8 text-muted-foreground">
                Carregando...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={hideBank ? 10 : 11} className="text-center py-8 text-muted-foreground">
                Nenhum lançamento encontrado
              </TableCell>
            </TableRow>
          ) : rows.map((e) => {
            const previsto = isPrevisto(e);
            return (
              <TableRow key={e.id} className="even:bg-muted/20 hover:bg-muted/40">
                <TableCell className="py-1.5 whitespace-nowrap text-xs tabular-nums">{e.entry_date}</TableCell>
                <TableCell className="py-1.5">{e.business_unit ?? "—"}</TableCell>
                {!hideBank && (
                  <TableCell className="py-1.5 text-xs">{bankLabel(e.bank_account_id)}</TableCell>
                )}
                <TableCell className="py-1.5">
                  <Badge variant="outline" className={typeBadge(e.entry_type)}>
                    {e.entry_type ?? "—"}
                  </Badge>
                </TableCell>
                <TableCell className="py-1.5 text-xs capitalize">{getOrigem(e)}</TableCell>
                <TableCell className="py-1.5 max-w-[240px] truncate" title={e.movement_description ?? ""}>
                  {e.movement_description}
                </TableCell>
                <TableCell className="py-1.5">{e.counterparty_name ?? "—"}</TableCell>
                <TableCell className="py-1.5 text-right text-success font-medium tabular-nums">
                  {Number(e.amount_in) ? fmt(Number(e.amount_in)) : "—"}
                </TableCell>
                <TableCell className="py-1.5 text-right text-destructive font-medium tabular-nums">
                  {Number(e.amount_out) ? fmt(Number(e.amount_out)) : "—"}
                </TableCell>
                <TableCell className="py-1.5">
                  <Badge variant="outline" className={previsto ? "bg-warning/10 text-warning border-warning/30" : "bg-success/10 text-success border-success/30"}>
                    {previsto ? "Previsto" : "Realizado"}
                  </Badge>
                </TableCell>
                <TableCell className="py-1.5">
                  <Badge variant="outline" className={statusColors[e.conciliation_status] || ""}>
                    {e.conciliation_status}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: Financeiro,
});
