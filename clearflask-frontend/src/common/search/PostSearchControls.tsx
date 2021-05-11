import { Checkbox, FormControlLabel, FormHelperText, Radio, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';
import * as Client from '../../api/client';
import { GroupedLabels, groupLabels, PostLabels, postLabelsToSearch, postSearchToLabels } from './searchUtil';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
  },
});
interface Props {
  config?: Client.Config,
  explorer?: Client.PageExplorer,
  search?: Partial<Client.IdeaSearch>;
  onSearchChanged: (search: Partial<Client.IdeaSearch>) => void;
}
class PostSearchControls extends React.Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const labels: PostLabels = postSearchToLabels(
      this.props.config,
      this.props.explorer,
      this.props.search);

    const optionsGrouped: GroupedLabels = groupLabels(labels.options);
    const checkedValues = new Set(labels.values.map(label => label.value));
    const toggleValue = value => {
      if (checkedValues.has(value)) {
        checkedValues.delete(value);
      } else {
        checkedValues.add(value);
      }
      this.props.onSearchChanged(postLabelsToSearch([...checkedValues]));
    };

    return (
      <div className={this.props.classes.container}>
        {optionsGrouped.map(group => {
          const Control = group.controlType === 'check' ? Checkbox : Radio;
          return (
            <div
              key={`group-${group.groupName || 'noname'}`}
              className={this.props.classes.group}
            >
              <Typography variant='caption'>{group.groupName}</Typography>
              {group.labels.map(label => (
                <FormControlLabel
                  key={`label-${label.label}`}
                  label={(<FormHelperText component='span'>{label.label}</FormHelperText>)}
                  style={{ color: label.color }}
                  control={(
                    <Control
                      size='small'
                      color='default'
                      checked={!!checkedValues.has(label.value)}
                      onChange={e => toggleValue(label.value)}
                    />
                  )}
                />
              ))}
            </div>
          );
        })}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PostSearchControls);
