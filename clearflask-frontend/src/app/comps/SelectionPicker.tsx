import { Chip, Fade, Popper, SvgIconTypeMap, Typography } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { ClassNameMap } from '@material-ui/core/styles/withStyles';
import TextField from '@material-ui/core/TextField';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import { Autocomplete, AutocompleteClassKey, AutocompleteGetTagProps, AutocompleteInputChangeReason, AutocompleteRenderGroupParams, createFilterOptions } from '@material-ui/lab';
import classNames from 'classnames';
import React, { Component } from 'react';

const filterOptions = createFilterOptions({
  matchFrom: 'any',
  ignoreCase: true,
  ignoreAccents: true,
  trim: true,
  stringify: (option: Label) => option.filterString || option.value,
});

export interface Label {
  label: string | React.ReactNode;
  filterString?: string;
  value: string;
  groupBy?: string;
  color?: string;
  disabled?: boolean;
}
interface LabelInternal extends Label {
  isCreateOption?: boolean;
}

const styles = (theme: Theme) => createStyles({
  autocomplete: {
    minWidth: (props: Props) => props.minWidth,
    maxWidth: (props: Props) => props.maxWidth,
    width: (props: Props) => props.width,
    transition: (props: Props) => theme.transitions.create(['min-width'], props.isInExplorer ? { duration: theme.explorerExpandTimeout } : undefined),
  },
  autocompleteFocused: {
    minWidth: (props: Props) => props.maxWidth,
  },
  dropdownIconDontFlip: {
    transform: 'unset',
  },
  endAdornment: {
    position: 'unset',
    display: 'flex',
    justifyContent: 'end',
    // Grow, but not as much as the input className
    flex: '1 0 auto',
  },
  input: {
    // Grow, faster then the endAdornment
    flex: '100000 0 auto',
    // Add 4px on left here to separate from chips, see inputRoot className
    padding: '6px 0 6px 4px!important',
  },
  inputRoot: {
    paddingRight: '0!important',
    // Take away separating padding between chips and input if not chips, see input className
    '& $input:first-child': {
      paddingLeft: '0!important',
    },
  },
  chip: {
    // Setting margin that was unset in tag className below
    margin: 3,
  },
  tag: {
    // tag className also applies to limitTags span, use chip className above
    margin: 0,
  },
  menuHeader: {
    margin: theme.spacing(2, 1.5),
  },
  popper: {
    minWidth: (props: Props) => props.maxWidth || 'max-content',
    width: (props: Props) => props.popupColumnCount ? `${(props.popupColumnWidth || 130) * props.popupColumnCount}px!important` : undefined,
  },
  popperListbox: {
    margin: (props: Props) => props.popupColumnCount ? theme.spacing(0, 1) : undefined,
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
  flexWrapBreak: {
    height: 0,
    width: '100%',
    flex: '1 0 auto',
  },
  dropdownIconWithTags: {
    color: theme.palette.primary.main,
  },
  dropdownIconWithoutTags: {
    color: theme.palette.text.hint,
  },
});
interface Props {
  isMulti?: boolean;
  disableInput?: boolean;
  value: Label[];
  options: Label[];
  onValueChange: (labels: Label[]) => void;
  onValueCreate?: (name: string) => void;
  showCreateAtTop?: boolean;
  className?: string;
  TextFieldProps?: Partial<React.ComponentProps<typeof TextField>>;
  inputValue?: string;
  menuIsOpen?: boolean;
  // undefined: default, boolean: force show or hide
  showTags?: boolean;
  bareTags?: boolean;
  disableFilter?: boolean;
  menuOnChange?: (open: boolean) => void;
  onInputChange?: (newValue: string, reason: 'input' | 'reset' | 'clear') => void;
  noOptionsMessage?: string;
  disabled?: boolean;
  disableClearable?: boolean;
  group?: boolean;
  onFocus?: () => void;
  formatHeader?: (input: string) => React.ReactNode;
  formatCreateLabel?: (input: string) => string;
  loading?: boolean;
  alwaysWrapChipsInput?: boolean;
  forceDropdownIcon?: boolean;
  dropdownIcon?: OverridableComponent<SvgIconTypeMap> | null;
  limitTags?: number;
  isInExplorer?: boolean;
  minWidth?: string | number;
  maxWidth?: string | number;
  renderOption?: (label: Label, selected: boolean) => React.ReactNode;
  disableCloseOnSelect?: boolean;
  autocompleteClasses?: Partial<ClassNameMap<AutocompleteClassKey>>;
  popupColumnCount?: number;
  popupColumnWidth?: number;
  PopperProps?: Partial<React.ComponentProps<typeof Popper>>;
  clearOnBlur?: boolean;
  disableClearOnValueChange?: boolean;

  // Below props are for backwards compatibility, use TextFieldProps instead
  label?: string;
  helperText?: string;
  placeholder?: string;
  errorMsg?: string;
  width?: number | string;
  inputMinWidth?: string | number;
}
interface State {
  inputValue?: string;
}
class SelectionPicker extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};
  render() {
    const DropdownIcon = this.props.dropdownIcon || ArrowDropDownIcon;
    const onInputChange = (e, val: string, reason: AutocompleteInputChangeReason) => {
      if (reason === 'reset') return; // Prevent setting text value in textfield
      if (this.props.onInputChange) {
        this.props.onInputChange(val, reason);
      }
      if (this.props.inputValue === undefined) {
        this.setState({ inputValue: val });
      }
    };
    const renderTags = (value: Label[], getTagProps?: AutocompleteGetTagProps) => this.props.showTags === false ? null : value.map((option, index) => (
      <Fade key={option.value} in={true}>
        {this.props.bareTags ? (
          <div
            className={this.props.classes.chip}
            style={{
              color: option.color,
            }}
            {...(getTagProps ? getTagProps({ index }) : {})}
          >{option.label}</div>
        ) : (
          <Chip
            className={this.props.classes.chip}
            variant='outlined'
            label={option.label}
            size='small'
            style={{
              color: option.color,
            }}
            {...(getTagProps ? getTagProps({ index }) : {})}
          />
        )}
      </Fade>
    ));
    return (
      <Autocomplete<LabelInternal, boolean, boolean, boolean>
        freeSolo={!this.props.disableInput}
        autoHighlight
        multiple={!!this.props.isMulti}
        value={this.props.isMulti ? this.props.value : (this.props.value[0] || null)}
        onChange={(e, val, reason) => {
          // Convert create label to create-option
          var createLabel: LabelInternal | undefined;
          if (this.props.isMulti && val instanceof Array) {
            createLabel = (val as LabelInternal[]).find(label => label.isCreateOption);
          } else if (!this.props.isMulti && val instanceof Object && (val as LabelInternal).isCreateOption) {
            createLabel = (val as LabelInternal);
          }
          if (createLabel) {
            reason = 'create-option';
            val = createLabel.value;
          }

          if (reason === 'create-option') {
            this.props.onValueCreate && this.props.onValueCreate(val as any as string);
            onInputChange(undefined, '', 'clear');
          } else if (reason === 'clear' || reason === 'blur') {
            this.props.onValueChange([]);
          } else if (reason === 'select-option' || reason === 'remove-option') {
            this.props.onValueChange(!val ? [] : (this.props.isMulti ? val as Label[] : [val as Label]));
            if (!this.props.disableClearOnValueChange) {
              onInputChange(undefined, '', 'clear');
            }
          }
        }}
        disableCloseOnSelect={this.props.disableCloseOnSelect}
        filterSelectedOptions={true}
        filterOptions={(options, params) => {
          // Sometimes autocomplete decides to pre-filter, so use options from props
          var filtered: LabelInternal[] = [...this.props.options];

          if (!this.props.disableFilter) {
            filtered = filterOptions(options, params);
          }

          // Suggest the creation of a new value
          if (!!this.props.onValueCreate && params.inputValue !== '') {
            const createLabel = {
              label: this.props.formatCreateLabel
                ? this.props.formatCreateLabel(params.inputValue)
                : `Add "${params.inputValue}"`,
              value: params.inputValue,
              groupBy: '__EMPTY__',
              isCreateOption: true,
            };
            if (this.props.showCreateAtTop) {
              filtered.unshift(createLabel);
            } else {
              filtered.push(createLabel);
            }
          }

          // Header
          if (!!this.props.formatHeader) {
            const header = this.props.formatHeader(params.inputValue);
            if (header) {
              filtered.unshift({
                label: header,
                value: '__HEADER__',
                groupBy: '__HEADER__',
                disabled: true,
              });
            }
          }

          // Add loading
          if (this.props.loading) {
            filtered.push({
              label: 'Loading…',
              value: '__HEADER__',
              groupBy: '__HEADER__',
              disabled: true,
            });
          }

          if (this.props.noOptionsMessage && filtered.length === 0) {
            filtered.push({
              label: this.props.noOptionsMessage,
              value: '__HEADER__',
              groupBy: '__HEADER__',
              disabled: true,
            });
          }

          return filtered;
        }}
        popupIcon={DropdownIcon === null ? null : (
          <DropdownIcon
            fontSize='small'
            color='inherit'
            className={this.props.value.length > 0
              ? this.props.classes.dropdownIconWithTags
              : this.props.classes.dropdownIconWithoutTags}
          />
        )}
        forcePopupIcon={this.props.forceDropdownIcon !== undefined ? this.props.forceDropdownIcon : (!!this.props.dropdownIcon || 'auto')}
        options={this.props.options}
        getOptionLabel={option => option.filterString || option.value}
        getOptionSelected={(option, value) => option.value === value.value}
        inputValue={this.props.inputValue !== undefined
          ? this.props.inputValue
          : (this.state.inputValue || '')}
        onInputChange={onInputChange}
        className={this.props.className}
        limitTags={this.props.limitTags}
        disabled={this.props.disabled}
        getOptionDisabled={option => !!option.disabled}
        groupBy={this.props.group ? (label: Label) => label.groupBy || label.value[0] : undefined}
        renderGroup={this.props.group ? (params: AutocompleteRenderGroupParams) => (
          <div className={classNames(this.props.classes.group, params.group === '__HEADER__' && this.props.classes.header)}>
            {params.group && params.group !== '__EMPTY__' && params.group !== '__HEADER__' && (
              <Typography key={params.key} variant='overline' className={this.props.classes.menuHeader}>{params.group}</Typography>
            )}
            {params.children}
          </div>
        ) : undefined}
        getLimitTagsText={this.props.limitTags === 0 ? more => null : undefined}
        handleHomeEndKeys
        openOnFocus
        onFocus={this.props.onFocus}
        onBlur={e => {
          if (this.props.clearOnBlur) {
            onInputChange(undefined, '', 'clear');
          }
        }}
        renderOption={(option: Label, { selected }) => (
          <Typography
            noWrap
            style={{
              fontWeight: selected ? 'bold' : undefined,
              color: option.color,
            }}
            component='div'
          >
            {(option.value !== '__HEADER__' && this.props.renderOption)
              ? this.props.renderOption(option, selected)
              : option.label}
          </Typography>
        )}
        renderTags={renderTags}
        open={this.props.menuIsOpen}
        disableClearable={this.props.disableClearable || this.props.value.length === 0}
        onOpen={this.props.menuOnChange ? () => this.props.menuOnChange && this.props.menuOnChange(true) : undefined}
        onClose={this.props.menuOnChange ? () => this.props.menuOnChange && this.props.menuOnChange(false) : undefined}
        classes={{
          ...this.props.autocompleteClasses,
          root: classNames(this.props.classes.autocomplete, this.props.autocompleteClasses?.root),
          focused: classNames(this.props.classes.autocompleteFocused, this.props.autocompleteClasses?.focused),
          popupIndicatorOpen: classNames(!!this.props.dropdownIcon && this.props.classes.dropdownIconDontFlip, this.props.autocompleteClasses?.popupIndicator),
          endAdornment: classNames(this.props.classes.endAdornment, this.props.autocompleteClasses?.endAdornment),
          input: classNames(this.props.classes.input, this.props.autocompleteClasses?.input),
          inputRoot: classNames(this.props.classes.inputRoot, this.props.autocompleteClasses?.inputRoot),
          popper: classNames(this.props.classes.popper, this.props.autocompleteClasses?.popper),
          listbox: classNames(this.props.classes.popperListbox, this.props.autocompleteClasses?.listbox),
          tag: classNames(this.props.classes.tag, this.props.autocompleteClasses?.tag),
        }}
        PopperComponent={getSelectionPopper(this.props.PopperProps)}
        renderInput={(params) => {
          // Remove limitTags span element since it's just taking up space
          const paramsStartAdornment = (params.InputProps.startAdornment as Array<any>);
          if (this.props.limitTags === 0
            && paramsStartAdornment
            && paramsStartAdornment[0]['type'] === 'span') {
            paramsStartAdornment.shift();
          }
          return (
            <TextField
              label={this.props.label}
              helperText={this.props.errorMsg || this.props.helperText}
              placeholder={(!!this.props.bareTags && this.props.value.length > 0)
                ? undefined
                : this.props.placeholder}
              error={!!this.props.errorMsg}
              {...params}
              {...this.props.TextFieldProps}
              InputLabelProps={{
                ...params.InputLabelProps,
                ...this.props.TextFieldProps?.InputLabelProps,
              }}
              inputProps={{
                ...params.inputProps,
                ...this.props.TextFieldProps?.inputProps,
                style: {
                  minWidth: this.props.inputMinWidth === undefined
                    ? (this.props.disableInput ? 0 : 50)
                    : this.props.inputMinWidth,
                  ...this.props.TextFieldProps?.inputProps?.style,
                },
              }}
              InputProps={{
                ...params.InputProps,
                ...this.props.TextFieldProps?.InputProps,
                readOnly: this.props.disableInput || this.props.TextFieldProps?.InputProps?.readOnly,
                startAdornment: (
                  <>
                    {this.props.TextFieldProps?.InputProps?.endAdornment || null}
                    {!!this.props.showTags
                      && !this.props.isMulti
                      && this.props.value.length > 0
                      && renderTags(this.props.value)}
                    {params.InputProps.startAdornment}
                    {!!this.props.alwaysWrapChipsInput && !!paramsStartAdornment?.length && (
                      <div className={this.props.classes.flexWrapBreak} />
                    )}
                  </>
                ),
                endAdornment: (
                  <>
                    {this.props.TextFieldProps?.InputProps?.endAdornment || null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          );
        }}
      />
    );
  }
}

const getSelectionPopper = (propsOverride?: Partial<React.ComponentProps<typeof Popper>>) => (props: React.ComponentProps<typeof Popper>) => (
  <Popper
    {...props}
    disablePortal
    placement='bottom-start'
    {...propsOverride}
  />
);

export default withStyles(styles, { withTheme: true })(SelectionPicker);
