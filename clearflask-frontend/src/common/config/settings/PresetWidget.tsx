import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { Typography, TableHead, TableRow, TableCell, Checkbox, Paper, Button, withStyles, Theme, createStyles, WithStyles } from '@material-ui/core';
import Property from './Property';
import TableProp from './TableProp';
import Templater from '../configTemplater';

const styles = (theme: Theme) => createStyles({
  paper: {
    padding: theme.spacing.unit * 2,
    margin: theme.spacing.unit,
    flex: '1 1 150px',
    minWidth: '150px',
    maxWidth: '250px',
  },
});

interface Props extends WithStyles<typeof styles> {
  page:ConfigEditor.Page;
  editor:ConfigEditor.Editor;
}

interface Preset {
  title:string;
  body:string;
  actionTitle:string;
  action:(templater:Templater)=>void;
}

class PresetWidget extends Component<Props> {
  static presets:{[pathStr:string]:Array<Preset>} = {
    'credits': [
      { title: 'Time', body: 'Structure your work based on how long it\'ll take. Recommended for transparency. Also ideal if your hourly rate may change in the future.',
        actionTitle: 'Set', action: (templater:Templater) => templater.creditsTime() },
      { title: 'Currency', body: 'Direct monetary value shows users exactly how much an idea is worth.',
        actionTitle: 'Set', action: (templater:Templater) => templater.creditsCurrency() },
      { title: 'Points', body: 'Virtual currency disconnects from the real world value. Ideal if you give away points from various sources with differing price points or discounts.',
        actionTitle: 'Set', action: (templater:Templater) => templater.creditsUnitless() },
      { title: 'Beer', body: 'Tip jars may decide to use a currency such as tipping a beer, coffee, or lunch.',
        actionTitle: 'Set', action: (templater:Templater) => templater.creditsBeer() },
    ],
  }

  render() {
    const presets:Array<Preset> = PresetWidget.presets[this.props.page.pathStr];
    if(presets === undefined) {
      return null;
    }

    return (
      <div style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'baseline'
      }}>
        {presets.map(preset => (
          <Paper elevation={1} className={this.props.classes.paper}>
            <Typography variant="h5">{preset.title}</Typography>
            <Typography component="p">{preset.body}</Typography>
            <Button onClick={() => preset.action(Templater.get(this.props.editor))}
            >{preset.actionTitle}</Button>
          </Paper>
        ))}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PresetWidget);
