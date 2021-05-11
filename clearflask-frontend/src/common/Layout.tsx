import { AppBar, Divider, Drawer, IconButton, Toolbar, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import MenuIcon from '@material-ui/icons/Menu';
import classNames from 'classnames';
import React, { Component } from 'react';
import * as ConfigEditor from './config/configEditor';
import { contentScrollApplyStyles } from './ContentScroll';
import { withMediaQueries, WithMediaQueries } from './util/MediaQuery';

export interface LayoutSize {
  breakWidth?: number;
  width?: number | string;
  flexGrow?: number;
  maxWidth?: number;
}
export interface Section {
  size?: LayoutSize;
  content: React.ReactNode;
}
export interface PreviewSection extends Section {
  bar?: React.ReactNode;
}

const BOX_MARGIN = 36;
const BOX_BORDER_WIDTH = 1;

type MediaQueries = 'enableBoxLayout' | 'overflowPreview' | 'overflowMenu';
const MENU_WIDTH = 180;
const styles = (theme: Theme) => createStyles({

  barBottomPaper: {
    display: 'flex',
    flexDirection: 'row' as 'row',
    [theme.breakpoints.up('sm')]: {
      left: MENU_WIDTH,
    },
    zIndex: 1, // Allow other things like Color picker to overlap this
  },
  barBottom: {
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
  },
  previewBarBorder: {
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
  },
  toolbarSpacer: theme.mixins.toolbar,
  contentMargins: {
    padding: theme.spacing(3),
  },
  page: {
    height: '100vh',
    maxHeight: '100vh',
    width: '100vw',
    maxWidth: '100vw',
    overflow: 'hidden',
  },
  grow: {
    flexGrow: 1,
  },
  horizontal: {
    display: 'flex',
    alignItems: 'stretch',
    minHeight: 0,
  },
  fakeHorizontalMarginCollapse: {
    '& > *:not(:first-child)': {
      marginLeft: 0,
    },
  },
  vertical: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'stretch',
    minHeight: 0,
  },
  box: {
  },
  boxLayout: {
    margin: BOX_MARGIN,
    boxShadow: '0px 0px 40px 0 rgba(0,0,0,0.04)',
    border: '1px solid ' + theme.palette.grey[300],
    display: 'flex',
    alignItems: 'stretch',
    '& > *:not(:first-child)': {
      borderLeft: '1px solid ' + theme.palette.grey[300],
    },
  },
  section: {
    ...contentScrollApplyStyles(theme, undefined, true),
    flexShrink: 1,
  },
  content: {
    flexGrow: (props: Props) => props.main?.size?.flexGrow || 0,
    flexBasis: (props: Props) => props.main.size?.breakWidth || 'content',
    width: (props: Props) => props.main.size?.width,
    maxWidth: (props: Props) => props.main.size?.maxWidth,
  },
  menu: {
    flexGrow: (props: Props) => props.menu?.size?.flexGrow || 0,
    flexBasis: (props: Props) => props.menu?.size?.breakWidth || 'content',
    width: (props: Props) => props.menu?.size?.width,
    maxWidth: (props: Props) => props.menu?.size?.maxWidth,
  },
  preview: {
    flexGrow: (props: Props) => props.preview?.size?.flexGrow || 0,
    flexBasis: (props: Props) => props.preview?.size?.breakWidth || 'content',
    width: (props: Props) => props.preview?.size?.width,
    maxWidth: (props: Props) => props.preview?.size?.maxWidth,
  },
  leftPanel: {
    flexBasis: (props: Props & WithMediaQueries<MediaQueries>) => {
      if (!props.main?.size?.breakWidth
        || (!props.mediaQueries.overflowMenu && !props.menu?.size?.breakWidth)) {
        return 'content';
      }
      return `${(props.menu?.size?.breakWidth || 0) + props.main.size.breakWidth}px`;
    },
    flexGrow: (props: Props) => (props.menu?.size?.flexGrow || 0) + (props.main?.size?.flexGrow || 0),
    boxSizing: 'content-box',
    maxWidth: (props: Props & WithMediaQueries<MediaQueries>) => {
      if (!props.main.size?.maxWidth
        || (!props.mediaQueries.overflowMenu && !props.menu?.size?.maxWidth)) {
        return undefined; // Let it grow forever
      }
      return props.main.size.maxWidth + ((props.mediaQueries.overflowMenu || !props.menu?.size?.maxWidth)
        ? 0 : props.menu.size.maxWidth);
    },
  },
  rightPanel: {
    flexBasis: (props: Props) => props.preview?.size?.breakWidth || 'content',
    flexGrow: (props: Props) => props.preview?.size?.flexGrow || 0,
    boxSizing: 'content-box',
    maxWidth: (props: Props) => props.preview?.size?.maxWidth,
  },
});
interface Props {
  main: Section;
  toolbarShow: boolean;
  toolbarLeft: React.ReactNode;
  toolbarRight?: React.ReactNode;
  menu?: Section;
  previewShow?: boolean;
  previewShowChanged: (show: boolean) => void;
  preview?: PreviewSection;
  barBottom?: React.ReactNode;
  children: React.ReactNode;
  contentMargins?: boolean;
}
interface State {
  mobileMenuOpen: boolean;
}
class Layout extends Component<Props & WithMediaQueries<MediaQueries> & WithStyles<typeof styles, true> & WithWidthProps, State> {
  readonly editor: ConfigEditor.Editor = new ConfigEditor.EditorImpl();
  readonly containerRef = React.createRef<HTMLDivElement>();

  constructor(props) {
    super(props);
    this.state = {
      mobileMenuOpen: false,
    };
  }

  render() {
    const overflowPreview = this.props.mediaQueries.overflowPreview;
    const overflowMenu = this.props.mediaQueries.overflowMenu;

    const previewBar = (!!this.props.preview?.bar || !!overflowPreview) && (
      <React.Fragment>
        <div className={classNames(
          this.props.classes.previewBar,
          !!this.props.preview?.bar && this.props.classes.previewBarBorder,
        )}>
          {!!overflowPreview && (
            <IconButton
              color='inherit'
              aria-label=''
              onClick={this.handlePreviewToggle.bind(this)}
            >
              <CloseIcon />
            </IconButton>
          )}
          {!!this.props.preview?.bar && (
            <React.Fragment>
              <InfoIcon className={this.props.classes.previewBarItem} />
              <div className={this.props.classes.previewBarItem}>
                {this.props.preview.bar}
              </div>
            </React.Fragment>
          )}
        </div>
      </React.Fragment>
    );

    const preview = this.props.preview && (
      <div className={classNames(this.props.classes.section, this.props.classes.preview, this.props.classes.vertical)}>
        {previewBar}
        <div style={{ flex: '1 1 auto' }}>
          {this.props.preview.content}
        </div>
      </div>
    );

    const menu = !!this.props.menu && (
      <div className={classNames(this.props.classes.section, this.props.classes.menu)}>
        {this.props.menu.content}
      </div>
    );

    const content = (
      <div className={classNames(this.props.classes.section, this.props.classes.content, !!this.props.contentMargins && this.props.classes.contentMargins)}>
        {this.props.main.content}
      </div>
    );

    return (
      <div ref={this.containerRef}>
        {!!this.props.toolbarShow && (
          <AppBar elevation={0} color='default' className={this.props.classes.appBar}>
            <Toolbar>
              {!!overflowMenu && !!menu && (
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
              {this.props.toolbarRight}
            </Toolbar>
            <Divider />
          </AppBar>
        )}
        {overflowMenu && !!menu && (
          <nav className={this.props.classes.drawer}>
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
              {!!this.props.toolbarShow && (<div className={this.props.classes.toolbarSpacer} />)}
              {menu}
            </Drawer>
          </nav>
        )}
        {overflowPreview && !!preview && (
          <Drawer
            variant='persistent'
            SlideProps={{ mountOnEnter: true }}
            anchor='right'
            open={!!this.props.previewShow}
            onClose={this.handleDrawerToggle.bind(this)}
            classes={{
              paper: this.props.classes.previewMobilePaper,
            }}
            ModalProps={{
              container: () => this.containerRef.current!
            }}
          >
            {!!this.props.toolbarShow && (<div className={this.props.classes.toolbarSpacer} />)}
            {preview}
          </Drawer>
        )}
        <div className={classNames(this.props.classes.page, this.props.classes.vertical)}>
          {!!this.props.toolbarShow && (<div className={this.props.classes.toolbarSpacer} />)}
          <div className={classNames(
            this.props.classes.grow,
            this.props.classes.horizontal,
            this.props.classes.fakeHorizontalMarginCollapse,
          )}>
            {this.boxLayout(this.props.classes.leftPanel,
              <React.Fragment>
                {!overflowMenu && !!menu && (
                  menu
                )}
                <div className={classNames(this.props.classes.vertical, this.props.classes.grow)}>
                  {content}
                  {!!this.props.barBottom && (
                    <div className={this.props.classes.barBottom}>
                      <Divider />
                      {this.props.barBottom}
                    </div>
                  )}
                </div>
              </React.Fragment>
            )}
            {!overflowPreview && !!preview && (
              this.boxLayout(this.props.classes.rightPanel, preview)
            )}
          </div>
        </div>
      </div>
    );
  }

  boxLayout(className: string, content: React.ReactNode): React.ReactNode {
    const enableBoxLayout = this.props.mediaQueries.enableBoxLayout;
    return (
      <div className={classNames(
        className,
        this.props.classes.horizontal,
        this.props.classes.box,
        !!enableBoxLayout && this.props.classes.boxLayout)}>
        {content}
      </div>
    );
  }

  handleDrawerToggle() {
    this.setState({ mobileMenuOpen: !this.state.mobileMenuOpen });
  };

  handlePreviewToggle() {
    this.props.previewShowChanged(!this.props.previewShow);
  };
}

export default withMediaQueries<MediaQueries, Props>(props => {
  const menuMinWidth = props.menu?.size?.breakWidth || 0;
  const contentMinWidth = props.main.size?.breakWidth || 0;
  const previewMinWidth = props.preview?.size?.breakWidth || 0;
  const boxMinWidth = (BOX_MARGIN + BOX_BORDER_WIDTH)
    // Both left and right side
    * 2
    // Count content and maybe preview
    * (!!props.preview ? 2 : 1);
  return {
    enableBoxLayout: `(min-width:${contentMinWidth + menuMinWidth + previewMinWidth + boxMinWidth}px)`,
    overflowPreview: `(max-width:${contentMinWidth + menuMinWidth + previewMinWidth}px)`,
    overflowMenu: `(max-width:${contentMinWidth + menuMinWidth}px)`,
  };
})(withStyles(styles, { withTheme: true })(Layout));
