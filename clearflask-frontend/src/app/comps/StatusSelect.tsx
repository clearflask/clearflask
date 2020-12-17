import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Client from '../../api/client';
import SelectionPicker, { Label } from './SelectionPicker';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  className?: string;
  size?: 'small' | 'medium',
  label?: string;
  placeholder?: string;
  initialStatusId?: string;
  statuses: Client.IdeaStatus[];
  value?: string;
  onChange: (statusId?: string) => void;
  disabled?: boolean;
  errorText?: string;
  variant?: 'standard' | 'outlined' | 'filled';
  SelectionPickerProps?: Partial<React.ComponentProps<typeof SelectionPicker>>;
}
class StatusSelect extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const nextStatusValues: Label[] = [];
    const nextStatusOptions: Label[] = [];
    const status: Client.IdeaStatus | undefined = this.props.initialStatusId ? this.props.statuses.find(s => s.statusId === this.props.initialStatusId) : undefined;
    var nextStatuses: Client.IdeaStatus[] | undefined;
    if (!!status) {
      var nextStatusIds = new Set(status.nextStatusIds);
      this.props.initialStatusId && nextStatusIds.add(this.props.initialStatusId);
      if (nextStatusIds && nextStatusIds.size > 0) {
        nextStatuses = status ? this.props.statuses.filter(s => nextStatusIds!.has(s.statusId)) : undefined;
      }
    } else {
      nextStatuses = this.props.statuses;
    }
    nextStatuses && nextStatuses.forEach(s => {
      const label: Label = this.getLabel(s);
      nextStatusOptions.push(label);
      if (this.props.value === s.statusId) {
        nextStatusValues.push(label);
      }
    });

    return (
      <SelectionPicker
        className={this.props.className}
        TextFieldProps={{
          variant: this.props.variant,
          size: this.props.size,
        }}
        placeholder={this.props.placeholder}
        disabled={this.props.disabled}
        errorMsg={this.props.errorText}
        noOptionsMessage='No options'
        forceDropdownIcon={false}
        width='100%'
        label={this.props.label || 'Status'}
        showTags
        bareTags
        disableClearable
        disableInput
        value={nextStatusValues}
        options={nextStatusOptions}
        onValueChange={labels => labels[0] && this.props.onChange((labels[0]?.value === this.props.initialStatusId
          ? undefined : labels[0]?.value))}
        {...this.props.SelectionPickerProps}
      />
    );
  }

  getLabel(status: Client.IdeaStatus): Label {
    return {
      label: status.name,
      filterString: status.name,
      value: status.statusId,
      color: status.color,
    };
  }
}

export default withStyles(styles, { withTheme: true })(StatusSelect);
