import { detectEnv, isProd } from "./detectEnv"

const defaultText = 'ClearFlask: Product Feedback Solution' // NOTE: If changed, change index.html title too
const titleSuffix = ' | ClearFlask: Product Feedback Solution'
const titleSuffixShort = ' | ClearFlask'

function setTitle(text?: string, forceShort?: boolean) {
  var title = isProd() ? '' : detectEnv() + '> '
  if (text) {
    if (text.length < 15 && !forceShort) {
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
