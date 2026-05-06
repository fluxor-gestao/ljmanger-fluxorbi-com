import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Captura todas as páginas com a classe `.devis-pdf-page` dentro do container
 * e gera um PDF A4 multipágina.
 */
async function buildDevisPdf(container: HTMLElement): Promise<jsPDF> {
  const pages = Array.from(container.querySelectorAll<HTMLElement>(".devis-pdf-page"));
  if (pages.length === 0) throw new Error("Nenhuma página encontrada para exportar");

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    if (i > 0) pdf.addPage();
    const ratio = canvas.height / canvas.width;
    const renderH = pageW * ratio;
    if (renderH <= pageH) {
      pdf.addImage(imgData, "JPEG", 0, 0, pageW, renderH);
    } else {
      const renderW = pageH / ratio;
      pdf.addImage(imgData, "JPEG", (pageW - renderW) / 2, 0, renderW, pageH);
    }
  }
  return pdf;
}

export async function exportDevisPdfFromContainer(container: HTMLElement, fileName: string) {
  const pdf = await buildDevisPdf(container);
  pdf.save(fileName);
}

export async function generateDevisPdfBase64(
  container: HTMLElement,
  fileName: string,
): Promise<{ base64: string; filename: string }> {
  const pdf = await buildDevisPdf(container);
  // jsPDF datauristring: "data:application/pdf;filename=...;base64,XXXX"
  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.split(",")[1] ?? "";
  return { base64, filename: fileName };
}
