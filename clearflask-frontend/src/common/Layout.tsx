import { AppBar, Divider, Drawer, Fade, Hidden, IconButton, Toolbar } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import MenuIcon from '@material-ui/icons/Menu';
import PreviewOnIcon from '@material-ui/icons/Visibility';
import PreviewOffIcon from '@material-ui/icons/VisibilityOff';
import classNames from 'classnames';
import React, { Component } from 'react';
import * as ConfigEditor from './config/configEditor';

const MENU_WIDTH = 180;
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
    zIndex: 1, // Allow other things like Color picker to overlap this
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
  menuPaper: {
    zIndex: theme.zIndex.drawer + 1,
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
  previewBar: {
    display: 'flex',
    padding: theme.spacing(0.5, 1),
    color: theme.palette.text.secondary,
    alignItems: 'center',
    borderBottom: '1px dashed ' + theme.palette.grey[300],
  },
  previewBarItem: {
    margin: theme.spacing(1),
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
  },
  contentMargins: {
    padding: theme.spacing(3),
  },
  grow: {
    flexGrow: 1,
  },
});

interface Props {
  showToolbar: boolean;
  toolbarLeft: React.ReactNode;
  toolbarRight?: React.ReactNode;
  menu: React.ReactNode;
  previewBar?: React.ReactNode;
  previewBarInfo?: React.ReactNode;
  preview?: React.ReactNode;
  barBottom?: React.ReactNode;
  children: React.ReactNode;
  hideContentMargins?: boolean;
  width?: {
    target: 'content' | 'preview';
    width: string | number,
  };
}

interface State {
  mobileMenuOpen: boolean;
  mobilePreviewOpen: boolean;
}

class Layout extends Component<Props & WithStyles<typeof styles, true>, State> {
  readonly editor: ConfigEditor.Editor = new ConfigEditor.EditorImpl();
  readonly containerRef = React.createRef<HTMLDivElement>();

  constructor(props) {
    super(props);
    this.state = {
      mobileMenuOpen: false,
      mobilePreviewOpen: false,
    };
  }

  static getDerivedStateFromProps(props: React.ComponentProps<typeof Layout>, state: State): Partial<State> | null {
    // Clear mobile preview if navigated to a page that doesn't have mobile preview
    // So if you click back to a page that does, the preview is not open already
    if (!props.preview && !!state.mobilePreviewOpen) {
      return { mobilePreviewOpen: undefined };
    }
    return null;
  }

  render() {
    const previewBar = (this.props.previewBar || this.props.previewBarInfo) && (
      <React.Fragment>
        {this.props.previewBar ? this.props.previewBar : (
          <div className={this.props.classes.previewBar}>
            <InfoIcon className={this.props.classes.previewBarItem} />
            <div className={this.props.classes.previewBarItem}>
              {this.props.previewBarInfo}
            </div>
          </div>
        )}
        {/* <Divider /> */}
      </React.Fragment>
    );

    const preview = this.props.preview && (
      <React.Fragment>
        {!!this.props.showToolbar && (<div className={this.props.classes.toolbar} />)}
        {previewBar}
        <div style={{ flex: '1 1 auto' }}>
          {this.props.preview}
        </div>
      </React.Fragment>
    );
    const previewWidth = !this.props.width
      ? '40vw'
      : (this.props.width.target === 'preview'
        ? this.props.width.width
        : `calc(100vw - ${MENU_WIDTH}px - ${this.props.width.width}${typeof this.props.width.width === 'number' ? 'px' : ''})`);

    return (
      <div ref={this.containerRef}>
        {!!this.props.showToolbar && (
          <AppBar elevation={0} color='default' className={this.props.classes.appBar}>
            <Toolbar>
              {!!this.props.menu && (
                <IconButton
                  color="inherit"
                  aria-label="Open drawer"
                  onClick={this.handleDrawerToggle.bind(this)}
                  className={this.props.classes.menuButton}
                >
                  <MenuIcon />
                </IconButton>
              )}
              {this.props.toolbarLeft}
              <div className={this.props.classes.grow} />
              <Fade in={!!this.props.preview}>
                <IconButton
                  color='inherit'
                  aria-label='Preview changes'
                  onClick={this.handlePreviewToggle.bind(this)}
                  className={this.props.classes.previewButton}
                >
                  {this.state.mobilePreviewOpen ? (<PreviewOffIcon />) : (<PreviewOnIcon />)}
                </IconButton>
              </Fade>
              {this.props.toolbarRight}
            </Toolbar>
            <Divider />
          </AppBar>
        )}
        <div className={this.props.classes.root}>
          {!!this.props.menu && (
            <nav className={this.props.classes.drawer}>
              <Hidden smUp implementation='css'>
                <Drawer
                  variant='temporary'
                  open={this.state.mobileMenuOpen}
                  onClose={this.handleDrawerToggle.bind(this)}
                  classes={{
                    paper: classNames(this.props.classes.menuPaper, this.props.classes.drawerPaper),
                  }}
                  ModalProps={{
                    container: () => this.containerRef.current!,
                    keepMounted: true,
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
          )}
          <div className={this.props.classes.mainAndBarBottom}>
            {!!this.props.showToolbar && (<div className={this.props.classes.toolbar} />)}
            <main className={classNames(this.props.classes.content, !this.props.hideContentMargins && this.props.classes.contentMargins)}>
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
                  <div style={{ width: previewWidth }}>&nbsp;</div>
                </Hidden>
              )}
            </Drawer>
          </div>
          {preview && (
            <React.Fragment>
              <Hidden smDown implementation='css'>
                <div style={{ width: previewWidth }}>&nbsp;</div>
              </Hidden>
              <Hidden mdUp implementation='css'>
                <Drawer
                  variant='persistent'
                  SlideProps={{ mountOnEnter: true }}
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
                  {preview}
                </Drawer>
              </Hidden>
              <Hidden smDown implementation='css'>
                <Drawer
                  PaperProps={{
                    style: { width: previewWidth }
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
                  {preview}
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
