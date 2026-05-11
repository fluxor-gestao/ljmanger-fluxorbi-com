import { useEffect, useState } from "react";
import { useNavigate, useParams, Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, ScrollText, Plus, Pencil, Trash2, Settings, Building2, BriefcaseBusiness, WalletCards, ShieldCheck, Save, Bell, Palette, Hash, SlidersHorizontal, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type SystemSettings = {
  companyName: string;
  companyDocument: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  systemDisplayName: string;
  primaryColor: string;
  footerText: string;
  supportEmail: string;
  proposalPrefix: string;
  proposalValidityDays: string;
  proposalDownPaymentPercent: string;
  proposalFinalPaymentPercent: string;
  proposalTemplate: string;
  proposalTerms: string;
  proposalExecutionDeadline: string;
  proposalWarranty: string;
  proposalSignature: string;
  proposalSequence: string;
  proposalNumberFormat: string;
  financialEntryPrefix: string;
  servicePrefix: string;
  defaultCurrency: string;
  defaultBankAccount: string;
  defaultCostCenter: string;
  defaultIncomeCategory: string;
  defaultExpenseCategory: string;
  defaultDueDay: string;
  requireBusinessUnit: boolean;
  requireCostCenter: boolean;
  requireEntryDescription: boolean;
  allowRetroactiveEntries: boolean;
  conciliationDayTolerance: string;
  conciliationValueTolerance: string;
  conciliationAutoSuggest: boolean;
  conciliationAutoApproveExact: boolean;
  conciliationBlockDivergent: boolean;
  conciliationWeightValue: string;
  conciliationWeightDate: string;
  conciliationWeightDescription: string;
  conciliationWeightDocument: string;
  defaultHomePage: string;
  auditSensitiveChanges: boolean;
  administrativeNotifications: boolean;
  notifyProposalSent: boolean;
  notifyProposalAccepted: boolean;
  notifyProposalRejected: boolean;
  notifyPendingCharge: boolean;
  notifyDelayedService: boolean;
  notifyConciliationDivergence: boolean;
  notificationEmail: string;
  defaultLanguage: string;
  timezone: string;
  dateFormat: string;
  recordsPerPage: string;
  compactMode: boolean;
  confirmBeforeDelete: boolean;
  blockDeleteConciliatedEntries: boolean;
  logRetentionDays: string;
  allowLogExport: boolean;
  transactionalEmailEnabled: boolean;
  whatsappEnabled: boolean;
  bankImportEnabled: boolean;
  webhooksEnabled: boolean;
  externalBiEnabled: boolean;
};

const defaultSystemSettings: SystemSettings = {
  companyName: "",
  companyDocument: "",
  companyEmail: "",
  companyPhone: "",
  companyAddress: "",
  systemDisplayName: "",
  primaryColor: "primary",
  footerText: "",
  supportEmail: "",
  proposalPrefix: "DE",
  proposalValidityDays: "7",
  proposalDownPaymentPercent: "50",
  proposalFinalPaymentPercent: "50",
  proposalTemplate: "completo",
  proposalTerms: "",
  proposalExecutionDeadline: "",
  proposalWarranty: "",
  proposalSignature: "",
  proposalSequence: "1",
  proposalNumberFormat: "prefixo-ano-mes-sequencial",
  financialEntryPrefix: "FIN",
  servicePrefix: "SRV",
  defaultCurrency: "brl",
  defaultBankAccount: "",
  defaultCostCenter: "",
  defaultIncomeCategory: "",
  defaultExpenseCategory: "",
  defaultDueDay: "10",
  requireBusinessUnit: true,
  requireCostCenter: false,
  requireEntryDescription: true,
  allowRetroactiveEntries: true,
  conciliationDayTolerance: "3",
  conciliationValueTolerance: "1.00",
  conciliationAutoSuggest: true,
  conciliationAutoApproveExact: false,
  conciliationBlockDivergent: true,
  conciliationWeightValue: "40",
  conciliationWeightDate: "25",
  conciliationWeightDescription: "20",
  conciliationWeightDocument: "15",
  defaultHomePage: "hub",
  auditSensitiveChanges: true,
  administrativeNotifications: false,
  notifyProposalSent: false,
  notifyProposalAccepted: true,
  notifyProposalRejected: true,
  notifyPendingCharge: true,
  notifyDelayedService: true,
  notifyConciliationDivergence: true,
  notificationEmail: "",
  defaultLanguage: "pt-BR",
  timezone: "America/Sao_Paulo",
  dateFormat: "dd/MM/yyyy",
  recordsPerPage: "25",
  compactMode: false,
  confirmBeforeDelete: true,
  blockDeleteConciliatedEntries: true,
  logRetentionDays: "365",
  allowLogExport: true,
  transactionalEmailEnabled: false,
  whatsappEnabled: false,
  bankImportEnabled: false,
  webhooksEnabled: false,
  externalBiEnabled: false,
};

function Admin() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ user_id: string; currentRole: string } | null>(null);
  const [newRole, setNewRole] = useState("gerencial");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ user_id: string; label: string } | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [resetPwdConfirm, setResetPwdConfirm] = useState("");

  // Form state for creating user
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("gerencial");
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(defaultSystemSettings);

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSystemSettings((current) => ({ ...current, [key]: value }));
  };

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: roles = [], isLoading: isLoadingRoles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const usersLoading = isLoading || isLoadingRoles;

  const { data: logs = [] } = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const { data: savedSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["system-settings", "general"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("settings")
        .eq("category", "general")
        .maybeSingle();
      if (error) throw error;
      return data?.settings as Partial<SystemSettings> | undefined;
    },
  });

  useEffect(() => {
    if (savedSettings) {
      setSystemSettings({ ...defaultSystemSettings, ...savedSettings });
    }
  }, [savedSettings]);

  const getUserRole = (userId: string): string => {
    const r = roles.find((r) => r.user_id === userId);
    return r?.role ?? "—";
  };

  const invokeManageUsers = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("manage-users", { body });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const createUser = useMutation({
    mutationFn: () =>
      invokeManageUsers({
        action: "create",
        email: formEmail,
        password: formPassword,
        full_name: formName,
        role: formRole,
      }),
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      setCreateOpen(false);
      setFormName("");
      setFormEmail("");
      setFormPassword("");
      setFormRole("gerencial");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateRole = useMutation({
    mutationFn: ({ user_id, role }: { user_id: string; role: string }) =>
      invokeManageUsers({ action: "update-role", user_id, role }),
    onSuccess: async () => {
      toast.success("Perfil atualizado!");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-roles"] }),
      ]);
      setEditOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteUser = useMutation({
    mutationFn: (user_id: string) =>
      invokeManageUsers({ action: "delete", user_id }),
    onSuccess: () => {
      toast.success("Usuário removido!");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetPassword = useMutation({
    mutationFn: ({ user_id, new_password }: { user_id: string; new_password: string }) =>
      invokeManageUsers({ action: "reset-password", user_id, new_password }),
    onSuccess: () => {
      toast.success("Senha redefinida!");
      setResetOpen(false);
      setResetPwd("");
      setResetPwdConfirm("");
      setResetTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("system_settings").upsert({
        category: "general",
        settings: systemSettings,
        updated_by: user?.id,
      }, { onConflict: "category" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opções do sistema salvas!");
      queryClient.invalidateQueries({ queryKey: ["system-settings", "general"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">Opções / Usuários</h1>
          <p className="text-muted-foreground mt-1">Gerencie usuários e perfis do sistema</p>
        </div>
        <Button variant="outline" onClick={() => (window.location.href = "/admin/api-keys")}>
          <KeyRound className="h-4 w-4 mr-2" /> API Keys (BI)
        </Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" />Usuários</TabsTrigger>
          <TabsTrigger value="logs"><ScrollText className="h-4 w-4 mr-2" />Logs</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />Opções do Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Novo Usuário</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Usuário</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createUser.mutate();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>Nome completo</Label>
                    <Input value={formName} onChange={(e) => setFormName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} required minLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label>Perfil</Label>
                    <Select value={formRole} onValueChange={setFormRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="gerencial">Gerencial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" disabled={createUser.isPending}>
                      {createUser.isPending ? "Criando..." : "Criar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit Role Dialog */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Alterar Perfil</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Novo Perfil</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="gerencial">Gerencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
                  <Button
                    disabled={updateRole.isPending}
                    onClick={() => {
                      if (editTarget) updateRole.mutate({ user_id: editTarget.user_id, role: newRole });
                    }}
                  >
                    {updateRole.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : profiles.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum usuário</TableCell></TableRow>
                ) : (
                  profiles.map((p) => {
                    const role = getUserRole(p.user_id);
                    const isSelf = p.user_id === user?.id;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                        <TableCell>{p.email}</TableCell>
                        <TableCell>
                          <Badge variant={role === "admin" ? "default" : "secondary"}>
                            {role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditTarget({ user_id: p.user_id, currentRole: role });
                                setNewRole(role === "admin" || role === "gerencial" ? role : "gerencial");
                                setEditOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Redefinir senha"
                              onClick={() => {
                                setResetTarget({ user_id: p.user_id, label: p.full_name || p.email || "usuário" });
                                setResetPwd("");
                                setResetPwdConfirm("");
                                setResetOpen(true);
                              }}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            {!isSelf && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir o usuário <strong>{p.full_name || p.email}</strong>? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteUser.mutate(p.user_id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum log registrado</TableCell></TableRow>
                ) : logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-sm">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{l.action}</TableCell>
                    <TableCell>{l.entity_type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{JSON.stringify(l.details)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 to-accent/10">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                  Dados da Empresa
                </CardTitle>
                <CardDescription>Informações usadas em propostas, relatórios e documentos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome da empresa</Label>
                    <Input value={systemSettings.companyName} onChange={(e) => updateSetting("companyName", e.target.value)} placeholder="Lundgaard" />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={systemSettings.companyDocument} onChange={(e) => updateSetting("companyDocument", e.target.value)} placeholder="00.000.000/0000-00" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>E-mail institucional</Label>
                    <Input type="email" value={systemSettings.companyEmail} onChange={(e) => updateSetting("companyEmail", e.target.value)} placeholder="contato@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={systemSettings.companyPhone} onChange={(e) => updateSetting("companyPhone", e.target.value)} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Textarea value={systemSettings.companyAddress} onChange={(e) => updateSetting("companyAddress", e.target.value)} placeholder="Endereço completo da empresa" />
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-secondary/40 to-primary/10">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Palette className="h-5 w-5 text-primary" />
                  Identidade Visual
                </CardTitle>
                <CardDescription>Nome, aparência e contatos exibidos no sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome exibido no sistema</Label>
                    <Input value={systemSettings.systemDisplayName} onChange={(e) => updateSetting("systemDisplayName", e.target.value)} placeholder="Hub Manager" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cor principal</Label>
                    <Select value={systemSettings.primaryColor} onValueChange={(value) => updateSetting("primaryColor", value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">Padrão</SelectItem>
                        <SelectItem value="accent">Destaque</SelectItem>
                        <SelectItem value="secondary">Neutra</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>E-mail de suporte</Label>
                  <Input type="email" value={systemSettings.supportEmail} onChange={(e) => updateSetting("supportEmail", e.target.value)} placeholder="suporte@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label>Texto de rodapé</Label>
                  <Textarea value={systemSettings.footerText} onChange={(e) => updateSetting("footerText", e.target.value)} placeholder="Texto para PDFs, propostas e relatórios" />
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-accent/30 bg-gradient-to-br from-accent/10 to-secondary/40">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BriefcaseBusiness className="h-5 w-5 text-accent" />
                  Preferências Comerciais
                </CardTitle>
                <CardDescription>Parâmetros padrão para propostas e negociações.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Prefixo da proposta</Label>
                    <Input value={systemSettings.proposalPrefix} onChange={(e) => updateSetting("proposalPrefix", e.target.value)} placeholder="DE" />
                  </div>
                  <div className="space-y-2">
                    <Label>Validade padrão</Label>
                    <Input type="number" value={systemSettings.proposalValidityDays} onChange={(e) => updateSetting("proposalValidityDays", e.target.value)} placeholder="7" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Entrada padrão (%)</Label>
                    <Input type="number" value={systemSettings.proposalDownPaymentPercent} onChange={(e) => updateSetting("proposalDownPaymentPercent", e.target.value)} placeholder="50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Saldo/finalização (%)</Label>
                    <Input type="number" value={systemSettings.proposalFinalPaymentPercent} onChange={(e) => updateSetting("proposalFinalPaymentPercent", e.target.value)} placeholder="50" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Modelo padrão</Label>
                    <Select value={systemSettings.proposalTemplate} onValueChange={(value) => updateSetting("proposalTemplate", value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completo">Completo</SelectItem>
                        <SelectItem value="resumido">Resumido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Responsável/assinatura padrão</Label>
                    <Input value={systemSettings.proposalSignature} onChange={(e) => updateSetting("proposalSignature", e.target.value)} placeholder="Nome do responsável" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Condições comerciais padrão</Label>
                  <Textarea value={systemSettings.proposalTerms} onChange={(e) => updateSetting("proposalTerms", e.target.value)} placeholder="Texto padrão exibido nas propostas" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Prazo de execução padrão</Label>
                    <Textarea value={systemSettings.proposalExecutionDeadline} onChange={(e) => updateSetting("proposalExecutionDeadline", e.target.value)} placeholder="Ex.: até 10 dias úteis" />
                  </div>
                  <div className="space-y-2">
                    <Label>Garantia/observações padrão</Label>
                    <Textarea value={systemSettings.proposalWarranty} onChange={(e) => updateSetting("proposalWarranty", e.target.value)} placeholder="Texto de garantia ou observações" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-muted bg-gradient-to-br from-background to-secondary/50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Hash className="h-5 w-5 text-primary" />
                  Numeração e Documentos
                </CardTitle>
                <CardDescription>Formatos e prefixos usados em propostas, lançamentos e serviços.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Sequencial atual da proposta</Label>
                    <Input type="number" value={systemSettings.proposalSequence} onChange={(e) => updateSetting("proposalSequence", e.target.value)} placeholder="1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Formato do número</Label>
                    <Select value={systemSettings.proposalNumberFormat} onValueChange={(value) => updateSetting("proposalNumberFormat", value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prefixo-ano-mes-sequencial">DE + Ano + Mês + Sequencial</SelectItem>
                        <SelectItem value="prefixo-ano-sequencial">DE + Ano + Sequencial</SelectItem>
                        <SelectItem value="sequencial-simples">Sequencial simples</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Prefixo financeiro</Label>
                    <Input value={systemSettings.financialEntryPrefix} onChange={(e) => updateSetting("financialEntryPrefix", e.target.value)} placeholder="FIN" />
                  </div>
                  <div className="space-y-2">
                    <Label>Prefixo de serviço</Label>
                    <Input value={systemSettings.servicePrefix} onChange={(e) => updateSetting("servicePrefix", e.target.value)} placeholder="SRV" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-muted bg-gradient-to-br from-secondary/50 to-background">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <WalletCards className="h-5 w-5 text-primary" />
                  Configurações Financeiras
                </CardTitle>
                <CardDescription>Preferências para lançamentos e conciliação financeira.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Moeda padrão</Label>
                    <Select value={systemSettings.defaultCurrency} onValueChange={(value) => updateSetting("defaultCurrency", value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brl">BRL</SelectItem>
                        <SelectItem value="usd">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tolerância de dias</Label>
                    <Input type="number" value={systemSettings.conciliationDayTolerance} onChange={(e) => updateSetting("conciliationDayTolerance", e.target.value)} placeholder="3" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Conta bancária padrão</Label>
                  <Input value={systemSettings.defaultBankAccount} onChange={(e) => updateSetting("defaultBankAccount", e.target.value)} placeholder="Selecione ou informe a conta padrão" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Centro de custo padrão</Label>
                    <Input value={systemSettings.defaultCostCenter} onChange={(e) => updateSetting("defaultCostCenter", e.target.value)} placeholder="Centro de custo" />
                  </div>
                  <div className="space-y-2">
                    <Label>Dia padrão de vencimento</Label>
                    <Input type="number" value={systemSettings.defaultDueDay} onChange={(e) => updateSetting("defaultDueDay", e.target.value)} placeholder="10" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Categoria padrão de entrada</Label>
                    <Input value={systemSettings.defaultIncomeCategory} onChange={(e) => updateSetting("defaultIncomeCategory", e.target.value)} placeholder="Receita operacional" />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria padrão de saída</Label>
                    <Input value={systemSettings.defaultExpenseCategory} onChange={(e) => updateSetting("defaultExpenseCategory", e.target.value)} placeholder="Despesa operacional" />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background/70 p-3">
                  <div>
                    <Label>Sugestões automáticas de conciliação</Label>
                    <p className="text-sm text-muted-foreground">Usar valor, data e descrição para sugerir vínculos.</p>
                  </div>
                  <Switch checked={systemSettings.conciliationAutoSuggest} onCheckedChange={(checked) => updateSetting("conciliationAutoSuggest", checked)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-md border bg-background/70 p-3">
                    <Label>Exigir unidade de negócio</Label>
                    <Switch checked={systemSettings.requireBusinessUnit} onCheckedChange={(checked) => updateSetting("requireBusinessUnit", checked)} />
                  </div>
                  <div className="flex items-center justify-between rounded-md border bg-background/70 p-3">
                    <Label>Permitir retroativos</Label>
                    <Switch checked={systemSettings.allowRetroactiveEntries} onCheckedChange={(checked) => updateSetting("allowRetroactiveEntries", checked)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 to-background">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                  Regras de Conciliação
                </CardTitle>
                <CardDescription>Critérios de compatibilidade entre extrato e lançamentos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tolerância de valor</Label>
                    <Input type="number" value={systemSettings.conciliationValueTolerance} onChange={(e) => updateSetting("conciliationValueTolerance", e.target.value)} placeholder="1.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tolerância de dias</Label>
                    <Input type="number" value={systemSettings.conciliationDayTolerance} onChange={(e) => updateSetting("conciliationDayTolerance", e.target.value)} placeholder="3" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-2"><Label>Peso valor</Label><Input type="number" value={systemSettings.conciliationWeightValue} onChange={(e) => updateSetting("conciliationWeightValue", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Peso data</Label><Input type="number" value={systemSettings.conciliationWeightDate} onChange={(e) => updateSetting("conciliationWeightDate", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Peso descrição</Label><Input type="number" value={systemSettings.conciliationWeightDescription} onChange={(e) => updateSetting("conciliationWeightDescription", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Peso documento</Label><Input type="number" value={systemSettings.conciliationWeightDocument} onChange={(e) => updateSetting("conciliationWeightDocument", e.target.value)} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Aprovar 100% automático</Label><Switch checked={systemSettings.conciliationAutoApproveExact} onCheckedChange={(checked) => updateSetting("conciliationAutoApproveExact", checked)} /></div>
                  <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Bloquear divergentes</Label><Switch checked={systemSettings.conciliationBlockDivergent} onCheckedChange={(checked) => updateSetting("conciliationBlockDivergent", checked)} /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-destructive/20 bg-gradient-to-br from-destructive/10 to-background">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="h-5 w-5 text-destructive" />
                  Permissões e Segurança
                </CardTitle>
                <CardDescription>Controles administrativos, auditoria e notificações.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Página inicial padrão</Label>
                  <Select value={systemSettings.defaultHomePage} onValueChange={(value) => updateSetting("defaultHomePage", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hub">Hub</SelectItem>
                      <SelectItem value="bi">BI / Business Intelligence</SelectItem>
                      <SelectItem value="financeiro">Financeiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background/70 p-3">
                  <div>
                    <Label>Registrar alterações sensíveis</Label>
                    <p className="text-sm text-muted-foreground">Auditar exclusões e mudanças de perfil.</p>
                  </div>
                  <Switch checked={systemSettings.auditSensitiveChanges} onCheckedChange={(checked) => updateSetting("auditSensitiveChanges", checked)} />
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background/70 p-3">
                  <div className="flex items-start gap-2">
                    <Bell className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label>Notificações administrativas</Label>
                      <p className="text-sm text-muted-foreground">Avisar sobre propostas aprovadas e conciliações divergentes.</p>
                    </div>
                  </div>
                  <Switch checked={systemSettings.administrativeNotifications} onCheckedChange={(checked) => updateSetting("administrativeNotifications", checked)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Confirmar antes de excluir</Label><Switch checked={systemSettings.confirmBeforeDelete} onCheckedChange={(checked) => updateSetting("confirmBeforeDelete", checked)} /></div>
                  <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Bloquear exclusão conciliada</Label><Switch checked={systemSettings.blockDeleteConciliatedEntries} onCheckedChange={(checked) => updateSetting("blockDeleteConciliatedEntries", checked)} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Retenção de logs em dias</Label><Input type="number" value={systemSettings.logRetentionDays} onChange={(e) => updateSetting("logRetentionDays", e.target.value)} /></div>
                  <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Permitir exportar logs</Label><Switch checked={systemSettings.allowLogExport} onCheckedChange={(checked) => updateSetting("allowLogExport", checked)} /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-accent/20 bg-gradient-to-br from-accent/10 to-background">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bell className="h-5 w-5 text-accent" />
                  Notificações
                </CardTitle>
                <CardDescription>Eventos que devem gerar avisos administrativos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>E-mail padrão para alertas</Label>
                  <Input type="email" value={systemSettings.notificationEmail} onChange={(e) => updateSetting("notificationEmail", e.target.value)} placeholder="alertas@empresa.com" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Proposta enviada</Label><Switch checked={systemSettings.notifyProposalSent} onCheckedChange={(checked) => updateSetting("notifyProposalSent", checked)} /></div>
                  <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Proposta aceita</Label><Switch checked={systemSettings.notifyProposalAccepted} onCheckedChange={(checked) => updateSetting("notifyProposalAccepted", checked)} /></div>
                  <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Proposta rejeitada</Label><Switch checked={systemSettings.notifyProposalRejected} onCheckedChange={(checked) => updateSetting("notifyProposalRejected", checked)} /></div>
                  <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Cobrança pendente</Label><Switch checked={systemSettings.notifyPendingCharge} onCheckedChange={(checked) => updateSetting("notifyPendingCharge", checked)} /></div>
                  <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Serviço atrasado</Label><Switch checked={systemSettings.notifyDelayedService} onCheckedChange={(checked) => updateSetting("notifyDelayedService", checked)} /></div>
                  <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Divergência na conciliação</Label><Switch checked={systemSettings.notifyConciliationDivergence} onCheckedChange={(checked) => updateSetting("notifyConciliationDivergence", checked)} /></div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-muted bg-gradient-to-br from-secondary/50 to-background">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5 text-primary" />
                  Preferências Gerais
                </CardTitle>
                <CardDescription>Idioma, fuso, paginação e densidade da interface.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Idioma</Label><Select value={systemSettings.defaultLanguage} onValueChange={(value) => updateSetting("defaultLanguage", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pt-BR">Português</SelectItem><SelectItem value="en-US">Inglês</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Fuso horário</Label><Input value={systemSettings.timezone} onChange={(e) => updateSetting("timezone", e.target.value)} /></div>
                  <div className="space-y-2"><Label>Formato de data</Label><Select value={systemSettings.dateFormat} onValueChange={(value) => updateSetting("dateFormat", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dd/MM/yyyy">dd/MM/yyyy</SelectItem><SelectItem value="yyyy-MM-dd">yyyy-MM-dd</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Registros por página</Label><Input type="number" value={systemSettings.recordsPerPage} onChange={(e) => updateSetting("recordsPerPage", e.target.value)} /></div>
                </div>
                <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Modo compacto da interface</Label><Switch checked={systemSettings.compactMode} onCheckedChange={(checked) => updateSetting("compactMode", checked)} /></div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-background to-primary/10">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Permissões por Módulo
                </CardTitle>
                <CardDescription>Resumo visual dos acessos principais por perfil.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Perfil</TableHead><TableHead>Comercial</TableHead><TableHead>Financeiro</TableHead><TableHead>Operação</TableHead><TableHead>BI</TableHead><TableHead>Usuários</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {[
                      ["Admin", "Sim", "Sim", "Sim", "Sim", "Sim"],
                      ["Gerencial", "Ver", "Ver", "Ver", "Sim", "Não"],
                      ["Comercial", "Sim", "Não", "Ver", "Parcial", "Não"],
                      ["Financeiro", "Ver", "Sim", "Não", "Parcial", "Não"],
                      ["Operação", "Ver", "Não", "Sim", "Parcial", "Não"],
                    ].map((row) => <TableRow key={row[0]}>{row.map((cell) => <TableCell key={cell}><Badge variant={cell === "Não" ? "secondary" : "default"}>{cell}</Badge></TableCell>)}</TableRow>)}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-muted bg-gradient-to-br from-background to-secondary/40">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                  Integrações Futuras
                </CardTitle>
                <CardDescription>Chaves de ativação para recursos integrados futuros.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>E-mail transacional</Label><Switch checked={systemSettings.transactionalEmailEnabled} onCheckedChange={(checked) => updateSetting("transactionalEmailEnabled", checked)} /></div>
                <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>WhatsApp</Label><Switch checked={systemSettings.whatsappEnabled} onCheckedChange={(checked) => updateSetting("whatsappEnabled", checked)} /></div>
                <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Importação bancária</Label><Switch checked={systemSettings.bankImportEnabled} onCheckedChange={(checked) => updateSetting("bankImportEnabled", checked)} /></div>
                <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>Webhooks</Label><Switch checked={systemSettings.webhooksEnabled} onCheckedChange={(checked) => updateSetting("webhooksEnabled", checked)} /></div>
                <div className="flex items-center justify-between rounded-md border bg-background/70 p-3"><Label>BI externo</Label><Switch checked={systemSettings.externalBiEnabled} onCheckedChange={(checked) => updateSetting("externalBiEnabled", checked)} /></div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button disabled={isLoadingSettings || saveSettings.isPending} onClick={() => saveSettings.mutate()}>
              <Save className="h-4 w-4 mr-2" />
              {saveSettings.isPending ? "Salvando..." : "Salvar Opções"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin")({
  component: Admin,
});
