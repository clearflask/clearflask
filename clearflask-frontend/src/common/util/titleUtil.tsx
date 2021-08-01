// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import windowIso from "../windowIso"
import { detectEnv, isProd } from "./detectEnv"

const defaultText = 'Feedback Management Tool | ClearFlask'
const titleSuffix = ' | ClearFlask: Feedback Management Tool'
const titleSuffixShort = ' | ClearFlask'

function setTitle(text?: string, forceShort?: boolean) {
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
  setTitleIso(title);
}

export function setAppTitle(projectName: string, text?: string) {
  var title = isProd() ? '' : detectEnv() + '> '
  if (text) {
    title += text + ' | ' + projectName
  } else {
    title += projectName;
  }
  setTitleIso(title);
}

export const SetTitle = (props: { title?: string, forceShort?: boolean }) => {
  setTitle(props.title, props.forceShort);
  return null;
};

const setTitleIso = (title: string) => {
  if (windowIso.isSsr) {
    windowIso.setTitle(title);
  } else {
    windowIso.document.title = title;
  }

}

export default setTitle;
