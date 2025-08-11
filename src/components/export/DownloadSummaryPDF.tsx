import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export function DownloadSummaryPDF() {
  const handleDownload = async () => {
    try {
      toast({ title: "Generating PDF", description: "Compiling summary and charts…" });

      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      let isFirstPage = true;

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

      const summary = document.getElementById("summary-section");
      if (summary) await addElementAsPage(summary as HTMLElement);

      const charts = Array.from(document.querySelectorAll<HTMLElement>("[data-export='chart']"));
      for (const el of charts) {
        await addElementAsPage(el);
      }

      pdf.save("survey-summary.pdf");
      toast({ title: "PDF ready", description: "Downloaded survey-summary.pdf" });
    } catch (e: any) {
      toast({ title: "PDF error", description: e.message || "Failed to generate PDF" });
    }
  };

  return (
    <Button variant="outline" onClick={handleDownload} aria-label="Download summary as PDF">
      Download PDF
    </Button>
  );
}
