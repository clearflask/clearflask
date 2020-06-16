
export function truncateWithElipsis(maxLength:number, text: string): string {
  if (text.length <= maxLength || maxLength <= 3) {
    return text;
  } else {
    return text.substring(0, maxLength - 3) + '...';
  }
}
