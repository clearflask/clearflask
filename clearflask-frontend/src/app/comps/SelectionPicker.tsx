import { Chip, ListSubheader, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import { Autocomplete, AutocompleteRenderGroupParams, createFilterOptions } from '@material-ui/lab';
import React, { Component } from 'react';
import Loading from '../utils/Loading';

const filterOptions = createFilterOptions({
  matchFrom: 'any',
  ignoreCase: true,
  ignoreAccents: true,
  trim: true,
  stringify: (option: Label) => option.filterString || option.value,
});

// TODO filterString
export interface Label {
  label: string | React.ReactNode;
  filterString?: string;
  value: string;
  groupBy?: string;
  color?: string;
}

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
  // TODO this needs to be reworked
  showClearWithOneValue?: boolean;
  isMulti?: boolean;
  group?: boolean;
  formatCreateLabel?: (input: string) => string;
  loading?: boolean;
  overrideDropdownIcon?: React.ReactNode;
  limitTags?: number;

  // Below props are for backwards compatibility, use TextFieldProps instead
  label?: string;
  helperText?: string;
  placeholder?: string;
  errorMsg?: string;
  inputClassName?: string;
  width?: number | string;
  inputMinWidth?: string | number;
}
class SelectionPicker extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    return (
      <Autocomplete<Label, boolean, boolean, boolean>
        multiple={!!this.props.isMulti}
        value={this.props.isMulti ? (this.props.value) : (this.props.value.length > 0 ? this.props.value[0] : null)}
        onChange={(e, val, reason) => {
          if (reason === 'create-option') {
            this.props.onValueCreate && this.props.onValueCreate(val as any as string);
          } else if (reason === 'clear') {
            this.props.onValueChange([]);
          } else if (reason === 'select-option' || reason === 'remove-option') {
            this.props.onValueChange(!val ? [] : (this.props.isMulti ? val as Label[] : [val as Label]));
          }
        }}
        filterSelectedOptions
        filterOptions={(options, params) => {
          const filtered = filterOptions(options, params);

          // Suggest the creation of a new value
          if (params.inputValue !== '') {
            filtered.push({
              label: this.props.formatCreateLabel
                ? this.props.formatCreateLabel(params.inputValue)
                : `Add "${params.inputValue}"`,
              value: params.inputValue,
            });
          }

          return filtered;
        }}
        options={this.props.options}
        getOptionLabel={option => option.value}
        getOptionSelected={(option, value) => option.value === value.value}
        inputValue={this.props.inputValue}
        onInputChange={this.props.onInputChange ? (e, val, reason) => this.props.onInputChange && this.props.onInputChange(val, reason) : undefined}
        className={this.props.className}
        limitTags={this.props.limitTags}
        noOptionsText={this.props.noOptionsMessage}
        disabled={this.props.disabled}
        groupBy={this.props.group ? (label: Label) => label.groupBy || label.value[0] : undefined}
        renderGroup={this.props.group ? (params: AutocompleteRenderGroupParams) => [
          <ListSubheader key={params.key} component="div">
            {params.group}
          </ListSubheader>,
          params.children,
        ] : undefined}
        renderOption={(option: Label) => (
          <Typography noWrap style={{
            color: option.color
          }}>{option.label}</Typography>
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              variant='outlined'
              label={option.label}
              size='small'
              {...getTagProps({ index })}
            />
          ))
        }
        freeSolo
        open={this.props.menuIsOpen}
        // disableClearable={!this.props.showClearWithOneValue}
        clearOnEscape={this.props.showClearWithOneValue}
        onOpen={this.props.menuOnChange ? () => this.props.menuOnChange && this.props.menuOnChange(true) : undefined}
        onClose={this.props.menuOnChange ? () => this.props.menuOnChange && this.props.menuOnChange(false) : undefined}
        ChipProps={{
          variant: 'outlined',
        }}
        classes={{
          // TODO hide dropdown icon when overrideDropdownIcon is true
        }}
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
            InputProps={{
              ...params.InputProps,
              ...this.props.TextFieldProps?.InputProps,
              endAdornment: (
                <React.Fragment>
                  {this.props.loading && (
                    <Loading showImmediately />
                  )}
                  {this.props.TextFieldProps?.InputProps?.endAdornment}
                  {params.InputProps.endAdornment}
                  {this.props.overrideDropdownIcon}
                </React.Fragment>
              ),
            }}
            inputProps={{
              ...params.inputProps,
              ...this.props.TextFieldProps?.inputProps,
              style: {
                minWidth: this.props.inputMinWidth,
                width: this.props.width,
                ...params.inputProps['style'],
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
