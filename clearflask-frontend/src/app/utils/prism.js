// From: https://raw.githubusercontent.com/mui-org/material-ui/master/docs/src/modules/components/prism.js
/* eslint-disable import/no-mutable-exports, global-require */
import prism from 'prismjs';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-diff';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';

export function highlight(code, lang) {
  let language;
  switch (lang) {
    case 'diff':
      language = 'diff';
      break;
    case 'css':
      language = 'css';
      break;
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'javascript':
      language = 'jsx';
      break;
    case 'json':
      language = 'json';
      break;
    case 'java':
      language = 'java';
      break;
    case 'python':
      language = 'python';
      break;
    case 'sql':
      language = 'sql';
      break;
    case 'cpp':
    case 'c':
    case 'c++':
    case 'c#':
      language = 'clike';
      break;
    default:
      language = 'markup';
      break;
  }
  return prism.highlight(code, prism.languages[language], '');
}

export default prism;