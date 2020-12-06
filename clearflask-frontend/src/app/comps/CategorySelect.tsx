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
  categoryOptions: Client.Category[];
  value: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
  errorText?: string;
  variant?: 'standard' | 'outlined' | 'filled';
  SelectionPickerProps?: Partial<React.ComponentProps<typeof SelectionPicker>>;
}
class CategorySelect extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const selectedValue: Label[] = [];
    const options: Label[] = this.props.categoryOptions.map(category => {
      const label = this.getLabel(category);
      if (this.props.value === category.categoryId) selectedValue.push(label);
      return label;
    });

    return (
      <SelectionPicker
        className={this.props.className}
        TextFieldProps={{
          variant: this.props.variant,
          size: this.props.size,
        }}
        label={this.props.label}
        placeholder={this.props.placeholder}
        disabled={this.props.disabled}
        value={selectedValue}
        options={options}
        errorMsg={this.props.errorText}
        noOptionsMessage='No options'
        forceDropdownIcon={false}
        showTags
        bareTags
        disableInput
        disableClearable
        onValueChange={labels => labels[0] && this.props.onChange(labels[0]?.value)}
        {...this.props.SelectionPickerProps}
      />
    );
  }

  getLabel(category: Client.Category): Label {
    return {
      label: category.name,
      filterString: category.name,
      value: category.categoryId,
      color: category.color,
    };
  }
}

export default withStyles(styles, { withTheme: true })(CategorySelect);
