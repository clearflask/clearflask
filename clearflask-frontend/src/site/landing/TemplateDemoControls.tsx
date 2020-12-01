import { FormControlLabel, FormHelperText, Radio, RadioGroup } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { CreateTemplateOptions, createTemplateOptionsDefault } from '../../common/config/configTemplater';
import { Project } from '../DemoApp';
import Demo from './Demo';

const templateOptionsCommon: Partial<CreateTemplateOptions> = {
  anonAllowed: true,
  webPushAllowed: true,
  emailAllowed: true,
}
const templateOptionsOutOfTheBox: CreateTemplateOptions = {
  ...createTemplateOptionsDefault,
  ...templateOptionsCommon,
};
const templateOptionsCustomized: CreateTemplateOptions = {
  ...createTemplateOptionsDefault,
  ...templateOptionsCommon,

  templateFeedback: true,
  templateRoadmap: true,
  templateChangelog: true,
  templateKnowledgeBase: true,

  fundingAllowed: true,
  creditOnSignup: 10000,
  votingAllowed: false,
  expressionAllowed: true,
  fundingType: 'currency',
  votingEnableDownvote: true,
};
export const demoOptions: {
  [option: string]: React.ComponentProps<typeof Demo>;
} = {
  'Out of the box': {
    template: templater => templater.demo(templateOptionsOutOfTheBox),
    mock: (mocker, config) => mocker.templateMock(templateOptionsOutOfTheBox),
    settings: {
      demoScrollY: true,
      demoMenuAnimate: [
        { path: 'feedback' },
        { path: 'roadmap' },
      ],
    },
    demoWrap: 'browser',
  },
  'Customized': {
    template: templater => {
      templater.demo(templateOptionsCustomized);
      templater.styleDark();
    },
    mock: (mocker, config) => mocker.templateMock(templateOptionsCustomized),
    settings: {
      demoScrollY: true,
      demoMenuAnimate: [
        { path: 'help' },
        { path: 'roadmap' },
        { path: 'changelog' },
        { path: 'feedback' },
        { path: 'roadmap' },
        { path: 'changelog' },
      ],
    },
    demoWrap: 'browser-dark',
  },
};

const styles = (theme: Theme) => createStyles({
  extraControls: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    margin: theme.spacing(1),
  },
});
interface Props {
  project: Project;
  value: string;
  onChange: (option: string) => void;
}
interface State {
  type: string;
}
class TemplateDemoControls extends Component<Props & WithStyles<typeof styles, true>, State> {
  render() {
    return (
      <RadioGroup
        className={this.props.classes.extraControls}
        value={this.props.value}
        onChange={(e, val) => this.props.onChange(val)}
      >
        {Object.keys(demoOptions).map(option => (
          <FormControlLabel key={option} value={option} control={<Radio color='primary' />}
            label={<FormHelperText component='span'>{option}</FormHelperText>} />
        ))}
      </RadioGroup>
    );
  }
}

export default withStyles(styles, { withTheme: true })(TemplateDemoControls);
