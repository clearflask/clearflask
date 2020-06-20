import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Editor, EditorProps } from 'draft-js';
import 'draft-js/dist/Draft.css';
import React from 'react';
import { contentScrollApplyStyles, Side } from './ContentScroll';

const contentBackgroundColor = (theme: Theme): string => theme.palette.grey[theme.palette.type === 'dark' ? 900 : 100];
const styles = (theme: Theme) => createStyles({
  editorWrapper: {
    '& .DraftEditor-editorContainer .public-DraftStyleDefault-pre': {
      margin: theme.spacing(1, 0),
      backgroundColor: contentBackgroundColor(theme),
      ...(contentScrollApplyStyles(theme, Side.Center, false, contentBackgroundColor(theme))),
      borderRadius: 4,
      marginLeft: theme.spacing(0.5),
      padding: theme.spacing(1.5),
      '& .public-DraftStyleDefault-block': {
        whiteSpace: 'pre!important',
      }
    },
  },
  blockQuote: {
    paddingLeft: theme.spacing(1),
    margin: theme.spacing(0, 0, 0, 0.5),
    color: theme.palette.text.hint,
    borderLeft: '5px solid ' + contentBackgroundColor(theme),
  },
  codeblock: {
    margin: 0,
  },
});
interface Props {
  editorRef?: React.Ref<Editor>;
}
class StyledDraftJsEditor extends React.Component<Props & EditorProps & WithStyles<typeof styles, true>> {
  render() {
    const { editorRef, theme, classes, ...editorProps } = this.props;
    return (
      <div className={this.props.classes.editorWrapper}>
        <Editor
          ref={editorRef}
          {...editorProps}
          blockStyleFn={contentBlock => {
            switch (contentBlock.getType()) {
              case 'blockquote':
                return this.props.classes.blockQuote;
              case 'code-block':
                return this.props.classes.codeblock;
              default:
                return '';
            }
          }}
        />
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(StyledDraftJsEditor);
