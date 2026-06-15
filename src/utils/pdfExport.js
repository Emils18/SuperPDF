import { PDFDocument } from 'pdf-lib';

export async function exportPDFWithAnnotations(pdfDoc, canvasImages, fileName) {
  try {
    if (!pdfDoc) return false;
    const originalBytes = await pdfDoc.getData();
    const sourceDoc = await PDFDocument.load(originalBytes);
    const resultDoc = await PDFDocument.create();
    const totalPagesCount = sourceDoc.getPageCount();

    for (let i = 0; i < totalPagesCount; i++) {
      const pageNum = i + 1;
      if (canvasImages[pageNum]) {
        const originalPage = sourceDoc.getPage(i);
        const { width, height } = originalPage.getSize();
        const newPage = resultDoc.addPage([width, height]);
        const imgData = canvasImages[pageNum];
        const image = await resultDoc.embedPng(imgData);
        // Overwrite old image data with the edited canvas snapshot
        newPage.drawImage(image, { x: 0, y: 0, width: width, height: height });
      } else {
        const [copiedPage] = await resultDoc.copyPages(sourceDoc, [i]);
        resultDoc.addPage(copiedPage);
      }
    }

    const pdfBytes = await resultDoc.save();
    const finalName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url; link.download = finalName; link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 200);
    return true;
  } catch (err) { return false; }
}