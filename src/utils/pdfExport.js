import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Helper to convert hexadecimal color codes to pdf-lib RGB structures
function hexToRgbColor(hexStr) {
  if (!hexStr || typeof hexStr !== 'string') return rgb(0, 0, 0);
  const cleanHex = hexStr.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16) / 255;
    const g = parseInt(cleanHex[1] + cleanHex[1], 16) / 255;
    const b = parseInt(cleanHex[2] + cleanHex[2], 16) / 255;
    return rgb(r, g, b);
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
    const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
    const b = parseInt(cleanHex.slice(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  return rgb(0, 0, 0);
}

export async function exportPDFWithAnnotations(pdfDoc, annotationsMap, pageDimensions) {
  try {
    if (!pdfDoc) throw new Error("No PDF loaded.");
    
    const originalBytes = await pdfDoc.getData();
    const newDoc = await PDFDocument.load(originalBytes);
    const pages = newDoc.getPages();
    const standardFont = await newDoc.embedFont(StandardFonts.Helvetica);

    for (const [pageNumStr, objects] of Object.entries(annotationsMap)) {
      const pageIdx = parseInt(pageNumStr) - 1;
      if (pageIdx >= pages.length || pageIdx < 0) continue;
      const page = pages[pageIdx];
      const { width: origW, height: origH } = pageDimensions;
      const scaleX = page.getWidth() / origW;
      const scaleY = page.getHeight() / origH;

      for (const obj of objects) {
        const left = obj.left * scaleX;
        const top = (origH - obj.top - (obj.height || 0)) * scaleY;
        const w = (obj.width || 0) * scaleX;
        const h = (obj.height || 0) * scaleY;

        const colorHex = obj.stroke || obj.fill || '#000000';
        const paintColor = hexToRgbColor(colorHex);

        if (obj.type === 'rect') {
          page.drawRectangle({
            x: left,
            y: top,
            width: w,
            height: h,
            borderColor: paintColor,
            borderWidth: (obj.strokeWidth || 2) * scaleY
          });
        } else if (obj.type === 'textbox' || obj.type === 'i-text') {
          page.drawText(obj.text || '', {
            x: left + 4 * scaleX,
            y: top + h - (obj.fontSize || 20) * scaleY,
            size: (obj.fontSize || 16) * scaleY,
            font: standardFont,
            color: paintColor
          });
        } else if (obj.type === 'path' && obj.path) {
          let pts = [];
          for (let i = 0; i < obj.path.length; i++) {
            const cmd = obj.path[i][0];
            const coords = obj.path[i].slice(1);
            if (cmd === 'M') {
              pts = [{ x: coords[0], y: coords[1] }];
            } else if (cmd === 'L') {
              pts.push({ x: coords[0], y: coords[1] });
            } else if (cmd === 'C') {
              const p0 = pts[pts.length - 1];
              const p1 = { x: coords[0], y: coords[1] };
              const p2 = { x: coords[2], y: coords[3] };
              const p3 = { x: coords[4], y: coords[5] };
              for (let t = 1; t <= 10; t++) {
                const tt = t / 10;
                const t0 = 1 - tt;
                const x = t0 ** 3 * p0.x + 3 * t0 ** 2 * tt * p1.x + 3 * t0 * tt ** 2 * p2.x + tt ** 3 * p3.x;
                const y = t0 ** 3 * p0.y + 3 * t0 ** 2 * tt * p1.y + 3 * t0 * tt ** 2 * p2.y + tt ** 3 * p3.y;
                pts.push({ x, y });
              }
            }
          }
          for (let i = 1; i < pts.length; i++) {
            page.drawLine({
              start: { x: pts[i - 1].x * scaleX, y: (origH - pts[i - 1].y) * scaleY },
              end: { x: pts[i].x * scaleX, y: (origH - pts[i].y) * scaleY },
              thickness: (obj.strokeWidth || 2) * scaleY,
              color: paintColor
            });
          }
        }
      }
    }
    const pdfBytes = await newDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'annotated_document.pdf';
    link.click();
    URL.revokeObjectURL(link.href);
    return true;
  } catch (err) {
    console.error(err);
    throw err;
  }
}