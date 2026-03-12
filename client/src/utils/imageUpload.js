const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

export async function readImageAsDataUrl(file, maxBytes = DEFAULT_MAX_BYTES) {
  if (!file) return '';
  if (!String(file.type || '').toLowerCase().startsWith('image/')) {
    throw new Error('Please choose a valid image file.');
  }
  if (Number(file.size || 0) > maxBytes) {
    throw new Error(`Image size should be under ${Math.round(maxBytes / (1024 * 1024))}MB.`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected image.'));
    reader.readAsDataURL(file);
  });
}

export function appendImageToCsv(existingCsv = '', nextImage = '') {
  const items = String(existingCsv || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
  if (nextImage) items.push(String(nextImage).trim());
  return items.join('\n');
}
