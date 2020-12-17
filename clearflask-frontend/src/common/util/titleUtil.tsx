import { detectEnv, isProd } from "./detectEnv"

const defaultText = 'Feedback Management Tool | ClearFlask' // NOTE: If changed, change index.html title too
const titleSuffix = ' | ClearFlask: Feedback Management Tool'
const titleSuffixShort = ' | ClearFlask'

function setTitle(text?: string, forceShort?: boolean, suppressSufix?: boolean) {
  var title = isProd() ? '' : detectEnv() + '> '
  if (text) {
    if (suppressSufix) {
      title += text
    } else if (text.length < 16 && !forceShort) {
      title += text + titleSuffix
    } else {
      title += text + titleSuffixShort
    }
  } else {
    title += defaultText
  }
  document.title = title;
}

export const SetTitle = (props: { title?: string, forceShort?: boolean }) => {
  setTitle(props.title, props.forceShort);
  return null;
};

export default setTitle;
