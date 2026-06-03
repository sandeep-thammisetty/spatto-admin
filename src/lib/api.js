import { supabase } from './supabase.js';

const BASE_URL = import.meta.env.VITE_API_URL;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export async function removeBg(blob) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BASE_URL}/api/admin/remove-bg`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': blob.type || 'image/png',
    },
    body: blob,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.blob(); // returns PNG Blob with transparent background
}

async function parseError(res) {
  const text = await res.text();
  try { return JSON.parse(text).error ?? res.statusText; } catch { return res.statusText; }
}

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function patch(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export { get };

export async function fetchElementTypes() {
  return get('/api/element-types');
}

export async function fetchAdminElementTypes() {
  return get('/api/admin/element-types');
}

export async function createElementType(payload) {
  return post('/api/admin/element-types', payload);
}

export async function updateElementType(id, payload) {
  const res = await fetch(`${BASE_URL}/api/admin/element-types/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchParentElements(elementTypeId) {
  return get(`/api/elements?parents_only=true&element_type_id=${elementTypeId}`);
}

export async function getSignedUploadUrl(folder, filename, contentType) {
  return post('/api/storage/sign-upload', { folder, filename, contentType });
}

export async function uploadToR2(signedUrl, file) {
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error('Upload to R2 failed');
}

export async function fetchAllElements() {
  return get('/api/admin/elements');
}

export async function createGlobalElement(payload) {
  return post('/api/admin/elements', payload);
}

export async function updateGlobalElement(id, payload) {
  const res = await fetch(`${BASE_URL}/api/admin/elements/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchAdminTemplates() {
  return get('/api/admin/templates');
}

export async function createTemplate(payload) {
  return post('/api/admin/templates', payload);
}

export async function deleteTemplate(id) {
  const res = await fetch(`${BASE_URL}/api/admin/templates/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function updateTemplate(id, payload) {
  const res = await fetch(`${BASE_URL}/api/admin/templates/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function createBaker(payload) {
  return post('/api/admin/bakers', payload);
}

export async function fetchAdminBakers() {
  return get('/api/admin/bakers');
}

export async function createPattern(payload) {
  return post('/api/admin/patterns', payload);
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function fetchAllTags() {
  return get('/api/admin/tags');
}

export async function createTag(payload) {
  return post('/api/admin/tags', payload);
}

export async function updateTag(id, payload) {
  return patch(`/api/admin/tags/${id}`, payload);
}

export async function deleteTag(id) {
  const res = await fetch(`${BASE_URL}/api/admin/tags/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchElementTags(elementId) {
  return get(`/api/admin/elements/${elementId}/tags`);
}

export async function saveElementTags(elementId, tagIds) {
  const res = await fetch(`${BASE_URL}/api/admin/elements/${elementId}/tags`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ tagIds }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function retagElement(elementId) {
  return post(`/api/admin/elements/${elementId}/retag`, {});
}

export async function fetchTemplateTags(templateId) {
  return get(`/api/admin/templates/${templateId}/tags`);
}

export async function saveTemplateTags(templateId, tagIds) {
  const res = await fetch(`${BASE_URL}/api/admin/templates/${templateId}/tags`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify({ tagIds }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchTemplateAttrs(templateId) {
  return get(`/api/admin/templates/${templateId}/attrs`);
}

export async function saveTemplateAttrs(templateId, attrs) {
  const res = await fetch(`${BASE_URL}/api/admin/templates/${templateId}/attrs`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(attrs),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function suggestElementMeta(thumbnailBlob, elementType) {
  const arrayBuffer = await thumbnailBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const base64 = btoa(binary);
  const res = await fetch(`${BASE_URL}/api/admin/elements/suggest`, {
    method: 'POST',
    headers: { ...await authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mimeType: thumbnailBlob.type || 'image/png', elementType }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

