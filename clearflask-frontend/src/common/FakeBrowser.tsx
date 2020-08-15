import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';

const styles = (theme: Theme) => createStyles({
  container: {
    overflow: 'hidden',
    borderRadius: 15,
    boxShadow: '-3px 12px 41px -9px rgba(0,0,0,.1)',
    display: 'flex',
    flexDirection: 'column',
    // width: '100%',
  },
  navbar: {
    backgroundColor: theme.palette.grey[50],
    padding: 10,
    display: 'flex',
  },
  button: {
    backgroundColor: theme.palette.grey[200],
    width: 12,
    height: 12,
    borderRadius: 10,
    marginRight: 5,
  },
  content: {
    backgroundColor: 'white',
    flexGrow: 1,
  },
});
interface Props {
  children?: React.ReactNode;
  contentPadding?: number | string,
}
class FakeBrowser extends React.Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <div className={this.props.classes.container}>
        <div className={this.props.classes.navbar}>
          <div className={this.props.classes.button} />
          <div className={this.props.classes.button} />
          <div className={this.props.classes.button} />
        </div>
        <div className={this.props.classes.content} style={{
          padding: this.props.contentPadding,
        }}>
          {this.props.children}
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(FakeBrowser);
