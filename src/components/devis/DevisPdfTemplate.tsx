import logoBanner from "@/assets/logo-banner.png";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

type Lang = "pt" | "fr" | "en" | "es";

const detectLang = (text: string): Lang => {
  const t = (text || "").toLowerCase();
  if (/\b(honoraires|prestation|contrat|objet|échéance|cabinet)\b/.test(t)) return "fr";
  if (/\b(fees|scope|agreement|deadline|object)\b/.test(t)) return "en";
  if (/\b(honorarios|prestación|contrato|objeto|plazo)\b/.test(t)) return "es";
  return "pt";
};

const labels: Record<Lang, Record<string, string>> = {
  pt: {
    title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS",
    parties: "I. IDENTIFICAÇÃO DAS PARTES",
    contractor: "CONTRATADO",
    client: "CONTRATANTE",
    object: "II. OBJETO DO CONTRATO",
    scope: "Escopo de Serviços",
    fees: "III. HONORÁRIOS",
    deadline: "IV. PRAZO",
    total: "Valor Total",
    down: "Entrada (50%)",
    balance: "Saldo (50%) na conclusão",
    signatures: "ASSINATURAS",
    witnesses: "TESTEMUNHAS",
    name: "Nome",
    cpf: "CPF",
    signature: "Assinatura",
    page: "Página",
    of: "de",
    document: "Documento",
    address: "Endereço",
    deadlineLabel: "Prazo estimado de execução",
  },
  fr: {
    title: "CONTRAT DE PRESTATION DE SERVICES JURIDIQUES",
    parties: "I. IDENTIFICATION DES PARTIES",
    contractor: "CABINET",
    client: "CLIENT",
    object: "II. OBJET DU CONTRAT",
    scope: "Étendue des Services",
    fees: "III. HONORAIRES",
    deadline: "IV. DÉLAI",
    total: "Montant Total",
    down: "Acompte (50%)",
    balance: "Solde (50%) à l'achèvement",
    signatures: "SIGNATURES",
    witnesses: "TÉMOINS",
    name: "Nom",
    cpf: "CPF",
    signature: "Signature",
    page: "Page",
    of: "de",
    document: "Document",
    address: "Adresse",
    deadlineLabel: "Délai estimé d'exécution",
  },
  en: {
    title: "LEGAL SERVICES AGREEMENT",
    parties: "I. IDENTIFICATION OF PARTIES",
    contractor: "LAW FIRM",
    client: "CLIENT",
    object: "II. OBJECT OF AGREEMENT",
    scope: "Scope of Services",
    fees: "III. FEES",
    deadline: "IV. DEADLINE",
    total: "Total Amount",
    down: "Down Payment (50%)",
    balance: "Balance (50%) on completion",
    signatures: "SIGNATURES",
    witnesses: "WITNESSES",
    name: "Name",
    cpf: "ID",
    signature: "Signature",
    page: "Page",
    of: "of",
    document: "Document",
    address: "Address",
    deadlineLabel: "Estimated execution deadline",
  },
  es: {
    title: "CONTRATO DE PRESTACIÓN DE SERVICIOS JURÍDICOS",
    parties: "I. IDENTIFICACIÓN DE LAS PARTES",
    contractor: "CONTRATADO",
    client: "CONTRATANTE",
    object: "II. OBJETO DEL CONTRATO",
    scope: "Alcance de Servicios",
    fees: "III. HONORARIOS",
    deadline: "IV. PLAZO",
    total: "Valor Total",
    down: "Entrada (50%)",
    balance: "Saldo (50%) a la conclusión",
    signatures: "FIRMAS",
    witnesses: "TESTIGOS",
    name: "Nombre",
    cpf: "Documento",
    signature: "Firma",
    page: "Página",
    of: "de",
    document: "Documento",
    address: "Dirección",
    deadlineLabel: "Plazo estimado de ejecución",
  },
};

interface ScopeItem {
  letter: string;
  title: string;
  description?: string;
  amount?: number;
}

// Tenta extrair itens A) B) C) do markdown da proposta
const parseScopeItems = (markdown?: string | null): ScopeItem[] => {
  if (!markdown) return [];
  const items: ScopeItem[] = [];
  // matches lines like "A) Title — BRL 1.000,00" or "A. Title - R$ 1000"
  const lines = markdown.split(/\r?\n/);
  let current: ScopeItem | null = null;
  const headerRx = /^\s*([A-Z])[\)\.\:\-]\s+(.+?)(?:\s+[—–\-]\s+(?:BRL|R\$)\s*([\d\.,]+))?$/;
  for (const line of lines) {
    const m = line.match(headerRx);
    if (m) {
      if (current) items.push(current);
      const amountStr = m[3]?.replace(/\./g, "").replace(",", ".");
      current = {
        letter: m[1],
        title: m[2].trim(),
        description: "",
        amount: amountStr ? Number(amountStr) : undefined,
      };
    } else if (current && line.trim()) {
      current.description = (current.description ? current.description + " " : "") + line.trim();
    }
  }
  if (current) items.push(current);
  return items;
};

interface DevisPdfTemplateProps {
  devis: any;
  client: any;
  contractor?: {
    name: string;
    document: string;
    address: string;
  };
}

const DEFAULT_CONTRACTOR = {
  name: "LUNDGAARD JENSEN ADVOCACIA E CONSULTORIA INTERNACIONAL",
  document: "—",
  address: "Rua João Cordeiro, 831 – Praia de Iracema, Fortaleza/CE",
};

const FOOTER_TEXT =
  "Rua João Cordeiro, 831 – Praia de Iracema  |  +55 (85) 9 94066042  |  +55 (85) 9 30379931";

const BRAND_LINE = "lundgaardjensen.com  |  @lundgaard.jensen";

export default function DevisPdfTemplate({
  devis,
  client,
  contractor = DEFAULT_CONTRACTOR,
}: DevisPdfTemplateProps) {
  const lang = detectLang(`${devis.proposal_structure || ""} ${devis.scope_description || ""}`);
  const L = labels[lang];
  const scopeItems = parseScopeItems(devis.proposal_structure || devis.scope_description);
  const total = Number(devis.total_amount) || 0;
  const down = Number(devis.down_payment_amount) || total * 0.5;
  const balance = total - down;
  const devisNumber = devis.devis_number || "DE———";

  // estilo inline para garantir captura fiel do html2canvas
  const pageStyle: React.CSSProperties = {
    width: "794px", // A4 @ 96dpi
    minHeight: "1123px",
    background: "#ffffff",
    color: "#1a1a1a",
    fontFamily: "Georgia, 'Times New Roman', serif",
    padding: "60px 70px 110px 70px",
    position: "relative",
    boxSizing: "border-box",
    fontSize: "12px",
    lineHeight: 1.55,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    marginTop: "22px",
    marginBottom: "10px",
    paddingBottom: "4px",
    borderBottom: "1px solid #c9a24a",
    color: "#111",
  };

  const Footer = ({ pageNum, totalPages }: { pageNum: number; totalPages: number }) => (
    <div
      style={{
        position: "absolute",
        bottom: "30px",
        left: "70px",
        right: "70px",
        borderTop: "1px solid #c9a24a",
        paddingTop: "8px",
        fontSize: "9px",
        color: "#555",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }}
    >
      <div style={{ maxWidth: "60%" }}>
        <div>{FOOTER_TEXT}</div>
        <div style={{ marginTop: "2px" }}>
          {BRAND_LINE} &nbsp; <strong>{devisNumber}</strong>
        </div>
      </div>
      <div>
        {L.page} {pageNum} {L.of} {totalPages}
      </div>
    </div>
  );

  const Header = () => (
    <div style={{ textAlign: "center", marginBottom: "10px" }}>
      <img
        src={logoBanner}
        alt="Lundgaard Jensen"
        style={{ height: "70px", objectFit: "contain", margin: "0 auto" }}
        crossOrigin="anonymous"
      />
      <div
        style={{
          marginTop: "12px",
          fontSize: "16px",
          fontWeight: 700,
          letterSpacing: "1px",
          color: "#1a1a1a",
        }}
      >
        {L.title}
      </div>
      <div style={{ fontSize: "10px", color: "#888", marginTop: "4px" }}>{devisNumber}</div>
    </div>
  );

  return (
    <div id="devis-pdf-root" style={{ background: "#fff" }}>
      {/* PÁGINA 1 */}
      <div className="devis-pdf-page" style={pageStyle}>
        <Header />

        <div style={sectionTitle}>{L.parties}</div>
        <div style={{ marginBottom: "14px" }}>
          <div style={{ fontWeight: 700, marginBottom: "4px" }}>{L.contractor}:</div>
          <div>{contractor.name}</div>
          <div>
            {L.address}: {contractor.address}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: "4px" }}>{L.client}:</div>
          <div>{client?.name || "—"}</div>
          {client?.document && (
            <div>
              {L.document}: {client.document}
            </div>
          )}
          {(client?.address || client?.city) && (
            <div>
              {L.address}: {[client?.address, client?.city].filter(Boolean).join(", ")}
            </div>
          )}
          {client?.email && <div>Email: {client.email}</div>}
          {client?.phone && <div>Tel: {client.phone}</div>}
        </div>

        <div style={sectionTitle}>{L.object}</div>
        <div style={{ whiteSpace: "pre-wrap", textAlign: "justify" }}>
          {devis.scope_description || devis.description || devis.meeting_summary || "—"}
        </div>

        {scopeItems.length > 0 && (
          <>
            <div style={{ ...sectionTitle, marginTop: "18px", borderBottom: "none", fontSize: "12px" }}>
              {L.scope}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {scopeItems.map((it) => (
                <div
                  key={it.letter}
                  style={{
                    border: "1px solid #e5d8b8",
                    borderLeft: "3px solid #c9a24a",
                    padding: "10px 12px",
                    background: "#fbf8f1",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                    <span>
                      {it.letter}) {it.title}
                    </span>
                    {it.amount !== undefined && <span>{fmtBRL(it.amount)}</span>}
                  </div>
                  {it.description && (
                    <div style={{ marginTop: "4px", fontSize: "11px", color: "#444", textAlign: "justify" }}>
                      {it.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div style={sectionTitle}>{L.fees}</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <tbody>
            <tr>
              <td style={{ padding: "6px 0", borderBottom: "1px dashed #ccc" }}>{L.total}</td>
              <td
                style={{
                  padding: "6px 0",
                  borderBottom: "1px dashed #ccc",
                  textAlign: "right",
                  fontWeight: 700,
                }}
              >
                {fmtBRL(total)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "6px 0", borderBottom: "1px dashed #ccc" }}>{L.down}</td>
              <td
                style={{
                  padding: "6px 0",
                  borderBottom: "1px dashed #ccc",
                  textAlign: "right",
                }}
              >
                {fmtBRL(down)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "6px 0" }}>{L.balance}</td>
              <td style={{ padding: "6px 0", textAlign: "right" }}>{fmtBRL(balance)}</td>
            </tr>
          </tbody>
        </table>

        <div style={sectionTitle}>{L.deadline}</div>
        <div>
          {L.deadlineLabel}: <strong>{fmtDate(devis.deadline_date)}</strong>
        </div>

        <Footer pageNum={1} totalPages={2} />
      </div>

      {/* PÁGINA 2 — assinaturas */}
      <div className="devis-pdf-page" style={{ ...pageStyle, pageBreakBefore: "always" }}>
        <Header />

        <div style={sectionTitle}>{L.signatures}</div>
        <div style={{ marginTop: "60px", textAlign: "center" }}>
          <div style={{ borderTop: "1px solid #1a1a1a", width: "70%", margin: "0 auto" }} />
          <div style={{ marginTop: "6px", fontWeight: 700 }}>{contractor.name}</div>
          <div style={{ fontSize: "10px", color: "#666" }}>{L.contractor}</div>
        </div>

        <div style={{ marginTop: "70px", textAlign: "center" }}>
          <div style={{ borderTop: "1px solid #1a1a1a", width: "70%", margin: "0 auto" }} />
          <div style={{ marginTop: "6px", fontWeight: 700 }}>{client?.name || "—"}</div>
          <div style={{ fontSize: "10px", color: "#666" }}>{L.client}</div>
        </div>

        <div style={{ ...sectionTitle, marginTop: "60px" }}>{L.witnesses}</div>
        {[1, 2].map((i) => (
          <div key={i} style={{ marginTop: "40px" }}>
            <div style={{ display: "flex", gap: "30px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ borderBottom: "1px solid #1a1a1a", height: "20px" }} />
                <div style={{ fontSize: "10px", color: "#666", marginTop: "4px" }}>
                  {L.name} ({i})
                </div>
              </div>
              <div style={{ width: "180px" }}>
                <div style={{ borderBottom: "1px solid #1a1a1a", height: "20px" }} />
                <div style={{ fontSize: "10px", color: "#666", marginTop: "4px" }}>{L.cpf}</div>
              </div>
            </div>
            <div style={{ marginTop: "16px" }}>
              <div style={{ borderBottom: "1px solid #1a1a1a", height: "20px" }} />
              <div style={{ fontSize: "10px", color: "#666", marginTop: "4px" }}>{L.signature}</div>
            </div>
          </div>
        ))}

        <Footer pageNum={2} totalPages={2} />
      </div>
    </div>
  );
}
