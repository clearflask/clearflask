import { Button, SvgIconTypeMap } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  button: {
    textTransform: 'unset',
  },
  icon: {
  },
  buttonPost: {
    padding: theme.spacing(0, 1),
    color: theme.palette.text.secondary,
    minWidth: 'unset',
    whiteSpace: 'nowrap',
    lineHeight: '24px',
    '&:not(:hover)': {
      borderColor: 'rgba(0,0,0,0.02)',
    },
  },
  iconPost: {
    fontSize: '1.3em',
  },
});
interface Props {
  buttonVariant: 'post';
  Icon?: OverridableComponent<SvgIconTypeMap>,
  iconClassName?: string;
}
class MyButton extends Component<Props & React.ComponentProps<typeof Button> & WithStyles<typeof styles, true>> {
  render() {
    const { classes, buttonVariant, Icon, iconClassName, ...buttonProps } = this.props;
    var variantClassName: string | undefined;
    var variantIconClassName: string | undefined;
    var variantButtonProps: Partial<React.ComponentProps<typeof Button>> = {};
    switch (buttonVariant) {
      case 'post':
        variantClassName = this.props.classes.buttonPost;
        variantIconClassName = this.props.classes.iconPost;
        variantButtonProps = {
          variant: 'outlined',
        };
        break;
    }
    return (
      <Button
        disableElevation
        {...variantButtonProps}
        {...buttonProps}
        className={classNames(
          buttonProps.className,
          this.props.classes.button,
          variantClassName,
        )}
      >
        {!!Icon && (
          <React.Fragment>
            <Icon
              fontSize='inherit'
              className={classNames(
                this.props.classes.icon,
                variantIconClassName,
                iconClassName,
              )}
            />
            {React.Children.count(this.props.children) > 0 && (
              <React.Fragment>&nbsp;</React.Fragment>
            )}
          </React.Fragment>
        )}
        {React.Children.count(this.props.children) > 0 ? (
          this.props.children
        ) : (
          <React.Fragment>&#8203;</React.Fragment>
        )}
      </Button>
    );
  }
}

export default withStyles(styles, { withTheme: true })(MyButton);
