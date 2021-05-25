
const entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

// https://stackoverflow.com/a/12034334
export const escapeHtml = (text?: string): string => {
  if (text === undefined) return '';
  return String(text).replace(/[&<>"'`=\/]/g, (s) => entityMap[s]);
}
