import React, { Component } from 'react';
import * as ConfigEditor from '../../configEditor';
import { ListProps } from '@material-ui/core/List';
import Select from 'react-select';
import CreatableSelect from 'react-select/lib/Creatable';
import Typography from '@material-ui/core/Typography';
import TextField from '@material-ui/core/TextField';
import Paper from '@material-ui/core/Paper';
import Chip from '@material-ui/core/Chip';
import MenuItem from '@material-ui/core/MenuItem';
import CancelIcon from '@material-ui/icons/Cancel';
import { FormHelperText } from '@material-ui/core';

/** Label type used by react-select */
interface Label {
  label: string;
  value: string;
}

interface Props extends ListProps {
  key:string;
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
    const selectComponentProps = {
      textFieldProps: {
        label: !this.props.bare && prop.name,
        InputLabelProps: {
          shrink: (prop.value !== undefined && prop.value['size'] !== 0) ? true : undefined,
        },
        error: !!prop.errorMsg,
      },
      options: this.mapOptionToLabel(prop.getOptions()),
      components: {
        Control,
        Menu,
        MultiValue,
        NoOptionsMessage,
        Option,
        Placeholder,
        SingleValue,
        ValueContainer,
      },
      commonProps: this.props,
      value: this.mapOptionToLabel(this.getValueOptions()),
      onChange: this.onChange.bind(this),
      placeholder: '',
      isMulti: prop.type === ConfigEditor.PropertyType.LinkMulti,
      isClearable: true,
      error: !!prop.errorMsg,
      onCreateOption: prop.allowCreate ? this.onCreate.bind(this) : undefined,
    };
    return (
      <div>
        {prop.allowCreate
          ? (<CreatableSelect<Label> {...selectComponentProps} />)
          : (<Select<Label> {...selectComponentProps} />)}
        {(!this.props.bare || prop.errorMsg) && (<FormHelperText style={{minWidth: this.props.inputMinWidth, width: this.props.width}} error={!!prop.errorMsg}>{prop.errorMsg || prop.description}</FormHelperText>)}
      </div>
    );
  }

  mapOptionToLabel(options:ConfigEditor.LinkPropertyOption[]):Label[] {
    return options.map(o => {return {label: o.name, value: o.id}});
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

  onCreate(inputValue:string):void {
    this.props.prop.create(inputValue);
  }

  onChange(value, action) {
    if(this.props.prop.type === ConfigEditor.PropertyType.LinkMulti) {
      const optionValues = (value as Label[]);
      this.props.prop.set(new Set<string>(optionValues.map(o => o.value)));
    } else {
      const optionValue = (value as Label|null);
      this.props.prop.set(optionValue === null ? undefined : optionValue.value);
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
  const propsOuter:Props = props.selectProps.commonProps;
  return (
    <TextField
      InputProps={{
        inputComponent,
        inputProps: {
          style: {
            display: 'flex',
            padding: 0,
            minWidth: propsOuter.inputMinWidth,
            width: propsOuter.width,
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
