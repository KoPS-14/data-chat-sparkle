import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export function DownloadSummaryPDF({ selectedChartIds = [], includePreview = true, includeSummary = true }: { selectedChartIds?: string[]; includePreview?: boolean; includeSummary?: boolean }) {
  const handleDownload = async () => {
    try {
      toast({ title: "Generating PDF", description: "Compiling summary and charts…" });

      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      let isFirstPage = true;

      // Temporarily override truncation and max-width so the PDF includes full words
      const style = document.createElement("style");
      style.id = "pdf-print-overrides";
      style.textContent = `
        #summary-section .truncate { overflow: visible !important; white-space: normal !important; text-overflow: clip !important; }
        #summary-section [class*="max-w-"] { max-width: none !important; }
        #summary-section, #data-preview-section { background: #ffffff !important; }
      `;
      document.head.appendChild(style);

      async function addElementAsPage(el: HTMLElement) {
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
        const imgData = canvas.toDataURL("image/png");
        const imgWidth = pageWidth - 40; // margins
        const ratio = imgWidth / canvas.width;
        const imgHeight = canvas.height * ratio;

        if (!isFirstPage) pdf.addPage();
        isFirstPage = false;
        pdf.addImage(imgData, "PNG", 20, 20, imgWidth, Math.min(imgHeight, pageHeight - 40));
      }

      if (includePreview) {
        const preview = document.getElementById("data-preview-section");
        if (preview) await addElementAsPage(preview as HTMLElement);
      }
      if (includeSummary) {
        const summary = document.getElementById("summary-section");
        if (summary) await addElementAsPage(summary as HTMLElement);
      }

      // Only export selected charts
      for (const id of selectedChartIds) {
        const el = document.getElementById(id);
        if (el) await addElementAsPage(el);
      }

      pdf.save("survey-summary.pdf");
      toast({ title: "PDF ready", description: "Downloaded survey-summary.pdf" });
    } catch (e: any) {
      toast({ title: "PDF error", description: e.message || "Failed to generate PDF" });
    } finally {
      // Remove temporary print overrides
      const s = document.getElementById("pdf-print-overrides");
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }
  };

  return (
    <Button variant="outline" onClick={handleDownload} aria-label="Download summary as PDF">
      Download PDF
    </Button>
  );
}
