import { Chip, Fade, Popper, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { ClassNameMap } from '@material-ui/core/styles/withStyles';
import TextField from '@material-ui/core/TextField';
import { Autocomplete, AutocompleteClassKey, AutocompleteRenderGroupParams, createFilterOptions } from '@material-ui/lab';
import classNames from 'classnames';
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
  disabled?: boolean;
}

const styles = (theme: Theme) => createStyles({
  dropdownIconDontFlip: {
    transform: 'unset',
  },
  endAdornment: {
    position: 'unset',
  },
  input: {
    transition: (props: Props) => theme.transitions.create(['min-width', 'width'], props.isInExplorer ? { duration: theme.explorerExpandTimeout } : undefined),
  },
  inputRoot: {
    paddingRight: '0!important',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  menuHeader: {
    margin: theme.spacing(2, 1),
  },
  popper: {
    width: (props: Props) => props.popupColumnCount ? `${(props.popupColumnWidth || 130) * props.popupColumnCount}px!important` : undefined,
  },
  popperListbox: {
    columnCount: (props: Props) => props.popupColumnCount,
    columnFill: 'balance',
    columnGap: 0,
    maxHeight: 'unset',
  },
  group: {
    webkitColumnBreakInside: 'avoid',
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
  },
  header: {
    columnSpan: 'all',
  },
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
  disableClearable?: boolean;
  isMulti?: boolean;
  group?: boolean;
  formatHeader?: (input: string) => React.ReactNode;
  formatCreateLabel?: (input: string) => string;
  loading?: boolean;
  dropdownIconDontFlip?: boolean;
  overrideDropdownIcon?: React.ReactNode;
  limitTags?: number;
  isInExplorer?: boolean;
  minWidth?: string | number;
  maxWidth?: string | number;
  renderOption?: (label: Label, selected: boolean) => React.ReactNode;
  filterSelectedOptions?: boolean;
  disableCloseOnSelect?: boolean;
  autocompleteClasses?: Partial<ClassNameMap<AutocompleteClassKey>>;
  popupColumnCount?: number;
  popupColumnWidth?: number;
  PopperProps?: Partial<React.ComponentProps<typeof Popper>>;

  // Below props are for backwards compatibility, use TextFieldProps instead
  label?: string;
  helperText?: string;
  placeholder?: string;
  errorMsg?: string;
  width?: number | string;
  inputMinWidth?: string | number;
}
class SelectionPicker extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    return (
      <Autocomplete<Label, boolean, boolean, boolean>
        freeSolo
        autoHighlight
        multiple={!!this.props.isMulti}
        value={this.props.isMulti ? this.props.value : (this.props.value[0] || null)}
        onChange={(e, val, reason) => {
          if (reason === 'create-option') {
            this.props.onValueCreate && this.props.onValueCreate(val as any as string);
          } else if (reason === 'clear') {
            this.props.onValueChange([]);
          } else if (reason === 'select-option' || reason === 'remove-option') {
            this.props.onValueChange(!val ? [] : (this.props.isMulti ? val as Label[] : [val as Label]));
          }
        }}
        disableCloseOnSelect={this.props.disableCloseOnSelect}
        filterSelectedOptions={this.props.filterSelectedOptions}
        filterOptions={(options, params) => {
          const filtered = filterOptions(options, params);

          // Suggest the creation of a new value
          if (!!this.props.onValueCreate && params.inputValue !== '') {
            filtered.unshift({
              label: this.props.formatCreateLabel
                ? this.props.formatCreateLabel(params.inputValue)
                : `Add "${params.inputValue}"`,
              value: params.inputValue,
              groupBy: '__EMPTY__',
            });
          }

          // Header
          if (!!this.props.formatHeader) {
            const header = this.props.formatHeader(params.inputValue);
            if (header) {
              filtered.unshift({
                label: header,
                value: '__HEADER__',
                groupBy: '__EMPTY__',
                disabled: true,
              });
            }
          }

          return filtered;
        }}
        popupIcon={this.props.overrideDropdownIcon}
        forcePopupIcon={!!this.props.overrideDropdownIcon || 'auto'}
        options={this.props.options}
        getOptionLabel={option => option.filterString || option.value}
        getOptionSelected={(option, value) => option.value === value.value}
        inputValue={this.props.inputValue}
        onInputChange={this.props.onInputChange ? ((e, val, reason) => {
          if (reason === 'reset') return; // Unknown bug with an erroneous reset
          this.props.onInputChange && this.props.onInputChange(val, reason);
        }) : undefined}
        className={this.props.className}
        limitTags={this.props.limitTags}
        noOptionsText={this.props.noOptionsMessage}
        loading={this.props.loading}
        disabled={this.props.disabled}
        getOptionDisabled={option => !!option.disabled}
        groupBy={this.props.group ? (label: Label) => label.groupBy || label.value[0] : undefined}
        renderGroup={this.props.group ? (params: AutocompleteRenderGroupParams) => (
          <div className={classNames(this.props.classes.group, params.group === '__EMPTY__' && this.props.classes.header)}>
            {params.group && params.group !== '__EMPTY__' && (
              <Typography key={params.key} variant='overline' className={this.props.classes.menuHeader}>{params.group}</Typography>
            )}
            {params.children}
          </div>
        ) : undefined}
        handleHomeEndKeys
        openOnFocus
        renderOption={(option: Label, { selected }) => (
          <Typography
            noWrap
            style={{
              fontWeight: selected ? 'bold' : undefined,
              color: option.color,
            }}
          >
            {(option.value !== '__HEADER__' && this.props.renderOption)
              ? this.props.renderOption(option, selected)
              : option.label}
          </Typography>
        )}
        renderTags={(value, getTagProps) =>
          <div className={this.props.classes.chips}>
            {value.map((option, index) => (
              <Fade key={option.value} in={true}>
                <Chip
                  variant='outlined'
                  label={option.label}
                  size='small'
                  {...getTagProps({ index })}
                />
              </Fade>
            ))}
          </div>
        }
        open={this.props.menuIsOpen}
        disableClearable={this.props.disableClearable}
        onOpen={this.props.menuOnChange ? () => this.props.menuOnChange && this.props.menuOnChange(true) : undefined}
        onClose={this.props.menuOnChange ? () => this.props.menuOnChange && this.props.menuOnChange(false) : undefined}
        classes={{
          ...this.props.autocompleteClasses,
          popupIndicatorOpen: classNames(this.props.dropdownIconDontFlip && this.props.classes.dropdownIconDontFlip, this.props.autocompleteClasses?.popupIndicator),
          endAdornment: classNames(this.props.classes.endAdornment, this.props.autocompleteClasses?.endAdornment),
          input: classNames(this.props.classes.input, this.props.autocompleteClasses?.input),
          inputRoot: classNames(this.props.classes.inputRoot, this.props.autocompleteClasses?.inputRoot),
          popper: classNames(this.props.classes.popper, this.props.autocompleteClasses?.popper),
          listbox: classNames(this.props.classes.popperListbox, this.props.autocompleteClasses?.listbox),
        }}
        style={{
          minWidth: this.props.minWidth,
          maxWidth: this.props.maxWidth,
          width: this.props.width,
        }}
        PopperComponent={getSelectionPopper(this.props.PopperProps)}
        renderInput={(params) => (
          <TextField
            label={this.props.label}
            helperText={this.props.errorMsg || this.props.helperText}
            placeholder={this.props.placeholder}
            error={!!this.props.errorMsg}
            {...this.props.TextFieldProps}
            {...params}
            InputLabelProps={{
              ...params.InputLabelProps,
              ...this.props.TextFieldProps?.InputLabelProps,
            }}
            inputProps={{
              ...params.inputProps,
              ...this.props.TextFieldProps?.inputProps,
              style: {
                minWidth: this.props.inputMinWidth,
                ...this.props.TextFieldProps?.inputProps?.style,
              },
            }}
            InputProps={{
              ...params.InputProps,
              ...this.props.TextFieldProps?.InputProps,
              endAdornment: (
                <React.Fragment>
                  {this.props.loading && (
                    <Loading showImmediately />
                  )}
                  {this.props.TextFieldProps?.InputProps?.endAdornment || null}
                  {params.InputProps.endAdornment}
                </React.Fragment>
              ),
            }}
          />
        )}
      />
    );
  }
}

const getSelectionPopper = (propsOverride?: Partial<React.ComponentProps<typeof Popper>>) => (props: React.ComponentProps<typeof Popper>) => (
  <Popper
    {...props}
    {...propsOverride}
  />
);

export default withStyles(styles, { withTheme: true })(SelectionPicker);
