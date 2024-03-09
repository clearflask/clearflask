// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { fade, SvgIconTypeMap } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import CollapseV5 from '../../common/CollapseV5';
import SubmitButton from '../../common/SubmitButton';
import { Link } from 'react-router-dom';

const styles = (theme: Theme) => createStyles({
  button: {
    textTransform: 'unset',
  },
  icon: {},
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
    },
  },
});

interface Props {
  buttonVariant: 'post';
  color?: string;
  colorHide?: boolean;
  Icon?: OverridableComponent<SvgIconTypeMap>,
  iconClassName?: string;
  expandOnHover?: boolean;
  to?: string;
}

interface State {
  isHovering?: boolean;
}

class MyButton extends Component<Props & Partial<Omit<React.ComponentPropsWithoutRef<typeof SubmitButton>, 'color'>> & WithStyles<typeof styles, true>, State> {
  state: State = {};

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

    var title = (
      <>
        {!!Icon && React.Children.count(this.props.children) > 0 && (
          <>&nbsp;</>
        )}
        {React.Children.count(this.props.children) > 0 ? (
          this.props.children
        ) : (
          <>&#8203;</>
        )}
      </>
    );
    if (this.props.expandOnHover) {
      title = (
        <CollapseV5 in={!!this.state.isHovering} orientation="horizontal">
          {title}
        </CollapseV5>
      );
    }

    return (
      <SubmitButton
        disableElevation
        color="inherit"
        {...variantButtonProps}
        {...buttonProps}
        className={classNames(
          this.props.classes.button,
          !this.props.colorHide && this.props.classes.color,
          variantClassName,
          buttonProps.className,
        )}
        onClick={e => {
          if (this.props.to) {
            e.preventDefault();
          }
          buttonProps?.onClick?.(e);
        }}
        {...(!!this.props.expandOnHover ? {
          onMouseOver: e => {
            buttonProps?.onMouseOver?.(e);
            this.setState({ isHovering: true });
          },
          onMouseOut: e => {
            buttonProps?.onMouseOut?.(e);
            this.setState({ isHovering: false });
          },
        } : {})}
        {...(!this.props.to ? {} : {
          component: Link,
          to: this.props.to,
        })}
      >
        {!!Icon && (
          <Icon
            fontSize="inherit"
            className={classNames(
              this.props.classes.icon,
              variantIconClassName,
              iconClassName,
            )}
          />
        )}
        {title}
      </SubmitButton>
    );
  }
}

export default withStyles(styles, { withTheme: true })(MyButton);
