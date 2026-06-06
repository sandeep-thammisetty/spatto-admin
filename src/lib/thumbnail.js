// Crop a captured PNG to its non-transparent bounds and scale to fill ~80% of a 512² frame,
// so element thumbnails frame consistently regardless of how the 3D capture was composed.
// Shared by the Piping Calibrator (pattern creation) and Manage Elements (regenerate).
export function normalizeThumbnail(blob) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const src = document.createElement('canvas');
      src.width = img.width; src.height = img.height;
      const sCtx = src.getContext('2d');
      sCtx.drawImage(img, 0, 0);
      const { data } = sCtx.getImageData(0, 0, src.width, src.height);
      let minX = src.width, minY = src.height, maxX = 0, maxY = 0;
      for (let y = 0; y < src.height; y++) {
        for (let x = 0; x < src.width; x++) {
          if (data[(y * src.width + x) * 4 + 3] > 10) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      const OUT = 512, FILL = 0.8;
      const out = document.createElement('canvas');
      out.width = OUT; out.height = OUT;
      const oCtx = out.getContext('2d');
      if (maxX >= minX && maxY >= minY) {
        const cw = maxX - minX + 1, ch = maxY - minY + 1;
        const scale = (OUT * FILL) / Math.max(cw, ch);
        const dw = cw * scale, dh = ch * scale;
        oCtx.drawImage(src, minX, minY, cw, ch, (OUT - dw) / 2, (OUT - dh) / 2, dw, dh);
      }
      out.toBlob(resolve, 'image/png');
    };
    img.src = URL.createObjectURL(blob);
  });
}
