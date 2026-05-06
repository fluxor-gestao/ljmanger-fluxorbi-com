import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, useParams, Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, FileText, DollarSign } from "lucide-react";

function Gestao() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">Gestão / Administrativo</h1>
          <p className="text-muted-foreground mt-1">Visão transversal do grupo empresarial</p>
        </div>
        <Button variant="outline" onClick={() => window.history.back()} className="sm:self-start">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-dashed">
          <CardHeader>
            <Building2 className="h-8 w-8 text-muted-foreground mb-2" />
            <CardTitle className="text-lg">Múltiplas Empresas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Gerencie diferentes unidades de negócio e blocos empresariais em um único ambiente. Em breve: seletor de empresa e filtros transversais.
            </p>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <FileText className="h-8 w-8 text-muted-foreground mb-2" />
            <CardTitle className="text-lg">Documentos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Centralize documentos importantes do grupo. Em breve: upload, categorização e busca de documentos.
            </p>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <DollarSign className="h-8 w-8 text-muted-foreground mb-2" />
            <CardTitle className="text-lg">Pagamentos Centralizados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Controle pagamentos de forma centralizada entre empresas. Em breve: visão unificada de contas a pagar e fluxo de aprovação.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/gestao")({
  component: Gestao,
});
