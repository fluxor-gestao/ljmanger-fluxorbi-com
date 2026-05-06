// Simple OFX parser (SGML/XML hybrid). Returns normalized bank transactions.
export interface ParsedOfxTx {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // always positive
  direction: "entrada" | "saida";
  raw: Record<string, string>;
}

function getTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function parseOfxDate(raw: string): string | null {
  // Format: YYYYMMDD or YYYYMMDDHHMMSS[.XXX][TZ]
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseOfx(content: string): ParsedOfxTx[] {
  const txBlocks = content.split(/<STMTTRN>/i).slice(1);
  const out: ParsedOfxTx[] = [];

  for (const rawBlock of txBlocks) {
    const block = rawBlock.split(/<\/STMTTRN>/i)[0];
    const dateRaw = getTag(block, "DTPOSTED");
    const amountRaw = getTag(block, "TRNAMT");
    const memo = getTag(block, "MEMO") || "";
    const name = getTag(block, "NAME") || "";
    const fitid = getTag(block, "FITID") || "";
    const trnType = getTag(block, "TRNTYPE") || "";

    if (!dateRaw || !amountRaw) continue;
    const date = parseOfxDate(dateRaw);
    const amount = Number(amountRaw.replace(",", "."));
    if (!date || isNaN(amount)) continue;

    const description = [name, memo].filter(Boolean).join(" - ") || trnType || "Transação";

    out.push({
      date,
      description,
      amount: Math.abs(amount),
      direction: amount >= 0 ? "entrada" : "saida",
      raw: { dateRaw, amountRaw, memo, name, fitid, trnType },
    });
  }

  return out;
}
