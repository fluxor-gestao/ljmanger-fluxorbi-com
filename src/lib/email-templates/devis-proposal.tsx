import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

type Lang = "pt" | "fr" | "en" | "es";

const I18N: Record<
  Lang,
  { tagline: string; cta_help: string; accept: string; reject: string; pdf: string }
> = {
  pt: {
    tagline: "ADVOCACIA & CONSULTORIA INTERNACIONAL",
    cta_help: "Você pode aceitar ou recusar a proposta clicando nos botões abaixo.",
    accept: "Aceitar Proposta",
    reject: "Recusar",
    pdf: "Baixar Proposta (PDF)",
  },
  fr: {
    tagline: "AVOCATS & CONSEIL INTERNATIONAL",
    cta_help:
      "Vous pouvez accepter ou refuser la proposition en cliquant sur les boutons ci-dessous.",
    accept: "Accepter la Proposition",
    reject: "Refuser",
    pdf: "Télécharger la proposition (PDF)",
  },
  en: {
    tagline: "INTERNATIONAL LAW & CONSULTING",
    cta_help: "You can accept or reject the proposal by clicking the buttons below.",
    accept: "Accept Proposal",
    reject: "Reject",
    pdf: "Download Proposal (PDF)",
  },
  es: {
    tagline: "ABOGADOS & CONSULTORÍA INTERNACIONAL",
    cta_help: "Puede aceptar o rechazar la propuesta haciendo clic en los botones a continuación.",
    accept: "Aceptar la Propuesta",
    reject: "Rechazar",
    pdf: "Descargar Propuesta (PDF)",
  },
};

interface DevisProposalProps {
  messageText?: string;
  acceptUrl?: string;
  pdfUrl?: string;
  language?: Lang;
}

const DevisProposalEmail = ({
  messageText = "",
  acceptUrl,
  pdfUrl,
  language = "pt",
}: DevisProposalProps) => {
  const t = I18N[language] ?? I18N.pt;
  return (
    <Html lang={language} dir="ltr">
      <Head />
      <Preview>Lundgaard Jensen — {t.tagline}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={brand}>LUNDGAARD JENSEN</Heading>
            <Text style={tagline}>{t.tagline}</Text>
            <Hr style={goldRule} />
          </Section>

          <Section style={bodySection}>
            <Text style={messageStyle}>{messageText}</Text>
          </Section>

          {acceptUrl ? (
            <Section style={ctaSection}>
              <Text style={ctaHelp}>{t.cta_help}</Text>
              <table role="presentation" align="center" cellPadding={0} cellSpacing={0}>
                <tbody>
                  <tr>
                    <td style={{ padding: "0 6px" }}>
                      <Button href={acceptUrl} style={acceptBtn}>
                        {t.accept}
                      </Button>
                    </td>
                    <td style={{ padding: "0 6px" }}>
                      <Button href={acceptUrl} style={rejectBtn}>
                        {t.reject}
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          ) : null}

          {pdfUrl ? (
            <Section style={{ textAlign: "center", padding: "0 36px 24px" }}>
              <Button href={pdfUrl} style={pdfBtn}>
                📎 {t.pdf}
              </Button>
            </Section>
          ) : null}

          <Section style={{ padding: "0 36px 24px" }}>
            <Hr style={divider} />
            <Text style={footer}>
              Rua João Cordeiro, 831 — Praia de Iracema
              <br />
              +55 (85) 9 9406-6042 &nbsp;|&nbsp; +55 (85) 9 3037-9931
              <br />
              <Link href="https://lundgaardjensen.com" style={footerLink}>
                lundgaardjensen.com
              </Link>{" "}
              &nbsp;|&nbsp; @lundgaard.jensen
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: DevisProposalEmail,
  subject: (data: Record<string, any>) =>
    data?.subject || `Proposta ${data?.devisNumber || ""} — Lundgaard Jensen`,
  displayName: "Proposta Lundgaard Jensen",
  previewData: {
    messageText:
      "Prezado(a) Cliente,\n\nSegue em anexo a proposta DE202601001 da Lundgaard Jensen.\n\nAtenciosamente,\nEquipe Lundgaard Jensen",
    acceptUrl: "https://example.com/proposta/aceite/preview",
    pdfUrl: "https://example.com/proposta.pdf",
    language: "pt",
    devisNumber: "DE202601001",
  },
} satisfies TemplateEntry;

const main: React.CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily: "Arial, sans-serif",
  color: "#1f2937",
  margin: 0,
  padding: 0,
};
const container: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
};
const header: React.CSSProperties = { padding: "28px 36px 0" };
const brand: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "22px",
  fontWeight: 700,
  letterSpacing: "2px",
  color: "#0f172a",
  margin: 0,
};
const tagline: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "3px",
  color: "#1e40af",
  margin: "4px 0 0",
};
const goldRule: React.CSSProperties = {
  border: "none",
  borderTop: "2px solid #c8a96a",
  margin: "14px 0 0",
};
const bodySection: React.CSSProperties = { padding: "24px 36px 8px" };
const messageStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  lineHeight: 1.65,
  fontSize: "14px",
  color: "#1f2937",
  margin: 0,
};
const ctaSection: React.CSSProperties = { padding: "8px 36px 24px", textAlign: "center" as const };
const ctaHelp: React.CSSProperties = {
  margin: "12px 0 14px",
  fontSize: "13px",
  color: "#4b5563",
  textAlign: "center" as const,
};
const acceptBtn: React.CSSProperties = {
  backgroundColor: "#16a34a",
  color: "#ffffff",
  padding: "13px 28px",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: 600,
  fontFamily: "Arial, sans-serif",
  fontSize: "14px",
};
const rejectBtn: React.CSSProperties = {
  backgroundColor: "#ffffff",
  color: "#dc2626",
  padding: "12px 28px",
  border: "1px solid #dc2626",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: 600,
  fontFamily: "Arial, sans-serif",
  fontSize: "14px",
};
const pdfBtn: React.CSSProperties = {
  backgroundColor: "#0f172a",
  color: "#ffffff",
  padding: "11px 22px",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: 600,
  fontFamily: "Arial, sans-serif",
  fontSize: "13px",
};
const divider: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid #e5e7eb",
  margin: "0 0 14px",
};
const footer: React.CSSProperties = {
  fontSize: "11px",
  color: "#6b7280",
  lineHeight: 1.6,
  margin: 0,
};
const footerLink: React.CSSProperties = { color: "#1e40af", textDecoration: "none" };
