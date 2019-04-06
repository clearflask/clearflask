import React, { Component } from 'react';
import * as ConfigEditor from './config/configEditor';
import { Toolbar, IconButton, Typography, Drawer, Divider, AppBar, Hidden } from '@material-ui/core';
import MenuIcon from '@material-ui/icons/Menu';
import PreviewOnIcon from '@material-ui/icons/Visibility';
import PreviewOffIcon from '@material-ui/icons/VisibilityOff';
import { withStyles, StyledComponentProps } from '@material-ui/core/styles';

const drawerWidth = 140;
const styles = theme => ({
  root: {
    display: 'flex',
  },
  drawer: {
    [theme.breakpoints.up('sm')]: {
      width: drawerWidth,
      flexShrink: 0,
    },
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
    marginRight: 20,
    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  },
  toolbar: theme.mixins.toolbar,
  drawerPaper: {
    width: drawerWidth,
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing.unit * 3,
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

    const drawer = (
      <div>
        <div className={classes.toolbar} />
        <Divider />
        {this.props.menu}
      </div>
    );

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
            <Typography variant="h6" color="inherit" noWrap>
              {this.props.topbar} 
            </Typography>
            <div className={classes.grow} />
            {this.props.preview && (
              <IconButton
                color="inherit"
                aria-label="Open drawer"
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
          <Hidden smUp implementation="js">
            <Drawer
              variant="temporary"
              anchor={theme.direction === 'rtl' ? 'right' : 'left'}
              open={this.state.mobileMenuOpen}
              onClose={this.handleDrawerToggle.bind(this)}
              classes={{
                paper: classes.drawerPaper,
              }}
            >
              {drawer}
            </Drawer>
          </Hidden>
          <Hidden xsDown implementation="js">
            <Drawer
              classes={{
                paper: classes.drawerPaper,
              }}
              variant="permanent"
              open
            >
              {drawer}
            </Drawer>
          </Hidden>
        </nav>
        <main className={classes.content}>
          <div className={classes.toolbar} />
          {this.props.children}
        </main>
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
