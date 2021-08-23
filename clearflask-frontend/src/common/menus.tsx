// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Divider, Grow, Link as MuiLink, MenuItem, SvgIconTypeMap } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React from 'react';
import { Link } from 'react-router-dom';
import ClosablePopper from './ClosablePopper';
import { SCROLL_TO_STATE_KEY } from './util/ScrollAnchor';

export interface MenuDropdown {
  type: 'dropdown';
  title: string;
  items: Array<MenuButton | MenuHeader | MenuDivider>;
}
export type MenuButton = {
  icon?: OverridableComponent<SvgIconTypeMap>;
  iconClassName?: string;
  type: 'button';
  primary?: boolean;
  title: string;
  scrollState?: string;
} & ({
  link: string;
  linkIsExternal?: boolean;
} | {
  onClick: () => void;
})
export interface MenuHeader {
  type: 'header';
  title: string;
}
export interface MenuDivider {
  type: 'divider';
}

const styles = (theme: Theme) => createStyles({
  button: {
    borderRadius: 10,
    display: 'flex',
    justifyContent: 'flex-start',
    padding: theme.spacing(0.5, 2),
    textTransform: 'unset',
  },
  buttonInsideDropdown: {
    margin: theme.spacing(2),
    padding: theme.spacing(0, 2),
  },
  buttonInsideDrawer: {
    height: 40,
    margin: theme.spacing(2),
    padding: theme.spacing(0, 2),
  },
  buttonOuter: {
    margin: theme.spacing(0, 1),
    minWidth: 'unset',
  },
  buttonIcon: {
    margin: theme.spacing(1, 0, 1, 2),
    fontSize: '1.3em',
  },
  dropdownContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  menuPopper: {
    padding: theme.spacing(1),
    maxWidth: 300,
  },
  menuPopperPaper: {
    transform: 'translateX(-50%)',
    borderRadius: 10,
    marginTop: theme.spacing(1),
  },
  menuItemDividerInsideDrawer: {
    margin: theme.spacing(4),
  },
});
const useStyles = makeStyles(styles);


interface MenuDropdownButtonProps {
  dropdown: MenuDropdown;
  isOuter?: boolean;
}
interface MenuDropdownButtonState {
  open?: boolean;
  hover?: boolean;
}
class MenuDropdownButtonRaw extends React.Component<MenuDropdownButtonProps & WithStyles<typeof styles, true>, MenuDropdownButtonState> {
  state: MenuDropdownButtonState = {};
  lastEventId = 0;

  render() {
    const onMouseOverButton = () => {
      this.setState({ hover: true });
      const lastEventId = ++this.lastEventId;
      setTimeout(() => lastEventId === this.lastEventId
        && this.state.hover
        && this.setState({ open: true }), 1);
    };
    const onMouseOverPopper = () => {
      ++this.lastEventId; // Cancel any events including mouse out
    };
    const onMouseOut = () => {
      this.setState({ hover: false });
      const lastEventId = ++this.lastEventId;
      setTimeout(() => lastEventId === this.lastEventId
        && !this.state.hover
        && this.setState({ open: false }), 1);
    };
    return (
      <div className={this.props.classes.dropdownContainer}>
        <Button
          size='large'
          className={classNames(this.props.classes.button, this.props.isOuter && this.props.classes.buttonOuter)}
          onClick={() => {
            ++this.lastEventId;
            this.setState({ open: true })
          }}
          onMouseOver={onMouseOverButton}
          onMouseOut={onMouseOut}
        >
          {this.props.dropdown.title}
        </Button>
        <ClosablePopper
          paperClassName={this.props.classes.menuPopperPaper}
          className={this.props.classes.menuPopper}
          clickAway
          closeButtonPosition='disable'
          open={!!this.state.open}
          onClose={() => {
            ++this.lastEventId;
            if (!this.state.open) this.setState({ open: false });
          }}
          onMouseOver={onMouseOverPopper}
          onMouseOut={onMouseOut}
          transitionCmpt={Grow}
          transitionProps={{
            style: { transformOrigin: '50% 0 0' },
            timeout: this.props.theme.transitions.duration.shortest,
          }}
          placement='bottom'
          modifiers={{
            // preventOverflow: { enabled: false },
            flip: { enabled: false },
          }}
        >
          <MenuItems
            items={this.props.dropdown.items}
            onClick={() => {
              ++this.lastEventId;
              this.setState({ open: false })
            }}
            insideDropdown
          />
        </ClosablePopper>
      </div>
    );
  }
}
export const MenuDropdownButton = withStyles(styles, { withTheme: true })(MenuDropdownButtonRaw);

export function MenuItems(props: {
  items: Array<MenuButton | MenuHeader | MenuDivider | MenuDropdown>;
  onClick?: () => void;
  insideDrawer?: boolean;
  insideDropdown?: boolean;
}) {
  const isOuter = !props.insideDropdown && !props.insideDrawer;
  return (
    <>
      {props.items.map((item, index) => {
        switch (item.type) {
          case 'header':
            return (
              <MenuItemHeader
                insideDrawer={props.insideDrawer}
                item={item}
              />
            );
          case 'button':
            return (
              <MenuItemButton
                item={item}
                onClick={props.onClick}
                isOuter={isOuter}
                insideDropdown={props.insideDropdown}
                insideDrawer={props.insideDrawer}
              />
            );
          case 'divider':
            return (
              <MenuItemDivider
                insideDropdown={props.insideDropdown}
                insideDrawer={props.insideDrawer}
                item={item}
              />
            );
          case 'dropdown':
            if (props.insideDrawer) {
              return (
                <>
                  <MenuItemHeader
                    insideDrawer={props.insideDrawer}
                    item={{ type: 'header', title: item.title }}
                  />
                  <MenuItems
                    key={item.title}
                    items={item.items}
                    onClick={props.onClick}
                    insideDrawer={props.insideDrawer}
                    insideDropdown={props.insideDropdown}
                  />
                </>
              );
            } else {
              return (
                <MenuDropdownButton
                  key={item.title}
                  dropdown={item}
                  isOuter={isOuter}
                />
              );
            }
          default:
            return null;
        }
      })}
    </>
  );
};

export function MenuItemButton(props: {
  item: MenuButton;
  onClick?: () => void;
  isOuter?: boolean;
  insideDropdown?: boolean;
  insideDrawer?: boolean;
}) {
  const classes = useStyles();
  const Icon = props.item.icon
  var linkProps: object | undefined;
  if (props.item['linkIsExternal'] !== undefined) {
    linkProps = {
      component: MuiLink,
      href: props.item['link'],
      underline: 'none',
    };
  } else if (props.item['link'] !== undefined) {
    linkProps = {
      component: Link,
      onClick: () => {
        props.onClick?.();
      },
      to: {
        pathname: props.item['link'],
        state: props.item.scrollState ? { [SCROLL_TO_STATE_KEY]: props.item.scrollState } : undefined,
      }
    };
  } else {
    linkProps = {
      component: MuiLink,
      onClick: () => {
        props.onClick?.();
        props.item['onClick']?.();
      },
      underline: 'none',
    };
  }
  return (
    <Button
      size='large'
      key={props.item.title}
      color={props.item.primary ? 'primary' : 'inherit'}
      variant={props.item.primary ? 'contained' : undefined}
      disableElevation
      className={classNames(
        classes.button,
        props.isOuter && classes.buttonOuter,
        props.insideDropdown && classes.buttonInsideDropdown,
        props.insideDrawer && classes.buttonInsideDrawer)}
      {...linkProps}
    >
      {props.item.title}
      {Icon && (
        <>
          <div style={{ flex: '1 0' }} />
          <Icon fontSize='inherit' className={classNames(classes.buttonIcon, props.item.iconClassName)} />
        </>
      )}
    </Button>
  );
};

export function MenuItemHeader(props: {
  insideDrawer?: boolean;
  item: MenuHeader;
}) {
  return (
    <>
      <MenuItem
        key={props.item.title}
        disabled
        style={{
          justifyContent: props.insideDrawer ? 'flex-start' : 'center',
          minHeight: 48,
        }}
      >{props.item.title}</MenuItem>
      <Divider />
    </>
  );
};

export function MenuItemDivider(props: {
  insideDrawer?: boolean;
  insideDropdown?: boolean;
  item: MenuDivider;
}) {
  const classes = useStyles();
  return props.insideDrawer ? (
    <div className={classes.menuItemDividerInsideDrawer} />
  ) : (
    <Divider />
  );
};
