
import { ContentState, convertFromRaw, convertToRaw } from 'draft-js';

export function textToRaw<T>(text: string): string {
  return JSON.stringify(convertToRaw(ContentState.createFromText(text)));
}

export function rawToText<T>(raw: string): string {
  var state: ContentState | undefined = undefined;
  try {
    state = convertFromRaw(JSON.parse(raw));
  } catch (er) {
    return '';
  }
  return state.getPlainText();
}
