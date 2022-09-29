// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { TextField } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    justifyContent: 'center',
    margin: theme.spacing(1, 0, 1, 1),
  },
  field: {
    margin: theme.spacing(0, 1, 0, 0),
  },
  fieldInput: {
    textAlign: 'center',
    fontSize: '1.5em',
  },
});

interface Props extends WithStyles<typeof styles, true> {
  digits: number;
  disabled?: boolean;
  value?: (number | undefined)[];
  onChange: (newValue: (number | undefined)[], isComplete: boolean) => void;
}

class DigitsInput extends Component<Props> {
  inputRefs: Array<React.RefObject<HTMLInputElement>> = [];

  render() {
    while (this.inputRefs.length < this.props.digits) {
      this.inputRefs.push(React.createRef());
    }

    const digitInputs: React.ReactNode[] = [];
    for (var i = 0; i < this.props.digits; i++) {
      const textFieldId = i;
      digitInputs.push((
        <TextField
          key={textFieldId}
          inputRef={this.inputRefs[i]}
          className={this.props.classes.field}
          disabled={this.props.disabled}
          inputProps={{
            size: 1,
            className: this.props.classes.fieldInput,
            onKeyDown: (e) => {
              if (e.keyCode === 8 && this.props.value?.[textFieldId] === undefined) {
                this.inputRefs[textFieldId - 1]?.current?.focus();
              }
            },
          }}
          value={this.props.value?.[textFieldId] !== undefined ? this.props.value?.[textFieldId] : ''}
          onChange={e => {
            var newDigit;
            if (e.target.value === undefined || e.target.value === '') {
              newDigit = undefined;
            } else if (e.target.value.length === 2) {
              // In case there are two letters, pick the different one,
              // or at least one that is a number
              const digit1 = parseInt(e.target.value[0]);
              const digit2 = parseInt(e.target.value[1]);
              if (isNaN(digit1) && isNaN(digit2)) {
                newDigit = undefined;
              } else if (isNaN(digit1)) {
                newDigit = digit2;
              } else if (isNaN(digit2)) {
                newDigit = digit1;
              } else if (digit1 === this.props.value?.[textFieldId]) {
                newDigit = digit2;
              } else {
                newDigit = digit1;
              }
            } else {
              newDigit = parseInt(e.target.value);
              if (isNaN(newDigit)) {
                newDigit = undefined;
              } else {
                newDigit = newDigit % 10;
              }
            }
            const newValue = [...(this.props.value || [])];
            while (newValue.length < this.props.digits) {
              newValue.push(undefined);
            }
            newValue[textFieldId] = newDigit;
            const isComplete = newValue.every(d => d !== undefined);
            this.props.onChange(newValue, isComplete);
            if (newDigit !== undefined) {
              this.inputRefs[textFieldId + 1]?.current?.focus();
            }
          }}
        />
      ));
    }

    return (
      <div className={this.props.classes.container}>
        {digitInputs}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DigitsInput);
