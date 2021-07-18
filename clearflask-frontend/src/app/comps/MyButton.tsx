import { fade, SvgIconTypeMap } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import SubmitButton from '../../common/SubmitButton';

const styles = (theme: Theme) => createStyles({
  button: {
    textTransform: 'unset',
  },
  icon: {
  },
  buttonPost: {
    padding: theme.spacing(0.5, 1),
    color: theme.palette.text.secondary,
    minWidth: 'unset',
    whiteSpace: 'nowrap',
    lineHeight: '24px',
    '&:not(:hover)': {
      borderColor: 'rgba(0,0,0,0)',
    },
  },
  iconPost: {
    fontSize: '1.3em',
  },
  color: {
    color: (props: Props) => props.color ? props.color : undefined,
    '&:hover': {
      backgroundColor: (props: Props) => props.color ? fade(props.color, 0.04) : undefined,
    }
  },
});
interface Props {
  buttonVariant: 'post';
  color?: string;
  colorHide?: boolean;
  Icon?: OverridableComponent<SvgIconTypeMap>,
  iconClassName?: string;
}
class MyButton extends Component<Props & Partial<Omit<React.ComponentPropsWithoutRef<typeof SubmitButton>, 'color'>> & WithStyles<typeof styles, true>> {
  render() {
    const { classes, buttonVariant, color, Icon, iconClassName, ...buttonProps } = this.props;
    var variantClassName: string | undefined;
    var variantIconClassName: string | undefined;
    var variantButtonProps: Partial<React.ComponentPropsWithoutRef<typeof SubmitButton>> = {};
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
      <SubmitButton
        disableElevation
        color='inherit'
        {...variantButtonProps}
        {...buttonProps}
        className={classNames(
          this.props.classes.button,
          !this.props.colorHide && this.props.classes.color,
          variantClassName,
          buttonProps.className,
        )}
      >
        {!!Icon && (
          <>
            <Icon
              fontSize='inherit'
              className={classNames(
                this.props.classes.icon,
                variantIconClassName,
                iconClassName,
              )}
            />
            {React.Children.count(this.props.children) > 0 && (
              <>&nbsp;</>
            )}
          </>
        )}
        {React.Children.count(this.props.children) > 0 ? (
          this.props.children
        ) : (
          <>&#8203;</>
        )}
      </SubmitButton>
    );
  }
}

export default withStyles(styles, { withTheme: true })(MyButton);
