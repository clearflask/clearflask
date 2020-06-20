
import { ContentState, convertToRaw } from 'draft-js';

export function textToRaw<T>(text: string): string {
  return JSON.stringify(convertToRaw(ContentState.createFromText(text)));
}
