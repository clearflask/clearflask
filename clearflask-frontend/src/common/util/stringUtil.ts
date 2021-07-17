
export function truncateWithElipsis(maxLength: number, text: string): string {
  if (text.length <= maxLength || maxLength <= 3) {
    return text;
  } else {
    return text.substring(0, maxLength - 3) + '...';
  }
}

export function capitalize<T extends string | undefined>(text: T): T {
  if (text === undefined) return undefined as T;
  if (!text.length) return text;
  return text[0].toUpperCase() + text.slice(1) as T;
}
