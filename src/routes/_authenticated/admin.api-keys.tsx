import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Copy, KeyRound, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
  revoked_at: string | null;
};

const ALL_SCOPES = ["comercial", "financeiro", "operacao"] as const;

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const FN_BASE = `https://${PROJECT_ID}.functions.supabase.co`;

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `lk_${b64}`;
}

function ApiKeys() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([...ALL_SCOPES]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ApiKey[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe um nome");
      if (scopes.length === 0) throw new Error("Selecione ao menos um escopo");
      const plain = generateKey();
      const hash = await sha256Hex(plain);
      const prefix = plain.slice(0, 11);
      const { error } = await supabase.from("api_keys").insert({
        name: name.trim(),
        key_hash: hash,
        key_prefix: prefix,
        scopes,
        created_by: user?.id,
      });
      if (error) throw error;
      return plain;
    },
    onSuccess: (plain) => {
      setCreatedKey(plain);
      setName("");
      setScopes([...ALL_SCOPES]);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chave revogada");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  const endpoints = [
    { path: "/bi-comercial", desc: "Propostas brutas (paginado)", scope: "comercial" },
    { path: "/bi-financeiro", desc: "Lançamentos financeiros (paginado)", scope: "financeiro" },
    { path: "/bi-financeiro?dataset=bank_statement", desc: "Extrato bancário (paginado)", scope: "financeiro" },
    { path: "/bi-operacao", desc: "Serviços (paginado)", scope: "operacao" },
    { path: "/bi-kpis-comercial", desc: "KPIs comerciais agregados", scope: "comercial" },
    { path: "/bi-kpis-financeiro", desc: "KPIs financeiros agregados", scope: "financeiro" },
    { path: "/bi-kpis-operacao", desc: "KPIs de operação agregados", scope: "operacao" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">API Keys – Integração BI</h1>
          <p className="text-muted-foreground mt-1">
            Gere chaves para conectar Power BI, Looker, Metabase ou Tableau aos dados do sistema.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys"><KeyRound className="h-4 w-4 mr-2" />Chaves</TabsTrigger>
          <TabsTrigger value="docs">Documentação</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setCreatedKey(null); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Nova chave
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Chaves cadastradas</CardTitle>
              <CardDescription>A chave em texto puro só é exibida no momento da criação.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Carregando…</p>
              ) : keys.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma chave cadastrada ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Prefixo</TableHead>
                      <TableHead>Escopos</TableHead>
                      <TableHead>Último uso</TableHead>
                      <TableHead className="text-right">Usos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map((k) => (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell className="font-mono text-xs">{k.key_prefix}…</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {k.scopes.map((s) => (
                              <Badge key={s} variant="secondary">{s}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {k.last_used_at ? new Date(k.last_used_at).toLocaleString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="text-right">{k.usage_count}</TableCell>
                        <TableCell>
                          {k.revoked_at ? (
                            <Badge variant="destructive">Revogada</Badge>
                          ) : (
                            <Badge>Ativa</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!k.revoked_at && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Revogar "${k.name}"? Essa ação é imediata e irreversível.`)) {
                                  revokeMutation.mutate(k.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Como conectar</CardTitle>
              <CardDescription>Endpoints REST autenticados via header <code>x-api-key</code>.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">URL base</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-muted px-2 py-1 rounded text-xs flex-1 break-all">{FN_BASE}</code>
                  <Button size="sm" variant="ghost" onClick={() => copy(FN_BASE)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Endpoints disponíveis</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Escopo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endpoints.map((e) => (
                      <TableRow key={e.path}>
                        <TableCell className="font-mono text-xs">{e.path}</TableCell>
                        <TableCell>{e.desc}</TableCell>
                        <TableCell><Badge variant="secondary">{e.scope}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-2">
                  Endpoints de dados brutos aceitam: <code>?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&page_size=500</code> (máx 1000).
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Exemplo curl</Label>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto mt-1">
{`curl -H "x-api-key: lk_xxxxx..." \\
  "${FN_BASE}/bi-financeiro?from=2026-01-01&to=2026-12-31&page=1&page_size=500"`}
                </pre>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Power BI (Get Data → Web → Advanced)</Label>
                <ol className="list-decimal list-inside text-sm space-y-1 mt-1">
                  <li>URL parts: cole a URL completa do endpoint</li>
                  <li>HTTP request header parameters: adicione <code>x-api-key</code> com o valor da chave</li>
                  <li>Em "JSON" o Power BI carrega <code>data</code> + <code>meta</code></li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-warning" /> Boas práticas
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>• Crie uma chave por ferramenta/usuário (ex: "Power BI – Diretoria"), nunca compartilhe a mesma.</p>
              <p>• Revogue imediatamente qualquer chave que vazar — leva efeito instantâneo.</p>
              <p>• Restrinja escopos: dê só os módulos que aquela chave precisa.</p>
              <p>• A chave em texto puro é exibida apenas uma vez. Guarde-a num cofre de senhas.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal criar */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreatedKey(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdKey ? "Chave criada" : "Nova chave de API"}</DialogTitle>
            <DialogDescription>
              {createdKey
                ? "Copie e guarde agora. Esta é a única vez que você verá a chave em texto puro."
                : "Defina o nome e quais módulos esta chave poderá acessar."}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-3">
              <div className="bg-muted p-3 rounded font-mono text-xs break-all">{createdKey}</div>
              <Button onClick={() => copy(createdKey)} className="w-full">
                <Copy className="h-4 w-4 mr-2" /> Copiar chave
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Power BI – Diretoria"
                />
              </div>
              <div>
                <Label>Escopos</Label>
                <div className="flex flex-col gap-2 mt-2">
                  {ALL_SCOPES.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={scopes.includes(s)}
                        onCheckedChange={(v) => {
                          setScopes((prev) =>
                            v ? [...prev, s] : prev.filter((x) => x !== s),
                          );
                        }}
                      />
                      <span className="capitalize">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <Button onClick={() => { setCreateOpen(false); setCreatedKey(null); }}>Fechar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  Criar chave
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin/api-keys")({
  component: ApiKeys,
});
