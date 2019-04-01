import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { Typography, TextField, RadioGroup, FormControlLabel, Radio, Checkbox, Switch, FormHelperText, FormControl, InputLabel, Select, MenuItem, Input } from '@material-ui/core';
import TableProp from './TableProp';
import ColorPicker from 'material-ui-color-picker'

interface Props {
  prop:ConfigEditor.Property;
  bare?:boolean;
}

interface State {
  invalidValue:boolean;
  value?:any;
}

export default class Property extends Component<Props, State> {

  constructor(props:Props) {
    super(props);
    this.state = {
      invalidValue: false,
      value: props.prop.value,
    };
  }

  render() {
    const prop = this.props.prop;
    const name = prop.name || prop.path.join('.');
    var propertySetter;
    OUTER: switch(prop.type) {
      default:
      case ConfigEditor.PropertyType.String:
        switch(prop.subType) {
          case ConfigEditor.PropSubType.Id:
            // ID is an invisible field
            propertySetter = null;
            break OUTER;
          case ConfigEditor.PropSubType.Color:
            propertySetter = (
              <div>
                <ColorPicker
                  label={!this.props.bare && name}
                  name='color'
                  placeholder='#000'
                  defaultValue={prop.defaultValue}
                  value={this.state.value}
                  onChange={this.handlePropChange.bind(this)}
                  TextFieldProps={{
                    InputLabelProps:{
                      shrink: (this.state.value !== undefined && this.state.value !== '') ? true : undefined
                    }
                  }}
                />
                <FormHelperText>{!this.props.bare && prop.description}</FormHelperText>
              </div>
            );
            break OUTER;
          default:
            // Fall through to below
        }
      case ConfigEditor.PropertyType.Number:
      case ConfigEditor.PropertyType.Integer:
        propertySetter = (
          <TextField
            id={prop.path.join('.')}
            label={!this.props.bare && name}
            value={this.state.value}
            onChange={this.handlePropChange.bind(this)}
            error={this.state.invalidValue}
            placeholder={prop.placeholder}
            helperText={!this.props.bare && prop.description}
            margin='normal'
            type={prop.type === 'string' ? 'text' : 'number'}
          />
        );
        break;
      case ConfigEditor.PropertyType.Boolean:
      case ConfigEditor.PropertyType.Enum:
        if(prop.required && prop.type === ConfigEditor.PropertyType.Boolean) {
          propertySetter = (
            <div>
              <FormControlLabel
                control={(
                  <Switch
                    checked={!!prop.value}
                    onChange={this.handlePropChange.bind(this)}
                  />
                )}
                label={!this.props.bare && name}
              />
              <FormHelperText>{!this.props.bare && prop.description}</FormHelperText>
            </div>
          );
          break;
        }
        const items:{
          name:string;
          value:any;
        }[] = prop.type === ConfigEditor.PropertyType.Boolean
          ? [{name: 'Not set', value: undefined},
            {name: 'Enabled', value: true},
            {name: 'Disabled', value: false}]
          : prop.items;
        const currentItem = items.find(item => item.value === this.state.value);
        const shrink = !!(this.state.value !== undefined && currentItem && currentItem.name);
        propertySetter = (
          <FormControl>
            <InputLabel shrink={shrink}>{!this.props.bare && name}</InputLabel>
            <Select
              value={this.state.value}
              onChange={this.handlePropChange.bind(this)}
            >
              {items.map(item => (
                <MenuItem value={item.value}>{item.value === undefined
                  ? (<em>{item.name}</em>)
                  : item.name
                }</MenuItem>
              ))}
            </Select>
            <FormHelperText>{!this.props.bare && prop.description}</FormHelperText>
          </FormControl>
        );
        break;
      case ConfigEditor.PropertyType.Array:
        propertySetter = (
          <TableProp data={prop} />
        );
        break;
      case ConfigEditor.PropertyType.Object:
        const subProps = prop.childProperties && prop.childProperties.map(childProp => (
          <Property {...this.props} prop={childProp} />
        ));
        propertySetter = (
          <div>
            <Typography variant='subtitle1'>{name}</Typography>
            <FormHelperText>{prop.description}</FormHelperText>
            {prop.required && (
              <div>
                <FormControlLabel
                  control={(
                    <Switch
                      checked={!!prop.value}
                      onChange={this.handlePropChange.bind(this)}
                    />
                  )}
                  label={!this.props.bare && name}
                />
                <FormHelperText>{prop.description}</FormHelperText>
              </div>
            )}
            {(prop.required || prop.value) && (
            <div style={{marginLeft: '25px'}}>
              {subProps}
            </div>
          )}
          </div>
        );
        break;
    }

    return (
      <div style={{marginTop: '20px'}}>
        {propertySetter}
      </div>
    );
  }

  handlePropChange(event) {
    const prop = this.props.prop;

    var newValue;
    if(prop.required && prop.type === ConfigEditor.PropertyType.Boolean) {
      newValue = event.target.checked;
    } else if(prop.subType === ConfigEditor.PropSubType.Color) {
      newValue = event;
    } else {
      newValue = event.target.value;
    }

    if(!newValue && prop.required) {
      this.setState({
        value: newValue,
        invalidValue: true,
      });
      return;
    }
    // TODO input validation
    switch(prop.type) {
      default:
      case ConfigEditor.PropertyType.String:
        prop.set(newValue);
        break;
      case ConfigEditor.PropertyType.Number:
        prop.set(newValue);
        break;
      case ConfigEditor.PropertyType.Integer:
        prop.set(newValue);
        break;
      case ConfigEditor.PropertyType.Boolean:
        prop.set(newValue);
        break;
      case ConfigEditor.PropertyType.Enum:
        prop.set(newValue);
        break;
      case ConfigEditor.PropertyType.Array:
        prop.set(newValue);
        break;
      case ConfigEditor.PropertyType.Object:
        prop.set(newValue);
        break;
    }
    this.setState({
      value: newValue,
      invalidValue: false,
    });
  }
}
