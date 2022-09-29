// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { IconButton } from '@material-ui/core';
import PaintbrushIcon from '@material-ui/icons/Palette';
import { ColorPickerControllable } from 'material-ui-color-picker/lib/components/ColorPicker';
import React, { useState } from 'react';
import MyColorPicker from './MyColorPicker';

export default function TextFieldWithColorPicker(props: {
  textValue?: string;
  onTextChange: (text: string) => void;
  colorValue?: string;
  onColorChange: (color: string) => void;
} & Omit<React.ComponentProps<typeof MyColorPicker>, 'value' | 'onChange' | 'preview'>) {
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const { textValue, onTextChange, colorValue, onColorChange, ...MyColorPickerProps } = props;
  return (
    <MyColorPicker
      preview={false}
      onChange={color => onColorChange(color)}
      value={colorValue || ''}

      // Use a custom controllable component to handle control when picker is shown.
      component={ColorPickerControllable}
      setValue={color => { }}
      showPicker={showPicker}
      setShowPicker={setShowPicker}

      {...MyColorPickerProps}
      TextFieldProps={{
        value: textValue || '',
        onClick: e => { },
        onChange: e => onTextChange(e.target.value),
        ...MyColorPickerProps.TextFieldProps,
        InputProps: {
          ...MyColorPickerProps.TextFieldProps?.InputProps,
          endAdornment: (
            <>
              <IconButton
                aria-label='Color'
                onClick={() => setShowPicker(!showPicker)}
              >
                <PaintbrushIcon
                  style={{
                    color: colorValue === undefined ? undefined : colorValue,
                  }}
                  fontSize='small'
                />
              </IconButton>
              {MyColorPickerProps?.InputProps?.endAdornment}
            </>
          ),
        },
      }}
    />
  );
}

