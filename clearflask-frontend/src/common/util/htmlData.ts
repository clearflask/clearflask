import windowIso from '../windowIso';

export function htmlDataCreate(id: string, data: any): string {
  return `<script id="${id}" type="application/json">${JSON.stringify(data)}</script>`;
}

export function htmlDataRetrieve(id: string): any {
  if (windowIso.isSsr) return undefined;
  const el = windowIso.document.getElementById(id);
  if (!el) return undefined;
  try {
    return JSON.parse(el.innerHTML);
  } catch (e) {
    return undefined;
  }
}
