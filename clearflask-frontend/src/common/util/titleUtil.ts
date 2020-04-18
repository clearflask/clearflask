import { detectEnv, isProd } from "./detectEnv"

const defaultText = 'ClearFlask: Product Feedback Solution' // NOTE: If changed, change index.html title too
const titleSuffix = ' | ClearFlask: Product Feedback Solution'
const titleSuffixShort = ' | ClearFlask'

function setTitle(text?: string) {
  var title = isProd() ? '' : detectEnv() + '> '
  if (text) {
    if (text.length < 15) {
      title += text + titleSuffix
    } else {
      title += text + titleSuffixShort
    }
  } else {
    title += defaultText
  }
  document.title = title;
}

export default setTitle;
