import { IconButton, ModalManager, Popover, PopoverProps, Button, ButtonProps, CircularProgress } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import React, { Component } from 'react';
import classNames from 'classnames';

const styles = (theme: Theme) => createStyles({
  wrapper: {
    position: 'relative',
  },
  progress: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12,
  },
  button: {
  },
});
interface Props {
  isSubmitting?: boolean;
}
interface State {
  clicked?: boolean;
}
class SubmitButton extends Component<Props & ButtonProps & WithStyles<typeof styles, true>, State> {
  state:State = {};

  static getDerivedStateFromProps(props:Props & ButtonProps & WithStyles<typeof styles, true>, state: State): Partial<State> | null {
    if(!props.isSubmitting && !!state.clicked) {
      return { clicked: undefined };
    }
    return null;
  }

  render() {
    const { classes, isSubmitting, ...buttonProps } = this.props;
    return (
      <div
        className={classes.wrapper}
      >
        <Button
          {...buttonProps}
          className={classNames(classes.button, buttonProps.className)}
          disabled={isSubmitting || buttonProps.disabled}
          onClick={e => {
            this.setState({clicked: true});
            buttonProps.onClick && buttonProps.onClick(e)
          }}
        />
        {(this.state.clicked && this.props.isSubmitting) && (
          <CircularProgress
            color={buttonProps.color !== 'default' && buttonProps.color || 'inherit'}
            size={24}
            className={classes.progress}
          />
        )}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(SubmitButton);
