import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { Typography, TextField, RadioGroup, FormControlLabel, Radio, Checkbox, Switch, FormHelperText } from '@material-ui/core';
import TableProp from './TableProp';

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
      case ConfigEditor.PropertyType.String:
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
      case ConfigEditor.PropertyType.Enum:
        propertySetter = (
          <RadioGroup
            name={name}
            value={this.state.value}
            onChange={this.handlePropChange.bind(this)}
          >
            {prop.items.map(item => (
              <FormControlLabel
                label={item.name}
                checked={prop.value === item.value}
                control={<Radio />}
                value={item.value}
                onChange={this.handlePropChange.bind(this)}
              />
            ))}
            <FormHelperText>{!this.props.bare && prop.description}</FormHelperText>
          </RadioGroup>
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
      <div>
        <div>
          {/* PROP: {JSON.stringify(prop)} */}
        </div>
        {propertySetter}
      </div>
    );
  }

  handlePropChange(event) {
    const prop = this.props.prop;

    var newValue;
    switch(prop.type) {
      case ConfigEditor.PropertyType.Boolean:
        newValue = event.target.checked;
        break;
      default:
        newValue = event.target.value;
        break;
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
