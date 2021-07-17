import { TextField } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { useState } from 'react';

const styles = (theme: Theme) => createStyles({
  bareTextFieldRoot: {
    display: 'unset',
  },
  bareTextFieldInputRootPadding: {
    padding: '0px' + '!important',
  },
  bareTextFieldInputRoot: {
    '&::before': { content: 'none' },
    '&::after': { content: 'none' },
    fontSize: 'inherit',
    fontFamily: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    verticalAlign: 'unset',
  },
  bareTextFieldInputInput: {
    paddingTop: '0px !important',
    paddingBottom: '0px !important',
  },
});
const useStyles = makeStyles(styles);
export default function BareTextField(props: {
  autoFocusAndSelect?: boolean;
  forceOutline?: boolean;
} & React.ComponentProps<typeof TextField>) {
  const classes = useStyles();
  const [selectedOnMount, setSelectedOnMount] = useState<boolean | undefined>();

  return (
    <TextField
      {...props}
      variant={props.forceOutline ? 'outlined' : 'standard'}
      label={undefined}
      margin='none'
      onKeyDown={props.multiline ? props.onKeyDown : e => {
        if (!props.multiline && e.keyCode == 13) {
          // Disable enter in non-multiline
          e.preventDefault();
        } else {
          return props.onKeyDown?.(e);
        }
      }}
      onChange={props.multiline ? props.onChange : e => {
        if (!props.multiline) {
          // Remove newlines in non-multiline
          e.target.value = e.target.value.replace(/\n/g, '');
        }
        return props.onChange?.(e);
      }}
      multiline // Allow wrapping of text in non-multiline by always using multiline
      classes={{
        ...props.classes,
        root: classNames(classes.bareTextFieldRoot, props.classes?.root),
      }}
      {...(props.autoFocusAndSelect ? {
        autoFocusAndSelect: true, // For RichEditor
      } : {})}
      InputProps={{
        ...props.InputProps,
        ...(props.autoFocusAndSelect ? {
          autoFocus: true,
        } : {}),
        classes: {
          ...props.InputProps?.classes,
          root: classNames(
            classes.bareTextFieldInputRoot,
            !props.forceOutline && classes.bareTextFieldInputRootPadding,
            props.InputProps?.classes?.root),
          input: classNames(classes.bareTextFieldInputInput, props.InputProps?.classes?.input),
        },
        onFocus: !props.autoFocusAndSelect ? props.onFocus : e => {
          if (!selectedOnMount && props.autoFocusAndSelect) {
            e.target?.select?.();
            setSelectedOnMount(true);
          }
          return props.onFocus?.(e);
        },
      }}
    />
  );
}

