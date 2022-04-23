// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';

export enum Device {
  Desktop = 'desktop',
  Mobile = 'mobile',
  None = 'none',
}

const styles = (theme: Theme) => createStyles({
  // Based on https://www.w3schools.com/howto/howto_css_devices.asp
  mobileBorder: {
    margin: 'auto',
    maxWidth: '360px',
    borderWidth: '60px 16px',
    borderRadius: '36px',
    borderColor: theme.palette.grey[800],
    borderStyle: 'solid',
  },
  mobileContainer: {
    paddingTop: '177.78%',
    width: '100%',
    position: 'relative',
    background: theme.palette.grey[800],
  },
  mobileTopBar: {
    display: 'block',
    width: '60px',
    height: '5px',
    position: 'absolute',
    top: '-30px',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: theme.palette.grey[700],
    borderRadius: '10px',
  },
  mobileBottomBar: {
    display: 'block',
    width: '35px',
    height: '35px',
    position: 'absolute',
    left: '50%',
    bottom: '-65px',
    transform: 'translate(-50%, -50%)',
    background: theme.palette.grey[700],
    borderRadius: '50%',
  },
  mobileContent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    WebkitTransformOrigin: '0 0',
    transformOrigin: '0 0',
    WebkitTransform: 'scale(.8)',
    transform: 'scale(.8)',
    width: '125%',
    height: '125%',
    overflow: 'hidden',
  },
  desktopOutside: {
    display: 'flex',
    flexDirection: 'column',
  },
  desktopBorder: {
    margin: 'auto',
    width: '90%',
    maxWidth: '1366px',
    borderWidth: '10px',
    borderRadius: '8px',
    borderColor: theme.palette.grey[800],
    borderStyle: 'solid',
  },
  desktopContainer: {
    paddingTop: '58.6%',
    width: '100%',
    position: 'relative',
    background: theme.palette.grey[800],
  },
  desktopContent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    WebkitTransformOrigin: '0 0',
    transformOrigin: '0 0',
    WebkitTransform: 'scale(.64)',
    transform: 'scale(.64)',
    width: '156.25%',
    height: '156.25%',
    overflow: 'hidden',
  },
  desktopBottom: {
    display: 'block',
    width: '100%',
    marginTop: '6px',
    height: '24px',
    borderRadius: '4px',
    background: theme.palette.grey[800],
  },
  desktopBottomOpening: {
    display: 'block',
    width: '20%',
    margin: '0px auto',
    height: '10px',
    borderBottomLeftRadius: '8px',
    borderBottomRightRadius: '8px',
    background: theme.palette.grey[700],
  },
});

interface Props {
  device: Device;
}

class DeviceContainer extends React.Component<Props & WithStyles<typeof styles, true>> {

  render() {
    switch (this.props.device) {
      case Device.Desktop:
        return (
          <div className={this.props.classes.desktopOutside}>
            <div className={this.props.classes.desktopBorder}>
              <div className={this.props.classes.desktopContainer}>
                <div className={this.props.classes.desktopContent}>
                  {this.props.children}
                </div>
              </div>
            </div>
            <div className={this.props.classes.desktopBottom}>
              <div className={this.props.classes.desktopBottomOpening} />
            </div>
          </div>
        );
      case Device.Mobile:
        return (
          <div className={this.props.classes.mobileBorder}>
            <div className={this.props.classes.mobileContainer}>
              <div className={this.props.classes.mobileTopBar} />
              <div className={this.props.classes.mobileContent}>
                {this.props.children}
              </div>
              <div className={this.props.classes.mobileBottomBar} />
            </div>
          </div>
        );
      default:
      case Device.None:
        return this.props.children;
    }
  }
}

export default withStyles(styles, { withTheme: true })(DeviceContainer);
