import React, { Component } from 'react';
import * as ConfigEditor from './config/configEditor';
import { Toolbar, IconButton, Typography, Drawer, Divider, AppBar, Hidden } from '@material-ui/core';
import MenuIcon from '@material-ui/icons/Menu';
import PreviewOnIcon from '@material-ui/icons/Visibility';
import PreviewOffIcon from '@material-ui/icons/VisibilityOff';
import { withStyles, StyledComponentProps, Theme } from '@material-ui/core/styles';

const styles = (theme:Theme) => ({
  root: {
    display: 'flex',
  },
  drawer: {
    [theme.breakpoints.up('sm')]: {
      width: '140px',
      flexShrink: 0,
    },
  },
  drawerPaper: {
    width: '140px',
  },
  previewPaper: {
    width: '40%',
    background: theme.palette.background.default,
  },
  previewMobilePaper: {
    width: '100%',
    background: theme.palette.background.default,
  },
  appBar: {
    zIndex: theme.zIndex.modal + 1,
  },
  menuButton: {
    marginRight: 20,
    [theme.breakpoints.up('sm')]: {
      display: 'none',
    },
  },
  previewButton: {
    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  },
  toolbar: theme.mixins.toolbar,
  content: {
    overflow: 'scroll',
    flexGrow: 1,
    padding: theme.spacing.unit * 3,
    [theme.breakpoints.up('md')]: {
      marginRight: '40%',
    },
  },
  grow: {
    flexGrow: 1,
  },
});

interface Props {
  toolbarLeft: React.ReactNode;
  toolbarRight?: React.ReactNode;
  menu: React.ReactNode;
  preview?: React.ReactNode;
  children: React.ReactNode;
  // withStyles
  classes;
  theme;
}

interface State {
  mobileMenuOpen:boolean;
  mobilePreviewOpen:boolean;
}

class Layout extends Component<Props, State> {
  readonly editor:ConfigEditor.Editor = new ConfigEditor.EditorImpl();

  constructor(props) {
    super(props);
    this.state = {
      mobileMenuOpen: false,
      mobilePreviewOpen: false,
    };
  }

  render() {
    const { classes, theme } = this.props;

    return (
      <div className={classes.root}>
        <AppBar elevation={0} color='default' position="fixed" className={classes.appBar}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="Open drawer"
              onClick={this.handleDrawerToggle.bind(this)}
              className={classes.menuButton}
            >
              <MenuIcon />
            </IconButton>
            {this.props.toolbarLeft} 
            <div className={classes.grow} />
            {this.props.preview && (
              <IconButton
                color="inherit"
                aria-label="Preview changes"
                onClick={this.handlePreviewToggle.bind(this)}
                className={classes.previewButton}
              >
                {this.state.mobilePreviewOpen ? (<PreviewOffIcon />) : (<PreviewOnIcon />)}
              </IconButton>
            )}
          </Toolbar>
          <Divider /> 
        </AppBar>
        <nav className={classes.drawer}>
          <Hidden smUp implementation='css'>
            <Drawer
              variant="temporary"
              open={this.state.mobileMenuOpen}
              onClose={this.handleDrawerToggle.bind(this)}
              classes={{
                paper: classes.drawerPaper,
              }}
            >
              <div className={classes.toolbar} />
              <Divider />
              {this.props.menu}
            </Drawer>
          </Hidden>
          <Hidden xsDown implementation='css'>
            <Drawer
              classes={{
                paper: classes.drawerPaper,
              }}
              variant="permanent"
              open
            >
              <div className={classes.toolbar} />
              <Divider />
              {this.props.menu}
            </Drawer>
          </Hidden>
        </nav>
        <main className={classes.content}>
          <div className={classes.toolbar} />
          {this.props.children}
        </main>
        {this.props.preview && (
          <div>
            <Hidden mdUp implementation='css'>
              <Drawer
                variant="temporary"
                anchor='right'
                open={this.state.mobilePreviewOpen}
                onClose={this.handleDrawerToggle.bind(this)}
                classes={{
                  paper: classes.previewMobilePaper,
                }}
              >
                <div className={classes.toolbar} />
                <Divider />
                <div>
                  {this.props.preview}
                </div>
              </Drawer>
            </Hidden>
            <Hidden smDown implementation='css'>
              <Drawer
                classes={{
                  paper: classes.previewPaper,
                }}
                anchor='right'
                variant="permanent"
                open
              >
                <div className={classes.toolbar} />
                <Divider />
                <div>
                  {this.props.preview}
                </div>
              </Drawer>
            </Hidden>
          </div>
        )}
      </div>
    );
  }

  handleDrawerToggle() {
    this.setState({mobileMenuOpen: !this.state.mobileMenuOpen});
  };

  handlePreviewToggle() {
    this.setState({mobilePreviewOpen: !this.state.mobilePreviewOpen});
  };
}

export default withStyles(styles, { withTheme: true })(Layout);
