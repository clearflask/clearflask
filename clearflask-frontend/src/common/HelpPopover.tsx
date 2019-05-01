import React, { Component, Key } from 'react';
import { IconButton, Popover, Typography, Button } from '@material-ui/core';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import HelpIcon from '@material-ui/icons/HelpOutline';

const styles = (theme:Theme) => createStyles({
  iconButton: {
    // fontSize: '2em',
    padding: '0px',
    borderRadius: '100px',
    minWidth: 'unset',
    color: theme.palette.text.hint,
  },
  popover: {
    margin: theme.spacing.unit,
  },
});

interface Props extends WithStyles<typeof styles, true> {
  title?:string;
  description?:string;
}

interface State {
  expandedAnchor?:HTMLElement;
}

class HelpPopover extends Component<Props, State> {

  constructor(props:Props) {
    super(props);
    this.state = {};
  }

  render() {
    return [
      <Button className={this.props.classes.iconButton}
        onClick={e => this.setState({expandedAnchor: e.currentTarget})}>
        <HelpIcon fontSize='inherit' />
      </Button>,
      <Popover
        open={!!this.state.expandedAnchor}
        anchorEl={this.state.expandedAnchor}
        onClose={() => this.setState({expandedAnchor: undefined})}
        anchorOrigin={{ vertical: 'center', horizontal: 'right', }}
        transformOrigin={{ vertical: 'center', horizontal: 'left', }}
      >
        <div className={this.props.classes.popover}>
          {this.props.title && (<Typography variant='subtitle2'>{this.props.title}</Typography>)}
          {this.props.description && (<Typography variant='body1'>{this.props.description}</Typography>)}
          {this.props.children}
        </div>
      </Popover>,
    ];
  }
}

export default withStyles(styles, { withTheme: true })(HelpPopover);
