import windowIso from "../windowIso"
import { detectEnv, isProd } from "./detectEnv"

const defaultText = 'Feedback Management Tool | ClearFlask'
const titleSuffix = ' | ClearFlask: Feedback Management Tool'
const titleSuffixShort = ' | ClearFlask'

function setTitle(text?: string, forceShort?: boolean) {
  if (windowIso.isSsr) return;
  var title = isProd() ? '' : detectEnv() + '> '
  if (text) {
    if (text.length < 16 && !forceShort) {
      title += text + titleSuffix
    } else {
      title += text + titleSuffixShort
    }
  } else {
    title += defaultText
  }
  windowIso.document.title = title;
}

export function setAppTitle(projectName: string, text?: string) {
  if (windowIso.isSsr) return;
  var title = isProd() ? '' : detectEnv() + '> '
  if (text) {
    title += text + ' | ' + projectName
  } else {
    title += projectName;
  }
  windowIso.document.title = title;
}

export const SetTitle = (props: { title?: string, forceShort?: boolean }) => {
  setTitle(props.title, props.forceShort);
  return null;
};

export default setTitle;
