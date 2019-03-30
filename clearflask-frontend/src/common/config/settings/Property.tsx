import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { Typography, TextField, RadioGroup, FormControlLabel, Radio } from '@material-ui/core';

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
    switch(prop.type) {
      default:
      case 'string':
      case 'number':
      case 'integer':
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
      case 'boolean':
        break;
      case 'enum':
        propertySetter = (
          <RadioGroup
            name={name}
            value={this.state.value}
            onChange={this.handlePropChange.bind(this)}
          >
            {prop.items.map(item => (
              <FormControlLabel
                label={item.name}
                value={item.value}
                control={<Radio />}
              />
            ))}
          </RadioGroup>
        );
        break;
      case 'array':
        break;
      case 'object':
        break;
    }

    return (
      <div>
        {propertySetter}
      </div>
    );
  }

  handlePropChange(event) {
    const newValue = event.target.value;

    const prop = this.props.prop;
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
