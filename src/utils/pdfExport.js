import { PDFDocument } from 'pdf-lib';

/**
 * Hybrid Export Engine
 * Replaces edited pages with high-res flattened images (Redaction)
 * Keeps unedited pages as original vectors (Quality)
 */
export async function exportPDFWithAnnotations(pdfDoc, canvasImages, fileName) {
  try {
    if (!pdfDoc) return false;
    
    const originalBytes = await pdfDoc.getData();
    const sourceDoc = await PDFDocument.load(originalBytes);
    const resultDoc = await PDFDocument.create();
    
    const totalPagesCount = sourceDoc.getPageCount();

    for (let i = 0; i < totalPagesCount; i++) {
      const pageNum = i + 1;
      
      // Check if we have a high-res snapshot for this page
      if (canvasImages[pageNum]) {
        const originalPage = sourceDoc.getPage(i);
        const { width, height } = originalPage.getSize();
        
        // Add a fresh page with same dimensions
        const newPage = resultDoc.addPage([width, height]);

        // Embed the PNG snapshot (2.0x scale for crispness)
        const imgData = canvasImages[pageNum];
        const image = await resultDoc.embedPng(imgData);
        
        // Draw the snapshot. This physically replaces the old text/data with pixels.
        newPage.drawImage(image, {
          x: 0,
          y: 0,
          width: width,
          height: height,
        });
      } else {
        // Page wasn't touched - copy original to keep it 100% perfect
        const [copiedPage] = await resultDoc.copyPages(sourceDoc, [i]);
        resultDoc.addPage(copiedPage);
      }
    }

    const pdfBytes = await resultDoc.save();
    const finalName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    
    // Direct Browser Trigger
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalName;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup memory
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 250);

    return true;
  } catch (err) {
    console.error("Master Export Error:", err);
    return false;
  }
}