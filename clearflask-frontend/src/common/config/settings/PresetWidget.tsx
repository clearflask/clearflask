import { Button, createStyles, Theme, Typography, withStyles, WithStyles } from '@material-ui/core';
import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import Templater from '../configTemplater';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  widget: {
    padding: theme.spacing(2),
    margin: theme.spacing(2, 2, 2, 0),
    flex: '1 1 150px',
    minWidth: '150px',
    maxWidth: '250px',
    border: '1px solid ' + theme.palette.grey[300],
  },
});

interface Props extends WithStyles<typeof styles, true> {
  page: ConfigEditor.Page;
  editor: ConfigEditor.Editor;
}

interface Preset {
  title: string;
  body: string;
  actionTitle: string;
  action: (templater: Templater, path: ConfigEditor.Path) => void;
}

class PresetWidget extends Component<Props> {
  static presets: { [pathStr: string]: Array<Preset> } = {
    '': [
      {
        title: 'Feedback', body: 'Collect feedback from user, comes with a "Feature" and "Bug" category',
        actionTitle: 'Add', action: (templater, path) => templater.templateFeedback(true, false)
      },
      {
        title: 'Changelog', body: 'Update your users with new changes to your product',
        actionTitle: 'Add', action: (templater, path) => templater.templateChangelog(true)
      },
      {
        title: 'Knowledge Base', body: 'Helpful articles around your product',
        actionTitle: 'Add', action: (templater, path) => templater.templateKnowledgeBase()
      },
      // {
      //   title: 'Blog', body: 'Add articles for your users',
      //   actionTitle: 'Add', action: (templater, path) => templater.templateBlog(true)
      // },
    ],
    'content.categories.<>.support': [
      {
        title: 'Any Reaction', body: 'Enables full suite of emojis. All emojis are counted with identical weight.',
        actionTitle: 'Set', action: (templater, path) => templater.supportExpressingAllEmojis(path[2] as number)
      },
      {
        title: 'Github Reactions', body: "Use Github-like reactions ",
        actionTitle: 'Set', action: (templater, path) => templater.supportExpressingGithubStyle(path[2] as number)
      },
      {
        title: 'Ranged Reactions', body: 'Enables reactions on a range from smiling to disappointed',
        actionTitle: 'Set', action: (templater, path) => templater.supportExpressingRange(path[2] as number)
      },
    ],
    'content.categories.<>.tagging': [
      {
        title: 'OS Platform', body: 'Operating System tags for Windows, Mac and Linux',
        actionTitle: 'Add', action: (templater, path) => templater.taggingOsPlatform(path[2] as number)
      },
    ],
    'content.categories.<>.workflow': [
      {
        title: 'Dev feature', body: 'Typical workflow for a software feature. Also includes a Funding status.',
        actionTitle: 'Set', action: (templater, path) => templater.workflowFeatures(path[2] as number)
      },
      {
        title: 'Dev bug', body: 'Typical workflow for a software bug.',
        actionTitle: 'Set', action: (templater, path) => templater.workflowBug(path[2] as number)
      },
    ],
    'users.credits': [
      {
        title: 'Currency', body: 'Direct monetary value shows users exactly how much an idea is worth.',
        actionTitle: 'Set', action: (templater, path) => templater.creditsCurrency()
      },
      {
        title: 'Time', body: 'Structure your work based on how long it\'ll take. Recommended for transparency. Also ideal if your hourly rate may change in the future.',
        actionTitle: 'Set', action: (templater, path) => templater.creditsTime()
      },
      {
        title: 'Points', body: 'Virtual currency disconnects from the real world value. Ideal if you give away points from various sources with differing price points or discounts.',
        actionTitle: 'Set', action: (templater, path) => templater.creditsUnitless()
      },
      {
        title: 'Beer', body: 'Tip jars may decide to use a currency such as tipping a beer, coffee, or lunch.',
        actionTitle: 'Set', action: (templater, path) => templater.creditsBeer()
      },
    ],
  }

  render() {
    const presets: Array<Preset> = PresetWidget.presets[this.props.page.pathStr.replace(/\d+/, '<>')];
    if (presets === undefined) {
      return null;
    }

    return (
      <div className={this.props.classes.container}>
        {presets.map((preset, index) => (
          <div key={preset.title} className={this.props.classes.widget}>
            <Typography variant='h5'>{preset.title}</Typography>
            <Typography component='p'>{preset.body}</Typography>
            <Button onClick={() => preset.action(Templater.get(this.props.editor), this.props.page.path)}
            >{preset.actionTitle}</Button>
          </div>
        ))}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PresetWidget);
