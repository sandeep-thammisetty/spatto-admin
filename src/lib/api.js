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

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchElementTypes() {
  return get('/api/element-types');
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

export async function createGlobalElement(payload) {
  return post('/api/admin/elements', payload);
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
