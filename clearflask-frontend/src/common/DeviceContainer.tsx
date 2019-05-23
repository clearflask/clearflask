import React from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { ThemeStyle } from '@material-ui/core/styles/createTypography';
import GradientFade from './GradientFade';

export enum Device {
  Desktop = 'desktop',
  Mobile = 'mobile',
}

const styles = (theme:Theme) => createStyles({
  // Taken from https://www.w3schools.com/howto/howto_css_devices.asp
  [Device.Desktop]: {
    WebkitTransformOrigin: '0 0',
    transformOrigin: '0 0',
    WebkitTransform: 'scale(.6) translate(-50%)',
    transform: 'scale(.6) translate(-50%)',
    left: '50%',
    position: 'absolute',
    width: '1366px',
    height: '800px',
    borderRadius: '6px',
    borderStyle: 'solid',
    borderColor: 'black',
    borderWidth: '24px 24px 80px',
    backgroundColor: 'black',
    '&:before': {
      content: '""',
      display: 'block',
      position: 'absolute',
      width: '250px',
      height: '30px',
      bottom: '-110px',
      left: '50%',
      WebkitTransform: 'translate(-50%)',
      transform: 'translate(-50%)',
      background: '#f1f1f1',
      borderBottomLeftRadius: '5px',
      borderBottomRightRadius: '5px',
      zIndex: 1,
    },
    '&:after': {
      content: '""',
      display: 'block',
      position: 'absolute',
      width: '1600px',
      height: '60px',
      margin: '80px 0 0 -110px',
      background: 'black',
      borderRadius: '6px',
    },
    '& $content': {
      width: '1366px',
      height: '800px',
      overflow: 'hidden',
      border: 'none',
    },
  },
  [Device.Mobile]: {
    position: 'relative',
    width: '360px',
    height: '640px',
    margin: 'auto',
    border: '16px black solid',
    borderTopWidth: '60px',
    borderBottomWidth: '60px',
    borderRadius: '36px',
    '&:before': {
      content: '""',
      display: 'block',
      width: '60px',
      height: '5px',
      position: 'absolute',
      top: '-30px',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: '#333',
      borderRadius: '10px',
    },
    '&:after': {
      content: '""',
      display: 'block',
      width: '35px',
      height: '35px',
      position: 'absolute',
      left: '50%',
      bottom: '-65px',
      transform: 'translate(-50%, -50%)',
      background: '#333',
      borderRadius: '50%',
    },
    '& $content': {
      background: theme.palette.background.default,
    },
  },
  content: {
  },
});

interface Props {
  device:Device;
}

class DeviceContainer extends React.Component<Props&WithStyles<typeof styles, true>> {

  render() {
    const classes:string[] = [];

    classes.push(this.props.classes[this.props.device]);

    return (
      <div className={classes.join(' ')}>
        <div className={this.props.classes.content}>
          {this.props.children}
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DeviceContainer);
