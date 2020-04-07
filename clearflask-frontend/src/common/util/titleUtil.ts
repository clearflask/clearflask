
const defaultText = 'ClearFlask: Product Feedback Solution' // NOTE: If changed, change index.html title too
const titleSuffix = ' | ClearFlask: Product Feedback Solution'
const titleSuffixShort = ' | ClearFlask'

function setTitle(text?: string) {
  if (text) {
    if (text.length < 15) {
      document.title = text + titleSuffix
    } else {
      document.title = text + titleSuffixShort
    }
  } else {
    document.title = defaultText
  }
}

export default setTitle;
