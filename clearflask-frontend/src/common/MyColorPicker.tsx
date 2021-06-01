import { IconButton, InputAdornment } from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/CloseRounded';
import PaintbrushIcon from '@material-ui/icons/Palette';
import ColorPicker from 'material-ui-color-picker';
import React, { useRef } from 'react';

export default function MyColorPicker(props: {
  clearable?: boolean;
  preview?: boolean;
  component?: any;
} & Omit<React.ComponentProps<typeof ColorPicker>, 'InputProps'>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { clearable, preview, component, ...ColorPickerProps } = props;
  const ColorPickerCmpt = component || ColorPicker;
  return (
    // Div-wrapped so the absolutely positioned picker shows up in the right place
    <div ref={containerRef} style={{ position: 'relative' }}>
      <ColorPickerCmpt
        {...ColorPickerProps}
        // Hack to modify material-ui-color-picker to fix bug
        // where a click inside the empty space inside the
        // picker would dismiss the picker.
        onFocus={e => {
          ColorPickerProps.onFocus?.(e);
          setTimeout(() => {
            const ptr = containerRef.current?.children?.[1]?.children?.[1]?.['style'];
            ptr && (ptr.position = 'relative');
          }, 500)
        }}
        TextFieldProps={{
          value: ColorPickerProps.value,
          ...ColorPickerProps.TextFieldProps,
          InputProps: {
            ...ColorPickerProps.TextFieldProps?.InputProps,
            endAdornment: (clearable || preview) ? (
              <InputAdornment position='end'>
                {!!clearable && (
                  <IconButton
                    aria-label='Clear'
                    style={{
                      visibility: !!ColorPickerProps.value ? undefined : 'hidden',
                    }}
                    onClick={() => ColorPickerProps.onChange(undefined)}
                  >
                    <DeleteIcon fontSize='small' />
                  </IconButton>
                )}
                {!!preview && (
                  <PaintbrushIcon
                    style={{
                      color: ColorPickerProps.value === undefined ? undefined : (ColorPickerProps.value + ''),
                    }}
                    fontSize='small'
                  />
                )}
                {ColorPickerProps.TextFieldProps?.InputProps.endAdornment}
              </InputAdornment>
            ) : ColorPickerProps.TextFieldProps?.InputProps.endAdornment,
            inputProps: {
              autoComplete: 'off',
              ...ColorPickerProps.TextFieldProps?.InputProps?.inputProps,
            },
          },
        }}
      />
    </div>
  );
}

