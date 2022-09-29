// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
export function csvPreviewLines(file: File, maxlines: number, encoding = 'utf-8'): Promise<string[][]> {
  return new Promise<string[][]>((onComplete, onError) => {
    var CHUNK_SIZE = 32768;
    var decoder = new TextDecoder(encoding);
    var offset = 0;
    var fileReader = new FileReader();
    var csvState = newState();

    fileReader.onload = function () {
      offset += CHUNK_SIZE;
      const isEnd = offset >= file.size;

      // Use stream:true in case we cut the file in the middle of a multi-byte character
      const results = decoder.decode(fileReader.result as any, { stream: true });
      parseCSV(results, csvState, isEnd);

      if (csvState.arr.length > maxlines) {
        onComplete(csvState.arr.slice(0, maxlines));
      } else if (isEnd) {
        onComplete(csvState.arr);
      } else {
        fileReader.readAsArrayBuffer(file.slice(offset, offset + CHUNK_SIZE));
      }
    };
    fileReader.onerror = function () {
      onError(fileReader.error);
    };
    fileReader.readAsArrayBuffer(file.slice(0, CHUNK_SIZE));
  });
};
interface State {
  isStart: boolean;
  row: number;
  col: number;
  nc?: string;
  skipNext: boolean;
  quote: boolean;  // 'true' means we're inside a quoted field
  arr: string[][],
}
function newState(): State {
  return {
    isStart: true,
    row: 0,
    col: 0,
    skipNext: false,
    quote: false,
    arr: [],
  };
}
function parseCSV(str: string, state: State, isEnd: boolean) {
  // Iterate over each character, keep track of current row and column (of the returned array)
  for (var c = (state.isStart ? 0 : -1); c < str.length - (isEnd ? 0 : 1); c++) {
    var cc;
    if (state.isStart) {
      state.isStart = false;
      cc = str[c];
    } else {
      cc = state.nc!;
    }
    state.nc = str[c + 1];

    // Create a new row if necessary
    // Created on-demand to allow a newline at end of file to be omitted
    if (state.arr[state.row] === undefined) {
      state.arr[state.row] = [];
      state.arr[state.row][state.col] = '';
    }

    if (state.skipNext) {
      state.skipNext = false;
      continue;
    }

    // If the current character is a quotation mark, and we're inside a
    // quoted field, and the next character is also a quotation mark,
    // add a quotation mark to the current column and skip the next character
    if (cc === '"' && state.quote && state.nc === '"') {
      state.arr[state.row][state.col] += cc;
      state.skipNext = true;
      continue;
    }

    // If it's just one quotation mark, begin/end quoted field
    if (cc === '"') {
      state.quote = !state.quote;
      continue;
    }

    // If it's a comma and we're not in a quoted field, move on to the next column
    if (cc === ',' && !state.quote) {
      ++state.col;
      state.arr[state.row][state.col] = '';
      continue;
    }

    // If it's a newline (CRLF) and we're not in a quoted field, skip the next character
    // and move on to the next row and move to column 0 of that new row
    if (cc === '\r' && state.nc === '\n' && !state.quote) {
      ++state.row; state.col = 0;
      state.skipNext = true;
      continue;
    }

    // If it's a newline (LF or CR) and we're not in a quoted field,
    // move on to the next row and move to column 0 of that new row
    if (cc === '\n' && !state.quote) {
      ++state.row;
      state.col = 0;
      continue;
    }
    if (cc === '\r' && !state.quote) {
      ++state.row;
      state.col = 0;
      continue;
    }

    // Otherwise, append the current character to the current column
    state.arr[state.row][state.col] += cc;
  }

  // Remove last empty line
  if (isEnd
    && state.arr.length > 0
    && (state.arr[state.arr.length - 1].length === 0
      || (state.arr[state.arr.length - 1].length === 1 && state.arr[state.arr.length - 1][0].length === 0))) {
    state.arr.pop();
  }
}
