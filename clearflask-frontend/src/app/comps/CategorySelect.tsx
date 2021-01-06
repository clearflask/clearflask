import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState } from '../../api/server';
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
  width?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
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
        width={this.props.width}
        minWidth={this.props.minWidth}
        maxWidth={this.props.maxWidth}
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
export const CategorySelectWithConnect = connect<Pick<Props, 'categoryOptions'>, {}, Omit<Props, 'categoryOptions'>, ReduxState>((state, ownProps) => {
  const connectProps: Pick<Props, 'categoryOptions'> = {
    categoryOptions: state.conf.conf?.content.categories || [],
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(CategorySelect));
