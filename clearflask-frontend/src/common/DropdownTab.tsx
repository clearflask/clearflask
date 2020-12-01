import { FormControl, MenuItem, Select } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { CSSProperties } from '@material-ui/styles/withStyles';
import classNames from 'classnames';
import React, { Component, Key } from 'react';
import { Link } from 'react-router-dom';

export const tabHoverApplyStyles = (theme: Theme): CSSProperties => ({
  position: 'relative',
  '&::before': {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    content: '"\\00a0"',
    borderRadius: '1px',
    borderBottom: `1px solid rgba(0, 0, 0, 0)`,
    transition: 'border-bottom-color 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
  },
  '&:hover::before': {
    borderBottom: `2px solid ${theme.palette.type === 'dark' ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)'}`,
  },
});

const styles = (theme: Theme) => createStyles({
  outer: {
    display: 'flex',
    justifyContent: 'center',
  },
  inner: {
    padding: '0px 24px',
    [theme.breakpoints.down('md')]: {
      padding: '0px 12px',
    },
    ...(tabHoverApplyStyles(theme)),
  },
  select: {
    height: '48px',
    // Get rid of text cursor
    cursor: 'inherit',
    // Get rid of permanent underline
    '&:before': {
      borderBottom: '0px'
    },
    // Get rid of focus underline
    '&:after': {
      borderBottom: '0px'
    },
    // Get rid of hover over border
    '&:hover:not(.foo1):not(.foo2):not(.foo3):not(.foo4):not(.foo5):before': {
      borderBottom: '0px'
    },
  },
  tabButton: {
    ...theme.typography.button,
    paddingRight: '20px',
    textTransform: 'uppercase',
    textAlign: 'center',
    color: theme.palette.text.primary,
    // Get rid of focused background color
    '&:focus': {
      background: 'inherit'
    },
  },
  tabButtonSelected: {
    color: theme.palette.primary.main,
  },
  selectIcon: {
    right: '-12px',
  },
});

interface Props extends WithStyles<typeof styles, true> {
  className?: string;
  key?: Key;
  label?: string;
  links: Array<{ name: string; val: string }>;
  // Only here to satisfy outer Tabs component to determine if tab is selected
  value?: string;
  selectedValue?: string;
  onDropdownTabSelect: (val: string) => void;
}

class DropdownTab extends Component<Props> {
  render() {
    var anySelected = false;
    const items = this.props.links.map(link => {
      if (this.props.selectedValue === link.val) anySelected = true;
      return (
        <MenuItem
          component={Link as any}
          to={link.val}
          key={link.name + link.val}
          value={link.val}
        >
          {link.name}
        </MenuItem>
      );
    });
    const id = `dropdowntab-${this.props.key}`;
    return (
      <div className={this.props.classes.outer}>
        <FormControl className={this.props.classes.inner}>
          <Select
            className={this.props.classes.select}
            classes={{
              icon: this.props.classes.selectIcon
            }}
            value={anySelected ? this.props.selectedValue : '__NOT_SELECTED__'}
            key={this.props.key}
            onChange={e => this.props.onDropdownTabSelect(e.target.value as string)}
            inputProps={{
              className: classNames(this.props.classes.tabButton, anySelected && this.props.classes.tabButtonSelected, this.props.className),
              id: id,
            }}
            displayEmpty
            MenuProps={{
              anchorOrigin: {
                vertical: 'bottom',
                horizontal: 'center',
              },
              transformOrigin: {
                vertical: 'top',
                horizontal: 'center',
              },
              anchorReference: 'anchorEl',
            }}
          >
            {this.props.label && (<MenuItem style={{ display: 'none' }} divider disabled value='__NOT_SELECTED__'>{this.props.label}</MenuItem>)}
            {items}
          </Select>
        </FormControl>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DropdownTab);
