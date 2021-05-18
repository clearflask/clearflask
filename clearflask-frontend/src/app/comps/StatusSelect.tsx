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
  show: 'next' | 'all';
  workflow?: Client.Workflow;
  initialStatusId?: string;
  statusId?: string;
  onChange: (statusId?: string) => void;
  disabled?: boolean;
  errorText?: string;
  variant?: 'standard' | 'outlined' | 'filled';
  SelectionPickerProps?: Partial<React.ComponentProps<typeof SelectionPicker>>;
}
class StatusSelect extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const initialStatus: Client.IdeaStatus | undefined = this.props.initialStatusId ? this.props.workflow?.statuses.find(s => s.statusId === this.props.initialStatusId) : undefined;
    var options: Client.IdeaStatus[] | undefined;
    if (this.props.show === 'all') {
      options = this.props.workflow?.statuses;
    } else if (!initialStatus) {
      const entryStatus = this.props.workflow?.entryStatus ? this.props.workflow.statuses.find(s => s.statusId === this.props.workflow!.entryStatus) : undefined;
      options = !!entryStatus
        ? [entryStatus]
        : this.props.workflow?.statuses;
    } else {
      if (!!initialStatus.nextStatusIds?.length) {
        const nextStatusIds = new Set([...initialStatus.nextStatusIds, initialStatus.statusId]);
        options = this.props.workflow?.statuses.filter(s => nextStatusIds.has(s.statusId));
      } else {
        options = [initialStatus];
      }
    }

    const selectedStatusId = this.props.statusId || initialStatus?.statusId;
    const selectedLabel: Label[] = [];
    const optionsLabels: Label[] = [];
    options && options.forEach(s => {
      const label: Label = this.getLabel(s);
      optionsLabels.push(label);
      if (s.statusId === selectedStatusId) {
        selectedLabel.push(label);
      }
    });
    const noOptions = selectedLabel.length === optionsLabels.length;

    return (
      <SelectionPicker
        className={this.props.className}
        placeholder={this.props.placeholder}
        disabled={this.props.disabled}
        errorMsg={this.props.errorText}
        noOptionsMessage='No options'
        // forceDropdownIcon={false}
        width='100%'
        label={this.props.label || 'Status'}
        showTags
        bareTags
        formatHeader={noOptions ? inputValue => 'No options' : undefined}
        disableClearable
        disableInput
        value={selectedLabel}
        options={optionsLabels}
        onValueChange={labels => labels[0] && this.props.onChange((labels[0]?.value === this.props.initialStatusId
          ? undefined : labels[0]?.value))}
        {...this.props.SelectionPickerProps}
        TextFieldProps={{
          variant: this.props.variant,
          size: this.props.size,
          ...this.props.SelectionPickerProps?.TextFieldProps,
        }}
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
