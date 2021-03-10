import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';
import LockSimpleIcon from './icon/LockSimpleIcon';

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
    padding: 5,
    display: 'flex',
  },
  button: {
    backgroundColor: (props: Props) => theme.palette.grey[props.darkMode ? 600 : 200],
    width: 12,
    height: 12,
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
});
interface Props {
  children?: React.ReactNode;
  darkMode?: boolean;
  fixedWidth?: number | string;
  fixedHeight?: number | string;
  contentPadding?: number | string;
  showAddressBar?: boolean;
  addresBarContent?: React.ReactNode;
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
          {(this.props.showAddressBar || this.props.addresBarContent) && (
            <React.Fragment>
              <div className={this.props.classes.addrbar}>
                <LockSimpleIcon fontSize='inherit' className={this.props.classes.lockIcon} />
                {this.props.addresBarContent}
              </div>
            </React.Fragment>
          )}
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
