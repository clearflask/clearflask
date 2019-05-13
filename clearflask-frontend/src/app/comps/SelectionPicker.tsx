import React, { Component } from 'react';
import { ListProps } from '@material-ui/core/List';
import Select from 'react-select';
import CreatableSelect from 'react-select/lib/Creatable';
import Typography from '@material-ui/core/Typography';
import TextField from '@material-ui/core/TextField';
import Paper from '@material-ui/core/Paper';
import Chip from '@material-ui/core/Chip';
import MenuItem from '@material-ui/core/MenuItem';
import DropdownIcon from '@material-ui/icons/ArrowDropDown';
import DeleteIcon from '@material-ui/icons/CloseRounded';
import { FormHelperText } from '@material-ui/core';
import { SelectComponents, components } from 'react-select/lib/components';
import { ActionMeta } from 'react-select/lib/types';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';

const styles = (theme:Theme) => createStyles({
  dropdownIcon: {
    cursor: 'pointer',
    height: '24px',
    fontSize: '24px',
    color: theme.palette.type === 'light'
      ? theme.palette.text.secondary
      : theme.palette.text.primary,
  },
  deleteIcon: {
    cursor: 'pointer',
    height: '19px',
    fontSize: '19px',
    color: theme.palette.type === 'light'
      ? theme.palette.text.secondary
      : theme.palette.text.primary,
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
  label: string;
  value: string;
}

export type ColorLookup = { [value:string]: string; }

interface Props extends ListProps, WithStyles<typeof styles, true> {
  classes; // conflict
  label?:string;
  helperText?:string;
  placeholder?:string;
  errorMsg?:string;
  value?:Label[];
  options:Label[];
  colorLookup?:ColorLookup;
  disabled?:boolean;
  isMulti?:boolean;
  bare?:boolean;
  width?:string
  inputMinWidth?:string;
  overrideComponents?:Partial<SelectComponents<Label>>;
  formatCreateLabel?:(input:string)=>string;
  onValueChange:(labels:Label[], action: ActionMeta)=>void;
  onValueCreate?:(name:string)=>void;
}

class SelectionPicker extends Component<Props> {
  render() {
    const selectComponentProps = {
      options: this.props.options,
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
      value: this.props.value,
      onChange: (value, action) => this.props.onValueChange(this.props.isMulti ? value : (value ? [value] : []), action),
      placeholder: this.props.placeholder || '',
      isMulti: this.props.isMulti,
      isClearable: true,
      error: !!this.props.errorMsg,
      onCreateOption: this.props.onValueCreate,
      formatCreateLabel: this.props.onValueCreate ? this.props.formatCreateLabel : undefined,
    };
    return (
      <div>
        {this.props.onValueCreate
          ? (<CreatableSelect<Label> {...selectComponentProps} />)
          : (<Select<Label> {...selectComponentProps} />)}
        {(!this.props.bare && this.props.helperText || this.props.errorMsg) && (<FormHelperText style={{minWidth: this.props.inputMinWidth, width: this.props.width}} error={!!this.props.errorMsg}>{this.props.errorMsg || this.props.helperText}</FormHelperText>)}
      </div>
    );
  }
}

const NoOptionsMessage = (props) => {
  return (
    <Typography color="textSecondary" {...props.innerProps} style = {{
      padding: `${10}px ${10 * 2}px`,
    }}>
      {props.children}
    </Typography>
  );
}

const Input = (props) => {
  return (
    <div style={{
      minWidth: '20px',
    }}>
      <components.Input {...props}/>
    </div>
  );
}

const inputComponent = ({ inputRef, ...props }) => {
  return <div ref={inputRef} {...props} />;
}

const Control = (props) => {
  const outerProps:Props = props.selectProps.commonProps;
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
            paddingBottom: '3px',
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
          marginTop: '3px',
        },
        shrink: (outerProps.value !== undefined && outerProps.value.length !== 0 || outerProps.placeholder) ? true : undefined,
      }}
      error={!!outerProps.errorMsg}
    />
  );
}

const Option = (props) => {
  const outerProps:Props = props.selectProps.commonProps;
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
  const outerProps:Props = props.selectProps.commonProps;
  return (
    <DropdownIcon fontSize='inherit' className={outerProps.classes.dropdownIcon} />
  );
}

const ClearIndicator = (props) => {
  const outerProps:Props = props.selectProps.commonProps;
  const { innerProps: { ref, ...restInnerProps } } = props;
  return !outerProps.value || outerProps.value.length <= 1 ? null : (
      <DeleteIcon {...restInnerProps} fontSize='inherit' className={outerProps.classes.deleteIcon} />
  );
}

const Placeholder = (props) => {
  const outerProps:Props = props.selectProps.commonProps;
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
  const outerProps:Props = props.selectProps.commonProps;
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
  const outerProps:Props = props.selectProps.commonProps;
  return (
    <Chip
      variant='outlined'
      className={outerProps.classes.chip}
      tabIndex={-1}
      label={props.children}
      onDelete={props.removeProps.onClick}
      deleteIcon={<DeleteIcon {...props.removeProps} className={outerProps.classes.deleteIcon}/>}
      style={outerProps.colorLookup ? {color: outerProps.colorLookup[props.data.value]} : undefined}
    />
  );
}

const Menu = (props) => {
  return (
    <Paper square {...props.innerProps} style={{
      position: 'absolute',
      zIndex: 1,
      marginTop: 0,
      left: 0,
      right: 0,
      width: 'fit-content',
    }}>
      {props.children}
    </Paper>
  );
}

export default withStyles(styles, { withTheme: true })(SelectionPicker);
