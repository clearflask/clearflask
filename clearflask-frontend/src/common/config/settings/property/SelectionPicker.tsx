import React, { Component } from 'react';
import * as ConfigEditor from '../../configEditor';
import { ListProps } from '@material-ui/core/List';
import classNames from 'classnames';
import Select from 'react-select';
import Typography from '@material-ui/core/Typography';
import TextField from '@material-ui/core/TextField';
import { emphasize } from '@material-ui/core/styles/colorManipulator';
import Paper from '@material-ui/core/Paper';
import Chip from '@material-ui/core/Chip';
import MenuItem from '@material-ui/core/MenuItem';
import CancelIcon from '@material-ui/icons/Cancel';
import { ActionMeta } from 'react-select/lib/types';
import { FormHelperText } from '@material-ui/core';
import Property from '../Property';

interface Props extends ListProps {
  prop:ConfigEditor.LinkProperty|ConfigEditor.LinkMultiProperty;
  bare?:boolean;
  width?:string
  pageClicked:(path:ConfigEditor.Path)=>void;
  inputMinWidth:string;
}

export default class SelectionPicker extends Component<Props> {
  unsubscribe?:()=>void;

  componentDidMount() {
    this.unsubscribe = this.props.prop.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const prop = this.props.prop;
    return (
      <div>
        <Select<ConfigEditor.LinkPropertyOption>
          getOptionLabel={(o:ConfigEditor.LinkPropertyOption) => o.name}
          getOptionValue={(o:ConfigEditor.LinkPropertyOption) => o.id}
          textFieldProps={{
            label: !this.props.bare && prop.name,
            InputLabelProps: {
              shrink: (prop.value !== undefined && prop.value['size'] !== 0) ? true : undefined,
            },
            error: !!prop.errorMsg,
          }}
          options={prop.getOptions()}
          components={{
            Control,
            Menu,
            MultiValue,
            NoOptionsMessage,
            Option,
            Placeholder,
            SingleValue,
            ValueContainer,
          }}
          value={this.getValueOptions()}
          onChange={this.onChange.bind(this)}
          placeholder={''}
          // placeholder={this.props.prop.placeholder}
          isMulti={prop.type === ConfigEditor.PropertyType.LinkMulti}
          isClearable
          error={!!prop.errorMsg}
        />
        {(!this.props.bare || prop.errorMsg) && (<FormHelperText style={{minWidth: this.props.inputMinWidth, width: this.props.width}} error={!!prop.errorMsg}>{prop.errorMsg || prop.description}</FormHelperText>)}
      </div>
    );
  }
  
  getValueOptions():ConfigEditor.LinkPropertyOption[] {
    if(this.props.prop.value === undefined) {
      return [];
    }
    if(this.props.prop.type === ConfigEditor.PropertyType.Link) {
      const selectedOption = this.props.prop.getOptions()
        .find(o => o.id === this.props.prop.value);
      return selectedOption ? [selectedOption] : [];
    } else {
      return this.props.prop.getOptions()
        .filter(o => (this.props.prop.value as Set<string>).has(o.id));
    }
  }

  onChange(value, action) {
    console.log('debugdebug', JSON.stringify(value), JSON.stringify(action));
    if(this.props.prop.type === ConfigEditor.PropertyType.LinkMulti) {
      const optionValues = (value as ConfigEditor.LinkPropertyOption[]);
      this.props.prop.set(new Set<string>(optionValues.map(o => o.id)));
    } else {
      const optionValue = (value as ConfigEditor.LinkPropertyOption|null);
      this.props.prop.set(optionValue === null ? undefined : optionValue.id);
    }
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

const inputComponent = ({ inputRef, ...props }) => {
  return <div ref={inputRef} {...props} />;
}

const Control = (props) => {
  return (
    <TextField
      fullWidth
      InputProps={{
        inputComponent,
        inputProps: {
          style: {
            display: 'flex',
            padding: 0,
          },
          inputRef: props.innerRef,
          children: props.children,
          ...props.innerProps,
        },
      }}
      {...props.selectProps.textFieldProps}
    />
  );
}

const Option = (props) => {
  return (
    <MenuItem
      buttonRef={props.innerRef}
      selected={props.isFocused}
      component="div"
      style={{
        fontWeight: props.isSelected ? 500 : 400,
      }}
      {...props.innerProps}
    >
      {props.children}
    </MenuItem>
  );
}

const Placeholder = (props) => {
  return (
    <Typography color="textSecondary" {...props.innerProps} style={{
      position: 'absolute',
      left: 2,
      fontSize: 16,
    }}>
      {props.children}
    </Typography>
  );
}

const SingleValue = (props) => {
  return (
    <Typography {...props.innerProps} style={{
      fontSize: 16,
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
  return (
    <Chip
      style={{
        margin: '5px 2px',
      }}
      tabIndex={-1}
      label={props.children}
      onDelete={props.removeProps.onClick}
      deleteIcon={<CancelIcon {...props.removeProps} />}
    />
  );
}

const Menu = (props) => {
  return (
    <Paper square {...props.innerProps} style={{
      position: 'absolute',
      zIndex: 1,
      marginTop: 10,
      left: 0,
      right: 0,
    }}>
      {props.children}
    </Paper>
  );
}
