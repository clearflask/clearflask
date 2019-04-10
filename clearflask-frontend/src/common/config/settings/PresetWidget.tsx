import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { Typography, TableHead, TableRow, TableCell, Checkbox, Paper, Button, withStyles, Theme, createStyles, WithStyles } from '@material-ui/core';
import Property from './Property';
import TableProp from './TableProp';
import Templater from '../configTemplater';

const styles = (theme: Theme) => createStyles({
  root: {
    display: 'flex',
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
      { title: 'Currency', body: 'Lorem ipsum lorem ipsum lorem ipsum lorem ipsum.',
        actionTitle: 'Set', action: (templater:Templater) => templater.creditsCurrency() },
      { title: 'Developer time', body: 'Lorem ipsum lorem ipsum lorem ipsum lorem ipsum.',
        actionTitle: 'Set', action: (templater:Templater) => templater.creditsTime() },
      { title: 'Virtual coins', body: 'Lorem ipsum lorem ipsum lorem ipsum lorem ipsum.',
        actionTitle: 'Set', action: (templater:Templater) => templater.creditsUnitless() },
      { title: 'Beer', body: 'Lorem ipsum lorem ipsum lorem ipsum lorem ipsum.',
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
      }}>
        {presets.map(preset => (
          <Paper elevation={1}>
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
