import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab';
import React, { Component } from 'react';
import * as Client from '../../api/client';
import Templater from '../../common/config/configTemplater';
import { Device } from '../../common/DeviceContainer';

enum SignupMethods {
  Email = 'email',
  Mobile = 'mobile',
  Web = 'web',
  Anonymous = 'anonymous',
}

const initialSignupMethods = [SignupMethods.Email, SignupMethods.Mobile, SignupMethods.Web];

const setSignupMethodsTemplate = (templater: Templater, signupMethods: SignupMethods[]) => {
  templater.usersOnboardingEmail(signupMethods.includes(SignupMethods.Email));
  templater.usersOnboardingMobilePush(signupMethods.includes(SignupMethods.Mobile));
  templater.usersOnboardingBrowserPush(signupMethods.includes(SignupMethods.Web));
  templater.usersOnboardingAnonymous(signupMethods.includes(SignupMethods.Anonymous), !signupMethods.includes(SignupMethods.Anonymous));
}

export const setInitSignupMethodsTemplate = (templater: Templater) => {
  setSignupMethodsTemplate(templater, initialSignupMethods);
}

const styles = (theme: Theme) => createStyles({
  toggleButtonGroup: {
    display: 'inline-flex',
    marginBottom: theme.spacing(2),
  },
});

interface Props {
  templater: Templater;
  onboardingDemoRef: React.RefObject<any>;
}

interface State {
  device: Device;
  signupMethods: SignupMethods[];
  allowEmail: boolean;
  allowMobilePush: boolean;
  allowDesktopPush: boolean;
  allowAnonymous: boolean;
  collectDisplayName: Client.AccountFieldsDisplayNameEnum;
}

class OnboardingControls extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {
    device: Device.Desktop,
    signupMethods: initialSignupMethods,
    allowEmail: true,
    allowMobilePush: true,
    allowDesktopPush: true,
    allowAnonymous: true,
    collectDisplayName: Client.AccountFieldsDisplayNameEnum.None,
  };

  render() {
    return (
      <div>
        <Typography variant='caption' display='block'>Platform</Typography>
        <ToggleButtonGroup
          {...{ size: 'small' }}
          value={this.state.device}
          exclusive
          className={this.props.classes.toggleButtonGroup}
          onChange={(e, val) => {
            switch (val) {
              case 'mobile':
                this.setState({ device: Device.Mobile });
                this.props.onboardingDemoRef.current
                  && this.props.onboardingDemoRef.current.onDeviceChange
                  && this.props.onboardingDemoRef.current.onDeviceChange(Device.Mobile);
                break;
              case 'desktop':
                this.setState({ device: Device.Desktop });
                this.props.onboardingDemoRef.current
                  && this.props.onboardingDemoRef.current.onDeviceChange
                  && this.props.onboardingDemoRef.current.onDeviceChange(Device.Desktop);
                break;
            }
          }}
        >
          <ToggleButton value='desktop'>Desktop</ToggleButton>
          <ToggleButton value='mobile'>Mobile</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant='caption' display='block'>Signup methods</Typography>
        <ToggleButtonGroup
          size='small'
          value={this.state.signupMethods}
          className={this.props.classes.toggleButtonGroup}
          onChange={(e, val) => {
            const signupMethods = val as SignupMethods[];
            this.setState({ signupMethods: signupMethods });
            setSignupMethodsTemplate(this.props.templater, signupMethods);
          }}
        >
          <ToggleButton
            disabled={this.state.device === Device.Desktop}
            value={SignupMethods.Mobile}>Mobile</ToggleButton>
          <ToggleButton
            disabled={this.state.device === Device.Mobile}
            value={SignupMethods.Web}>Web</ToggleButton>
          <ToggleButton value={SignupMethods.Email}>Email</ToggleButton>
          <ToggleButton value={SignupMethods.Anonymous}>Anonymous</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant='caption' display='block'>Display name</Typography>
        <ToggleButtonGroup
          {...{ size: 'small' }}
          value={this.state.collectDisplayName}
          exclusive
          className={this.props.classes.toggleButtonGroup}
          onChange={(e, val) => {
            const displayName = val as Client.AccountFieldsDisplayNameEnum;
            this.setState({ collectDisplayName: displayName });
            this.props.templater.usersOnboardingDisplayName(displayName);
          }}
        >
          <ToggleButton value={Client.AccountFieldsDisplayNameEnum.None}>None</ToggleButton>
          <ToggleButton value={Client.AccountFieldsDisplayNameEnum.Optional}>Optional</ToggleButton>
          <ToggleButton value={Client.AccountFieldsDisplayNameEnum.Required}>Required</ToggleButton>
        </ToggleButtonGroup>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(OnboardingControls);
