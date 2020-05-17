import { FormControl, MenuItem, Select } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component, Key } from 'react';

const styles = (theme: Theme) => createStyles({
  outer: {
    [theme.breakpoints.up('md')]: {
      minWidth: '160px',
    },
    display: 'flex',
    justifyContent: 'center',
    paddingLeft: '24px',
    paddingRight: '24px',
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
    [theme.breakpoints.up('md')]: {
      fontSize: theme.typography.pxToRem(13),
    },
    color: theme.palette.text.secondary,
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
        <MenuItem key={link.name + link.val} value={link.val}>{link.name}</MenuItem>
      );
    });
    const id = `dropdowntab-${this.props.key}`;
    return (
      <div className={this.props.classes.outer}>
        <FormControl>
          <Select
            className={this.props.classes.select}
            classes={{
              icon: this.props.classes.selectIcon
            }}
            value={anySelected ? this.props.selectedValue : '__NOT_SELECTED__'}
            key={this.props.key}
            onChange={e => this.props.onDropdownTabSelect(e.target.value as string)}
            inputProps={{
              className: `${this.props.classes.tabButton} ${anySelected && this.props.classes.tabButtonSelected}`,
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
