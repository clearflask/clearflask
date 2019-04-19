const dictionary = "abcdefghijklmnopqrstuvwxyz";
const space = ' ';

export const fillerText = (wordCountMin:number, wordCountMax:number, wordLenMin:number, wordLenMax:number):string => {
  let wordCount = wordCountMin + Math.random() * (wordCountMax - wordCountMin);
  let text = '';
  for(let j=0;j<wordCount;j++) {
    let wordLen = wordLenMin + Math.random() * (wordLenMax - wordLenMin);
    for(let j=0;j<wordLen;j++) {
      text += dictionary.charAt(Math.floor(Math.random() * dictionary.length));
    }
    text += space;
  }
  return text;
}
