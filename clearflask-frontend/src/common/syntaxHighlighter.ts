import html from 'react-syntax-highlighter/dist/esm/languages/hljs/htmlbars';
import yaml from 'react-syntax-highlighter/dist/esm/languages/hljs/yaml';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/light';
import stackoverflowDark from 'react-syntax-highlighter/dist/esm/styles/hljs/stackoverflow-dark';
import stackoverflowLight from 'react-syntax-highlighter/dist/esm/styles/hljs/stackoverflow-light';

SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('html', html);

export default SyntaxHighlighter;
export { stackoverflowDark as highlightStyleDark, stackoverflowLight as highlightStyleLight };
