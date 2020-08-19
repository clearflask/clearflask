import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';

const styles = (theme: Theme) => createStyles({
  container: {
    overflow: 'hidden',
    borderRadius: 15,
    boxShadow: (props: Props) => `-3px 12px 41px -9px rgba(0,0,0,${props.darkMode ? '.7' : '.1'})`,
    display: 'flex',
    flexDirection: 'column',
    width: (props: Props) => props.fixedWidth,
  },
  navbar: {
    backgroundColor: (props: Props) => theme.palette.grey[props.darkMode ? 500 : 50],
    padding: 10,
    display: 'flex',
  },
  button: {
    backgroundColor: (props: Props) => theme.palette.grey[props.darkMode ? 600 : 200],
    width: 12,
    height: 12,
    borderRadius: 10,
    marginRight: 5,
  },
  content: {
    backgroundColor: (props: Props) => props.darkMode ? 'black' : 'white',
    flexGrow: 1,
    padding: (props: Props) => props.contentPadding,
    height: (props: Props) => props.fixedHeight,
  },
});
interface Props {
  children?: React.ReactNode;
  darkMode?: boolean;
  fixedWidth?: number | string;
  fixedHeight?: number | string;
  contentPadding?: number | string;
}
class FakeBrowser extends React.Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <div className={this.props.classes.container} style={{
      }}>
        <div className={this.props.classes.navbar}>
          <div className={this.props.classes.button} />
          <div className={this.props.classes.button} />
          <div className={this.props.classes.button} />
        </div>
        <div className={this.props.classes.content} style={{
        }}>
          {this.props.children}
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(FakeBrowser);
