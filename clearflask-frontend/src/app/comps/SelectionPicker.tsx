import { FormHelperText, Grow } from '@material-ui/core';
import Chip from '@material-ui/core/Chip';
import { ListProps } from '@material-ui/core/List';
import MenuItem from '@material-ui/core/MenuItem';
import Paper from '@material-ui/core/Paper';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import DropdownIcon from '@material-ui/icons/ArrowDropDown';
import DeleteIcon from '@material-ui/icons/CloseRounded';
import React, { Component } from 'react';
import Select from 'react-select';
import { components, SelectComponents } from 'react-select/lib/components';
import CreatableSelect, { Props as SelectProps } from 'react-select/lib/Creatable';
import { ActionMeta, InputActionMeta } from 'react-select/lib/types';

const styles = (theme: Theme) => createStyles({
  dropdownIcon: {
    cursor: 'pointer',
    height: '24px',
    fontSize: '24px',
    color: theme.palette.text.hint,
  },
  deleteIcon: {
    cursor: 'pointer',
    height: '19px',
    fontSize: '19px',
    color: theme.palette.text.primary,
    marginTop: '1px',
  },
  chip: {
    height: 22,
    marginTop: 1,
    margin: '1px 2px 4px 2px',
  },
});

/** Label type used by react-select */
export interface Label {
  label: string | React.ReactNode;
  value: string;
}

export type ColorLookup = { [value: string]: string; }

interface Props extends ListProps, WithStyles<typeof styles, true> {
  classes; // conflict
  className?: string;
  label?: string;
  helperText?: string;
  placeholder?: string;
  errorMsg?: string;
  value?: Label[];
  inputValue?: string;
  menuIsOpen?: boolean;
  options: Label[];
  colorLookup?: ColorLookup;
  disabled?: boolean;
  isMulti?: boolean;
  showClearWithOneValue?: boolean;
  bare?: boolean;
  width?: string
  inputMinWidth?: string | number;
  overrideComponents?: Partial<SelectComponents<Label>>;
  formatCreateLabel?: (input: string) => string;
  onInputChange?: (newValue: string, actionMeta: InputActionMeta) => void;
  onValueChange: (labels: Label[], action: ActionMeta) => void;
  onValueCreate?: (name: string) => void;
}

class SelectionPicker extends Component<Props> {
  render() {
    const selectComponentProps: SelectProps<Label> = {
      options: this.props.options || [],
      openOnFocus: true,
      menuIsOpen: this.props.menuIsOpen,
      components: {
        IndicatorSeparator: () => null,
        Control,
        Input,
        Menu,
        MultiValue,
        NoOptionsMessage,
        Option,
        Placeholder,
        SingleValue,
        ValueContainer,
        DropdownIndicator,
        ClearIndicator,
        ...this.props.overrideComponents,
      },
      commonProps: this.props,
      value: this.props.value || [],
      onChange: (value, action) => {
        if (this.props.isMulti) {
          this.props.onValueChange((value || []) as Label[], action);
        } else {
          this.props.onValueChange((value ? [value] : []) as Label[], action);
        }
      },
      inputValue: this.props.inputValue,
      onInputChange: !!this.props.onInputChange ? (newValue, actionMeta) => {
        this.props.onInputChange!(newValue, actionMeta);
        // Prevent returning any value here as it updates inputValue without documentation
      } : undefined,
      placeholder: this.props.placeholder || '',
      isMulti: !!this.props.isMulti,
      isClearable: true,
      error: !!this.props.errorMsg,
      onCreateOption: this.props.onValueCreate,
      formatCreateLabel: this.props.onValueCreate ? this.props.formatCreateLabel : undefined,
    };
    return (
      <div className={this.props.className}>
        {this.props.onValueCreate
          ? (<CreatableSelect<Label> {...selectComponentProps} />)
          : (<Select<Label> {...selectComponentProps} />)}
        {(!this.props.bare && this.props.helperText || this.props.errorMsg) && (<FormHelperText style={{ minWidth: this.props.inputMinWidth, width: this.props.width }} error={!!this.props.errorMsg}>{this.props.errorMsg || this.props.helperText}</FormHelperText>)}
      </div>
    );
  }
}

const NoOptionsMessage = (props) => {
  return (
    <Typography color="textSecondary" {...props.innerProps} style={{
      padding: `${10}px ${10 * 2}px`,
    }}>
      {props.children}
    </Typography>
  );
}

const Input = (props) => {
  const outerProps: Props = props.selectProps.commonProps;
  return (
    <div style={{
      minWidth: '20px',
    }}>
      <components.Input {...props} isDisabled={outerProps.disabled} />
    </div>
  );
}

const inputComponent = ({ inputRef, ...props }) => {
  return <div ref={inputRef} {...props} />;
}

const Control = (props) => {
  const outerProps: Props = props.selectProps.commonProps;
  return (
    <TextField
      style={{
        verticalAlign: 'baseline',
        width: outerProps.width,
      }}
      InputProps={{
        inputComponent: inputComponent as any,
        inputProps: {
          style: {
            display: 'flex',
            minWidth: outerProps.inputMinWidth,
            width: outerProps.width,
            paddingBottom: 3,
            paddingTop: 0,
            height: 'unset',
          },
          inputRef: props.innerRef,
          children: props.children,
          ...props.innerProps,
        },
      }}
      label={!outerProps.bare && outerProps.label}
      disabled={outerProps.disabled}
      InputLabelProps={{
        style: {
          marginTop: '1px',
        },
        // TODO When placeholder is set, this never shrinks
        shrink: (((outerProps.value !== undefined && outerProps.value.length !== 0) || (outerProps.inputValue !== undefined && outerProps.inputValue !== ''))
          || outerProps.placeholder) ? true : undefined,
      }}
      error={!!outerProps.errorMsg}
    />
  );
}

const Option = (props) => {
  const outerProps: Props = props.selectProps.commonProps;
  return (
    <MenuItem
      buttonRef={props.innerRef}
      selected={props.isFocused}
      component="div"
      style={{
        fontWeight: props.isSelected ? 500 : 400,
        color: outerProps.colorLookup ? outerProps.colorLookup[props.data.value] : undefined,
      }}
      {...props.innerProps}
    >
      {props.children}
    </MenuItem>
  );
}

const DropdownIndicator = (props) => {
  const outerProps: Props = props.selectProps.commonProps;
  return (
    <DropdownIcon fontSize='inherit' className={outerProps.classes.dropdownIcon} />
  );
}

const ClearIndicator = (props) => {
  const outerProps: Props = props.selectProps.commonProps;
  const { innerProps: { ref, ...restInnerProps } } = props;
  return !outerProps.value || outerProps.value.length <= (outerProps.showClearWithOneValue ? 0 : 1) ? null : (
    <DeleteIcon {...restInnerProps} fontSize='inherit' className={outerProps.classes.deleteIcon} />
  );
}

const Placeholder = (props) => {
  const outerProps: Props = props.selectProps.commonProps;
  return (
    <Typography color="textSecondary" {...props.innerProps} style={{
      position: 'absolute',
      left: 2,
      fontSize: 16,
      color: outerProps.theme.palette.text.hint,
    }}>
      {props.children}
    </Typography>
  );
}

const SingleValue = (props) => {
  const outerProps: Props = props.selectProps.commonProps;
  return (
    <Typography {...props.innerProps} style={{
      fontSize: 16,
      color: outerProps.colorLookup ? outerProps.colorLookup[props.data.value] : undefined,
    }}>
      {props.children}
    </Typography>
  );
}

const ValueContainer = (props) => {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      flex: 1,
      alignItems: 'center',
      overflow: 'hidden',
    }}>
      {props.children}
    </div>
  );
}

const MultiValue = (props) => {
  const outerProps: Props = props.selectProps.commonProps;
  return (
    <Chip
      variant='outlined'
      className={outerProps.classes.chip}
      tabIndex={-1}
      label={props.children}
      onDelete={props.removeProps.onClick}
      deleteIcon={<DeleteIcon {...props.removeProps} className={outerProps.classes.deleteIcon} />}
      style={outerProps.colorLookup ? { color: outerProps.colorLookup[props.data.value] } : undefined}
    />
  );
}

const Menu = (props) => {
  return (
    <Grow appear in style={{ transformOrigin: '0 0 0' }}>
      <Paper elevation={2} square {...props.innerProps} style={{
        position: 'absolute',
        zIndex: 1,
        marginTop: 0,
        left: 0,
        right: 0,
        width: 'fit-content',
      }}>
        {props.children}
      </Paper>
    </Grow>
  );
}

export default withStyles(styles, { withTheme: true })(SelectionPicker);
