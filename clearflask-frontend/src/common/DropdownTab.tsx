import React, { Component, Key } from 'react';
import { Input, IconButton, Typography, Drawer, Divider, AppBar, Hidden, Select, MenuItem, InputLabel, FormControl } from '@material-ui/core';
import { withStyles, StyledComponentProps, Theme, createStyles, WithStyles } from '@material-ui/core/styles';

const styles = (theme:Theme) => createStyles({
  formControl: {
    minWidth: '160px',
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
    textTransform: 'uppercase',
    textAlign: 'center',
    [theme.breakpoints.up('md')]: {
      fontSize: theme.typography.pxToRem(13),
      minWidth: 160,
    },
    color: theme.palette.text.secondary,
    // Get rid of focused background color
    '&:focus': {
      background: 'inherit'
    },
  },
  tabButtonSelected: {
    color: theme.palette.primary.main,
  }
});

interface Props extends WithStyles<typeof styles> {
  key?:Key;
  label?:string;
  links:Array<{name:string; val:string}>;
  // Only here to satisfy outer Tabs component to determine if tab is selected
  value?:string;
  selectedValue?:string;
  onDropdownTabSelect:(val:string)=>void;
}

class DropdownTab extends Component<Props> {
  render() {
    var anySelected = false;
    const items = this.props.links.map(link => {
      if(this.props.selectedValue === link.val) anySelected = true;
      return (
        <MenuItem value={link.val}>{link.name}</MenuItem>
      );
    });
    const id = `dropdowntab-${this.props.key}`;
    return (
      <FormControl className={this.props.classes.formControl}>
        <Select
          className={this.props.classes.select}
          value={anySelected ? this.props.selectedValue : '__NOT_SELECTED__'}
          key={this.props.key}
          onChange={e => this.props.onDropdownTabSelect(e.target.value)}
          inputProps={{
            className: `${this.props.classes.tabButton} ${anySelected && this.props.classes.tabButtonSelected}`,
            id: id,
          }}
          displayEmpty
        >
          {this.props.label && (<MenuItem style={{display: 'none'}} divider disabled value='__NOT_SELECTED__'>{this.props.label}</MenuItem>)}
          {items}
        </Select>
      </FormControl>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DropdownTab);
