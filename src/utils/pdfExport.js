import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function hexToRgbColor(hexStr) {
  const fallback = rgb(0, 0, 0);
  if (!hexStr || typeof hexStr !== 'string') return fallback;
  const cleanHex = hexStr.replace('#', '');
  try {
    const r = parseInt(cleanHex.length === 3 ? cleanHex[0]+cleanHex[0] : cleanHex.slice(0, 2), 16) / 255;
    const g = parseInt(cleanHex.length === 3 ? cleanHex[1]+cleanHex[1] : cleanHex.slice(2, 4), 16) / 255;
    const b = parseInt(cleanHex.length === 3 ? cleanHex[2]+cleanHex[2] : cleanHex.slice(4, 6), 16) / 255;
    return isNaN(r) ? fallback : rgb(r, g, b);
  } catch (e) { return fallback; }
}

export async function exportPDFWithAnnotations(pdfDoc, annotationsMap, pageDimensions, fileName) {
  try {
    if (!pdfDoc) return false;
    const originalBytes = await pdfDoc.getData();
    const newDoc = await PDFDocument.load(originalBytes);
    const pages = newDoc.getPages();
    const font = await newDoc.embedFont(StandardFonts.Helvetica);

    for (const [pageNumStr, objects] of Object.entries(annotationsMap)) {
      const pageIdx = parseInt(pageNumStr) - 1;
      const page = pages[pageIdx];
      if (!page) continue;

      const scaleX = page.getWidth() / pageDimensions.width;
      const scaleY = page.getHeight() / pageDimensions.height;

      for (const obj of objects) {
        const x = obj.left * scaleX;
        const y = (pageDimensions.height - obj.top - (obj.height * obj.scaleY || 0)) * scaleY;
        const color = hexToRgbColor(obj.stroke || obj.fill);

        if (obj.type === 'rect') {
          page.drawRectangle({
            x, y, width: obj.width * obj.scaleX * scaleX, height: obj.height * obj.scaleY * scaleY,
            borderColor: color, borderWidth: (obj.strokeWidth || 2) * scaleY
          });
        } else if (obj.type === 'textbox' || obj.type === 'i-text') {
          page.drawText(obj.text || '', {
            x: x + 2, y: y + 2, size: (obj.fontSize || 16) * scaleY, font, color
          });
        }
      }
    }
    
    const pdfBytes = await newDoc.save();
    const finalName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = finalName; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) { console.error(err); return false; }
}