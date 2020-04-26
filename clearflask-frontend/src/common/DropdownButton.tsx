import { Button, Menu, MenuItem } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import DropdownIcon from '@material-ui/icons/ArrowDropDown';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
});

interface Props extends WithStyles<typeof styles, true> {
  label: string;
  buttonClassName?: string;
  links: Array<{ name: string; val: string }>;
  value?: string;
  onChange: (val: string) => void;
}
interface State {
  menuOpen?: boolean;
}
class DropdownButton extends Component<Props, State> {
  state: State = {};
  readonly menuButtonRef: React.RefObject<HTMLButtonElement> = React.createRef();

  render() {
    return (
      <React.Fragment>
        <Button
          className={this.props.buttonClassName}
          ref={this.menuButtonRef}
          onClick={() => this.setState({ menuOpen: true })}
        >
          {this.props.label}
          <DropdownIcon />
        </Button>
        <Menu
          anchorEl={this.menuButtonRef.current}
          open={!!this.state.menuOpen}
          onClose={() => this.setState({ menuOpen: false })}
        >
          {this.props.links.map(link => (
            <MenuItem
              key={link.val}
              className={this.props.buttonClassName}
              onClick={() => {
                this.setState({ menuOpen: false });
                this.props.onChange(link.val);
              }}
            >{link.name}</MenuItem>
          ))}
        </Menu>
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(DropdownButton);
