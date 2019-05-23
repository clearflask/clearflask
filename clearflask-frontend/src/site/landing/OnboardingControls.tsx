import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import * as ConfigEditor from '../../common/config/configEditor';
import Templater from '../../common/config/configTemplater';
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab';
import { Grow, RadioGroup, FormControlLabel, Radio, Switch, FormHelperText, FormControl, Select, MenuItem } from '@material-ui/core';
import * as Client from '../../api/client';

const styles = (theme:Theme) => createStyles({
  page: {
  },
  extraControls: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    margin: theme.spacing.unit,
  },
});

interface Props {
  templater: Templater;
}

interface State {
  platform:'mobile'|'desktop';
  allowEmail:boolean;
  allowMobilePush:boolean;
  allowDesktopPush:boolean;
  allowAnonymous:boolean;
  collectDisplayName:Client.AccountFieldsDisplayNameEnum;
}

class PrioritizationControls extends Component<Props&WithStyles<typeof styles, true>, State> {
  state:State = {
    platform: 'desktop',
    allowEmail: true,
    allowMobilePush: true,
    allowDesktopPush: true,
    allowAnonymous: true,
    collectDisplayName: Client.AccountFieldsDisplayNameEnum.None,
  };

  render() {
    return (
      <div className={this.props.classes.page}>
        <ToggleButtonGroup
          value={this.state.platform}
          exclusive
          style={{display: 'inline-block'}}
          onChange={(e, val) => {
            switch(val) {
              case 'mobile':
                this.setState({platform: val});
                // TODO
                break;
              case 'desktop':
                this.setState({platform: val});
                // TODO
                break;
            }
          }}
        >
          <ToggleButton value='desktop'>Desktop</ToggleButton>
          <ToggleButton value='mobile'>Mobile</ToggleButton>
        </ToggleButtonGroup>
        <div className={this.props.classes.extraControls}>
          <FormControlLabel
            control={(<Switch
              color='default'
              checked={!!this.state.allowEmail}
              onChange={(e, checked) => {
                this.setState({allowEmail: checked});
                this.props.templater.usersOnboardingEmail(checked);
              }}
            />)}
            label={<FormHelperText component='span'>Email</FormHelperText>}
          />
          <FormControlLabel
            control={(<Switch
              disabled={this.state.platform !== 'mobile'}
              color='default'
              checked={!!this.state.allowMobilePush}
              onChange={(e, checked) => {
                this.setState({allowMobilePush: checked});
                this.props.templater.usersOnboardingMobilePush(checked);
              }}
            />)}
            label={<FormHelperText component='span'>Mobile Push</FormHelperText>}
          />
          <FormControlLabel
            control={(<Switch
              disabled={this.state.platform !== 'desktop'}
              color='default'
              checked={!!this.state.allowDesktopPush}
              onChange={(e, checked) => {
                this.setState({allowDesktopPush: checked});
                this.props.templater.usersOnboardingBrowserPush(checked);
              }}
            />)}
            label={<FormHelperText component='span'>Browser Push</FormHelperText>}
          />
          <FormControlLabel
            control={(<Switch
              color='default'
              checked={!!this.state.allowAnonymous}
              onChange={(e, checked) => {
                this.setState({allowAnonymous: checked});
                this.props.templater.usersOnboardingAnonymous(checked);
              }}
            />)}
            label={<FormHelperText component='span'>Anonymous</FormHelperText>}
          />
          <FormControlLabel
            control={(<Switch
              color='default'
              checked={this.state.collectDisplayName !== Client.AccountFieldsDisplayNameEnum.None}
              onChange={(e, checked) => {
                const val = checked ? Client.AccountFieldsDisplayNameEnum.Required : Client.AccountFieldsDisplayNameEnum.None;
                this.setState({collectDisplayName: val});
                this.props.templater.usersOnboardingDisplayName(val);
              }}
            />)}
            label={<FormHelperText component='span'>Display name</FormHelperText>}
          />
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PrioritizationControls);
