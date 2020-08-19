import { AppBar, Divider, Drawer, Hidden, IconButton, Toolbar } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import MenuIcon from '@material-ui/icons/Menu';
import PreviewOnIcon from '@material-ui/icons/Visibility';
import PreviewOffIcon from '@material-ui/icons/VisibilityOff';
import React, { Component } from 'react';
import * as ConfigEditor from './config/configEditor';

const MENU_WIDTH = '180px';
const styles = (theme: Theme) => createStyles({
  root: {
    flexGrow: 1,
    display: 'flex',
  },
  mainAndBarBottom: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    flexGrow: 1,
  },
  barBottomPaper: {
    display: 'flex',
    flexDirection: 'row' as 'row',
    [theme.breakpoints.up('sm')]: {
      left: MENU_WIDTH,
    },
  },
  barBottom: {
    flex: '1 0',
  },
  drawer: {
    [theme.breakpoints.up('sm')]: {
      width: MENU_WIDTH,
      flexShrink: 0,
    },
  },
  drawerPaper: {
    width: MENU_WIDTH,
  },
  previewPaper: {
    overflowY: 'scroll' as 'scroll',
    width: '40%',
    background: theme.palette.background.default,
  },
  previewMobilePaper: {
    overflowY: 'scroll' as 'scroll',
    width: '100%',
    background: theme.palette.background.default,
  },
  appBar: {
    zIndex: Math.max(theme.zIndex.modal, theme.zIndex.drawer) + 1,
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
    flexGrow: 1,
    padding: theme.spacing(3),
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
  barBottom?: React.ReactNode;
  children: React.ReactNode;
}

interface State {
  mobileMenuOpen: boolean;
  mobilePreviewOpen: boolean;
  previewWidth?: string;
}

class Layout extends Component<Props & WithStyles<typeof styles, true>, State> {
  readonly editor: ConfigEditor.Editor = new ConfigEditor.EditorImpl();
  readonly containerRef = React.createRef<HTMLDivElement>();

  constructor(props) {
    super(props);
    this.state = {
      mobileMenuOpen: false,
      mobilePreviewOpen: false,
      previewWidth: '40vw',
    };
  }

  render() {
    return (
      <div ref={this.containerRef}>
        <AppBar elevation={0} color='default' className={this.props.classes.appBar}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="Open drawer"
              onClick={this.handleDrawerToggle.bind(this)}
              className={this.props.classes.menuButton}
            >
              <MenuIcon />
            </IconButton>
            {this.props.toolbarLeft}
            <div className={this.props.classes.grow} />
            {this.props.toolbarRight}
            {this.props.preview && (
              <IconButton
                color="inherit"
                aria-label="Preview changes"
                onClick={this.handlePreviewToggle.bind(this)}
                className={this.props.classes.previewButton}
              >
                {this.state.mobilePreviewOpen ? (<PreviewOffIcon />) : (<PreviewOnIcon />)}
              </IconButton>
            )}
          </Toolbar>
          <Divider />
        </AppBar>
        <div className={this.props.classes.root}>
          <nav className={this.props.classes.drawer}>
            <Hidden smUp implementation='css'>
              <Drawer
                variant='temporary'
                open={this.state.mobileMenuOpen}
                onClose={this.handleDrawerToggle.bind(this)}
                classes={{
                  paper: this.props.classes.drawerPaper,
                }}
                ModalProps={{
                  container: () => this.containerRef.current!
                }}
              >
                <div className={this.props.classes.toolbar} />
                <Divider />
                {this.props.menu}
              </Drawer>
            </Hidden>
            <Hidden xsDown implementation='css'>
              <Drawer
                classes={{
                  paper: this.props.classes.drawerPaper,
                }}
                variant="permanent"
                open
                ModalProps={{
                  container: () => this.containerRef.current!
                }}
              >
                <div className={this.props.classes.toolbar} />
                <Divider />
                {this.props.menu}
              </Drawer>
            </Hidden>
          </nav>
          <div className={this.props.classes.mainAndBarBottom}>
            <div className={this.props.classes.toolbar} />
            <main className={this.props.classes.content}>
              {this.props.children}
              <div className={this.props.classes.toolbar} />
            </main>
            {this.props.barBottom && (<div className={this.props.classes.toolbar} />)}
            <Drawer
              classes={{
                paper: this.props.classes.barBottomPaper,
              }}
              anchor='bottom'
              variant="persistent"
              open={!!this.props.barBottom}
              ModalProps={{
                container: () => this.containerRef.current!
              }}
            >
              <Toolbar className={this.props.classes.barBottom}>
                {this.props.barBottom}
              </Toolbar>
              {this.props.preview && (
                <Hidden smDown implementation='css'>
                  <div style={{ width: this.state.previewWidth }}>&nbsp;</div>
                </Hidden>
              )}
            </Drawer>
          </div>
          {this.props.preview && (
            <React.Fragment>
              <Hidden smDown implementation='css'>
                <div style={{ width: this.state.previewWidth }}>&nbsp;</div>
              </Hidden>
              <Hidden mdUp implementation='css'>
                <Drawer
                  variant="temporary"
                  anchor='right'
                  open={this.state.mobilePreviewOpen}
                  onClose={this.handleDrawerToggle.bind(this)}
                  classes={{
                    paper: this.props.classes.previewMobilePaper,
                  }}
                  ModalProps={{
                    container: () => this.containerRef.current!
                  }}
                >
                  <div className={this.props.classes.toolbar} />
                  <Divider />
                  <div style={{ flex: '1 1 auto' }}>
                    {this.props.preview}
                  </div>
                </Drawer>
              </Hidden>
              <Hidden smDown implementation='css'>
                <Drawer
                  PaperProps={{
                    style: { width: this.state.previewWidth }
                  }}
                  classes={{
                    paper: this.props.classes.previewPaper,
                  }}
                  anchor='right'
                  variant="permanent"
                  open
                  ModalProps={{
                    container: () => this.containerRef.current!
                  }}
                >
                  <div className={this.props.classes.toolbar} />
                  <Divider />
                  <div style={{
                    flex: '1 1 auto',
                  }}>
                    {this.props.preview}
                  </div>
                </Drawer>
              </Hidden>
            </React.Fragment>
          )}
        </div>
      </div>
    );
  }

  handleDrawerToggle() {
    this.setState({ mobileMenuOpen: !this.state.mobileMenuOpen });
  };

  handlePreviewToggle() {
    this.setState({ mobilePreviewOpen: !this.state.mobilePreviewOpen });
  };
}

export default withStyles(styles, { withTheme: true })(Layout);
