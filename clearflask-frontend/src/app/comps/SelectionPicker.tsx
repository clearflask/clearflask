import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import { Autocomplete, createFilterOptions } from '@material-ui/lab';
import React, { Component } from 'react';

// TODO filterString
export interface Label {
  label: string | React.ReactNode;
  filterString?: string;
  value: string;
}

export type ColorLookup = { [value: string]: string; }

const styles = (theme: Theme) => createStyles({
});
interface Props {
  value: Label[];
  options: Label[];
  onValueChange: (labels: Label[]) => void;
  onValueCreate?: (name: string) => void;
  className?: string;
  TextFieldProps?: React.ComponentProps<typeof TextField>;
  inputValue?: string;
  menuIsOpen?: boolean;
  menuOnChange?: (open: boolean) => void;
  onInputChange?: (newValue: string, reason: 'input' | 'reset' | 'clear') => void;
  noOptionsMessage?: string;
  disabled?: boolean;
  showClearWithOneValue?: boolean;
  isMulti?: boolean;

  // Below props are for backwarss compatibility, use TextFieldProps instead
  label?: string;
  helperText?: string;
  placeholder?: string;
  errorMsg?: string;
  inputClassName?: string;
  width?: number | string;
  inputMinWidth?: string | number;

  // TODO Needs replacement below
  // placeholderWrapper?: (placeholder: string) => React.ReactNode;
  // overrideComponents?: Partial<SelectComponents<Label>>;

  // TODO below
  colorLookup?: ColorLookup;
  bare?: boolean;
  formatCreateLabel?: (input: string) => string;
}

class SelectionPicker extends Component<Props & WithStyles<typeof styles, true>> {
  readonly const filterOptions = createFilterOptions({
    matchFrom: 'any',
    ignoreCase: true,
    ignoreAccents: true,
    trim: true,
    stringify: (option: Label) => option.filterString || option.value,
  });

  render() {
    return (
      <Autocomplete
        value={this.props.isMulti ? (this.props.value) : (this.props.value.length > 0 ? this.props.value[0] : null)}
        onChange={(e, val, reason) => {
          if (reason === 'create-option') {
            this.props.onValueCreate && this.props.onValueCreate(val.inputValue);
          } else if (reason === 'clear') {
            this.props.onValueChange([]);
          } else if (reason === 'select-option' || reason === 'remove-option') {
            this.props.onValueChange(this.props.isMulti ? val : [val]);
          }
        }}
        filterSelectedOptions
        filterOptions={(options, params) => {
          const filtered = filter(options, params);

          // Suggest the creation of a new value
          if (params.inputValue !== '') {
            filtered.push({
              inputValue: params.inputValue,
              title: `Add "${params.inputValue}"`,
            });
          }

          return filtered;
        }}
        options={this.props.options}
        getOptionSelected={(option, value) => option.value === value.value}
        inputValue={this.props.inputValue}
        onInputChange={this.props.onInputChange ? (e, val, reason) => this.props.onInputChange && this.props.onInputChange(val, reason) : undefined}
        className={this.props.className}
        noOptionsText={this.props.noOptionsMessage}
        disabled={this.props.disabled}
        multiple={!!this.props.isMulti}
        freeSolo
        open={this.props.menuIsOpen}
        disableClearable={!this.props.showClearWithOneValue}
        clearOnEscape={this.props.showClearWithOneValue}
        onOpen={this.props.menuOnChange ? () => this.props.menuOnChange && this.props.menuOnChange(true) : undefined}
        onClose={this.props.menuOnChange ? () => this.props.menuOnChange && this.props.menuOnChange(false) : undefined}
        renderInput={(params) => (
          <TextField
            label={this.props.label}
            helperText={this.props.errorMsg || this.props.helperText}
            placeholder={this.props.placeholder}
            error={!!this.props.errorMsg}
            {...this.props.TextFieldProps}
            classes={{
              root: this.props.inputClassName,
              ...this.props.TextFieldProps?.classes,
            }}
            {...params}
            inputProps={{
              ...params.inputProps,
              ...this.props.TextFieldProps?.inputProps,
              style: {
                minWidth: this.props.inputMinWidth,
                width: this.props.width,
                ...params.inputProps ? ['style'],
                ...this.props.TextFieldProps?.inputProps?.style,
              },
            }}
          />
        )}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(SelectionPicker);
