import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import createLinkifyPlugin from 'draft-js-linkify-plugin';
import Editor, { PluginEditorProps as EditorProps } from 'draft-js-plugins-editor';
import 'draft-js/dist/Draft.css';
import React from 'react';
import { contentScrollApplyStyles, Side } from './ContentScroll';

const plugins = [
  createLinkifyPlugin({
    target: '_blank',
    rel: 'noreferrer noopener ugc',
  }),
];

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
      },
    },
    '& a': {
      color: 'unset',
      borderBottom: '1px dashed',
      textDecoration: 'none',
    },
  },
  editorWrapperEditable: {
  },
  editorWrapperReadonly: {
    '& a': {
      cursor: 'pointer',
      '&:hover': {
        borderBottomStyle: 'solid',
      },
    },
  },
  blockQuote: {
    paddingLeft: theme.spacing(1),
    margin: theme.spacing(0, 0, 0, 0.5),
    color: theme.palette.text.secondary,
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
  componentDidCatch() {
    this.forceUpdate();
  }

  render() {
    const { editorRef, theme, classes, ...editorProps } = this.props;
    return (
      <div className={classNames(
        this.props.classes.editorWrapper,
        this.props.readOnly ? this.props.classes.editorWrapperReadonly : this.props.classes.editorWrapperEditable,
      )}>
        <Editor
          ref={editorRef}
          {...editorProps}
          plugins={plugins}
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
