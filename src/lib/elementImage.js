import { removeBg } from './api.js';
import { normalizeThumbnail } from './thumbnail.js';

// Turn a raw 2D image (an upload, or a 3D-preview capture) into an element's master image: optionally
// background-removed, then normalized (cropped to content + centred at 80% of a square). The result is
// used as BOTH image_url (the rendered sticker) and thumbnail_url — the server bakes the small picker
// (thumb_key) from it. The ONE 2D-image pipeline, shared by AddElement (create) and ManageElements
// (replace) so the two screens can't drift. remove.bg failure falls back to the original, still
// normalized. 1024 keeps placed stickers crisp; the picker still loads the server's 256 bake.
const ELEMENT_IMAGE_DIM = 1024;
export async function prepareElementImage(blob, { removeBgEnabled = true } = {}) {
  let processed = blob;
  if (removeBgEnabled) {
    try { processed = await removeBg(blob); } catch { /* keep original on remove.bg failure */ }
  }
  return normalizeThumbnail(processed, ELEMENT_IMAGE_DIM);
}
