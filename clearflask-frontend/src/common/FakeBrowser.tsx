import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React from 'react';
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter';
import highlightLanguageHtml from 'react-syntax-highlighter/dist/esm/languages/hljs/htmlbars';
import highlightStyleDark from 'react-syntax-highlighter/dist/esm/styles/hljs/stackoverflow-dark';
import highlightStyleLight from 'react-syntax-highlighter/dist/esm/styles/hljs/stackoverflow-light';
import { contentScrollApplyStyles, Orientation } from './ContentScroll';
import LockSimpleIcon from './icon/LockSimpleIcon';

SyntaxHighlighter.registerLanguage('html', highlightLanguageHtml);

const styles = (theme: Theme) => createStyles({
  container: {
    boxShadow: (props: Props) => `-3px 12px 41px -9px rgba(0,0,0,${props.darkMode ? '.7' : '.2'})`,
    display: 'flex',
    flexDirection: 'column',
    width: (props: Props) => props.fixedWidth,
  },
  navbar: {
    backgroundColor: (props: Props) => theme.palette.grey[props.darkMode ? 500 : 100],
    padding: 5,
    display: 'flex',
  },
  button: {
    backgroundColor: (props: Props) => theme.palette.grey[props.darkMode ? 600 : 300],
    minWidth: 12,
    minHeight: 12,
    borderRadius: 10,
    margin: 5,
    marginRight: 0,
  },
  addrbar: {
    backgroundColor: (props: Props) => props.darkMode ? theme.palette.grey[400] : 'white',
    marginLeft: 10,
    borderRadius: 4,
    padding: '1px 10px',
    color: theme.palette.text.hint,
    display: 'flex',
    alignItems: 'center',
    minWidth: 'max-content',
    width: 200,
  },
  content: {
    backgroundColor: (props: Props) => props.darkMode ? 'black' : 'white',
    flexGrow: 1,
    padding: (props: Props) => props.contentPadding,
    height: (props: Props) => props.fixedHeight,
  },
  lockIcon: {
    fontSize: 13,
    color: (props: Props) => theme.palette.grey[props.darkMode ? 600 : 300],
    marginRight: 5,
  },
  codeContainer: {
    margin: 0,
    borderTopWidth: 5,
    borderTopStyle: 'solid',
    overflowX: 'initial',
    borderTopColor: (props: Props) => theme.palette.grey[props.darkMode ? 500 : 100],
    maxHeight: (props: Props) => props.codeMaxHeight,
  },
});
interface Props {
  className?: string;
  children?: React.ReactNode;
  darkMode?: boolean;
  fixedWidth?: number | string;
  fixedHeight?: number | string;
  contentPadding?: number | string;
  showAddressBar?: boolean;
  addresBarContent?: React.ReactNode;
  codeContent?: string;
  codeLanguage?: 'html';
  codeMaxHeight?: number | string;
}
class FakeBrowser extends React.Component<Props & WithStyles<typeof styles, true>> {
  render() {

    var code;
    if (this.props.codeContent) {
      const backgroundColor = (this.props.darkMode ? highlightStyleDark : highlightStyleLight)?.hljs?.background;
      code = (
        <SyntaxHighlighter
          className={this.props.classes.codeContainer}
          language={this.props.codeLanguage || 'html'}
          customStyle={{
            ...contentScrollApplyStyles({
              theme: this.props.theme,
              backgroundColor,
              orientation: Orientation.Both,
            }),
            backgroundColor,
          }}
          style={this.props.darkMode ? highlightStyleDark : highlightStyleLight}
        >
          {this.props.codeContent}
        </SyntaxHighlighter>
      );
    }

    return (
      <div className={classNames(this.props.classes.container, this.props.className)}>
        <div className={this.props.classes.navbar}>
          <div className={this.props.classes.button} />
          <div className={this.props.classes.button} />
          <div className={this.props.classes.button} />
          {(this.props.showAddressBar || this.props.addresBarContent) && (
            <>
              <div className={this.props.classes.addrbar}>
                <LockSimpleIcon fontSize='inherit' className={this.props.classes.lockIcon} />
                {this.props.addresBarContent}
              </div>
            </>
          )}
        </div>
        <div className={this.props.classes.content} style={{
        }}>
          {this.props.children}
        </div>
        {code}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(FakeBrowser);
