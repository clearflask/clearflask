import { AppBar, Button, Divider, Drawer, IconButton, Toolbar, Typography, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import MenuIcon from '@material-ui/icons/Menu';
import classNames from 'classnames';
import React, { Component } from 'react';
import * as ConfigEditor from './config/configEditor';
import { contentScrollApplyStyles, Orientation } from './ContentScroll';
import { withMediaQueries, WithMediaQueries } from './util/MediaQuery';

export interface LayoutState {
  overflowPreview: boolean;
  overflowMenu: boolean;
  enableBoxLayout: boolean;
}

export interface Header {
  title?: string;
  action: {
    label: string;
    onClick: () => void;
  };
}
export interface LayoutSize {
  breakWidth?: number;
  width?: number | string;
  flexGrow?: number;
  maxWidth?: number | string;
  scroll?: Orientation;
}
export interface Section {
  size?: LayoutSize;
  content: React.ReactNode | ((layoutState: LayoutState) => React.ReactNode | null);
}
export interface PreviewSection extends Section {
  bar?: React.ReactNode;
}
export interface MenuSection extends Section {
  detachFromMain?: boolean;
}
export interface MainSection extends Section {
  boxLayoutNoPaper?: boolean;
}

export const BOX_MARGIN = 36;
const BOX_BORDER_WIDTH = 1;
const HEADER_HEIGHT = 60;
export const BoxLayoutBoxApplyStyles: any = {
  boxShadow: '0px 0px 50px 0 rgba(0,0,0,0.1)',
};

const styles = (theme: Theme) => createStyles({
  header: {
    position: 'absolute',
    top: 0,
    height: HEADER_HEIGHT,
    transform: 'translate(0, -100%)',
    display: 'flex',
    padding: theme.spacing(0, 3),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLeft: {
    left: theme.spacing(1),
  },
  headerRight: {
    right: theme.spacing(1),
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
    maxWidth: '100%',
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
    margin: theme.spacing(0, 1),
  },
  previewBarContent: {
    flexGrow: 1,
  },
  appBar: {
    zIndex: Math.max(theme.zIndex.modal, theme.zIndex.drawer) + 1,
    boxShadow: '0px 0px 50px 0 rgba(0,0,0,0.1)',
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Horizontal, backgroundColor: theme.palette.background.paper }),
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
  boxLayoutParent: {
    position: 'relative',
    zIndex: 0,
  },
  boxLayoutWithHeaderMargin: {
    marginTop: BOX_MARGIN / 3 + HEADER_HEIGHT + 'px' + '!important',
  },
  headerMargin: {
    marginTop: HEADER_HEIGHT + 'px' + '!important',
    borderTop: '1px solid ' + theme.palette.grey[300],
  },
  boxLayout: {
    margin: BOX_MARGIN,
    ...BoxLayoutBoxApplyStyles,
  },
  boxLayoutNoPaper: {
    margin: BOX_MARGIN,
  },
  hideShadows: {
    position: 'relative',
    backgroundColor: theme.palette.background.default,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
  },
  vertical: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'stretch',
    minHeight: 0,
  },
  noscroll: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  scroll: {
    minHeight: 0,
    flexGrow: 1,
  },
  [`scroll-${Orientation.Both}`]: {
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Both }),
  },
  [`scroll-${Orientation.Horizontal}`]: {
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Horizontal }),
  },
  [`scroll-${Orientation.Vertical}`]: {
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
  section: {
    minWidth: 0,
  },
  content: {
  },
  contentMergeWithMenuBoxLayout: {
    marginLeft: 0,
  },
  menuMergeWithContent: {
    borderRight: '1px solid ' + theme.palette.grey[300],
  },
  menu: {
    marginRight: 0,
  },
  previewNoBoxLayout: {
    borderLeft: '1px solid ' + theme.palette.grey[300],
  },
  preview: {
    margin: 0, // boxLayout without margins
  },
});
interface Props {
  header: Header;
  main: MainSection;
  toolbarShow: boolean;
  toolbarLeft: React.ReactNode;
  toolbarRight?: React.ReactNode;
  menu?: MenuSection;
  previewShow?: boolean;
  previewForceShowClose?: boolean;
  previewShowChanged: (show: boolean) => void;
  preview?: PreviewSection;
  barTop?: React.ReactNode;
  barBottom?: React.ReactNode;
  children: React.ReactNode;
  contentMargins?: boolean;
}
interface State {
  mobileMenuOpen: boolean;
}
class Layout extends Component<Props & WithMediaQueries<keyof LayoutState> & WithStyles<typeof styles, true> & WithWidthProps, State> {
  readonly editor: ConfigEditor.Editor = new ConfigEditor.EditorImpl();
  readonly containerRef = React.createRef<HTMLDivElement>();

  constructor(props) {
    super(props);
    this.state = {
      mobileMenuOpen: false,
    };
  }

  render() {
    const layoutState: LayoutState = {
      overflowPreview: this.props.mediaQueries.overflowPreview,
      overflowMenu: this.props.mediaQueries.overflowMenu,
      enableBoxLayout: this.props.mediaQueries.enableBoxLayout,
    };

    const mainSection = this.prerenderSectionContent(layoutState, this.props.main);
    const menuSection = this.prerenderSectionContent(layoutState, this.props.menu);
    const previewSection = this.prerenderSectionContent(layoutState, this.props.preview);

    const title = !!this.props.header?.title ? (
      <div className={classNames(this.props.classes.header, this.props.classes.headerLeft)}>
        <Typography variant='h4' component='h1'>{this.props.header.title}</Typography>
      </div>
    ) : undefined;
    const action = !!this.props.header?.action ? (
      <div className={classNames(this.props.classes.header, this.props.classes.headerRight)}>
        <Button
          variant='contained'
          disableElevation
          color='primary'
          onClick={this.props.header.action.onClick}
        >{this.props.header.action.label}</Button>
      </div>
    ) : undefined;
    const showHeader = !!title || !!action;

    const previewBar = (!!previewSection?.bar || !!layoutState.overflowPreview) && (
      <>
        <div className={classNames(
          this.props.classes.previewBar,
          !!previewSection?.bar && this.props.classes.previewBarBorder,
        )}>
          {(!!layoutState.overflowPreview || !!this.props.previewForceShowClose) && (
            <IconButton
              color='inherit'
              aria-label=''
              onClick={this.handlePreviewToggle.bind(this)}
            >
              <CloseIcon />
            </IconButton>
          ) || (
              <InfoIcon className={this.props.classes.previewBarItem} />
            )}
          {!!previewSection?.bar && (
            <>
              <div className={classNames(this.props.classes.previewBarContent, this.props.classes.previewBarItem)}>
                {previewSection.bar}
              </div>
            </>
          )}
        </div>
      </>
    );

    const preview = previewSection && (
      <div className={classNames(
        layoutState.enableBoxLayout && this.props.classes.boxLayout,
        !layoutState.enableBoxLayout && this.props.classes.previewNoBoxLayout,
        this.props.classes.section,
        this.props.classes.preview,
        this.props.classes.vertical,
      )} style={{
        flexGrow: this.props.preview?.size?.flexGrow || 0,
        flexBasis: this.props.preview?.size?.breakWidth || 'content',
        width: this.props.preview?.size?.width,
        maxWidth: this.props.preview?.size?.maxWidth,
      }}>
        <div className={this.props.classes.hideShadows}>
          {previewBar}
          <div className={classNames(
            !!previewSection.size?.scroll ? this.props.classes.scroll : this.props.classes.noscroll,
            !!previewSection.size?.scroll && this.props.classes[`scroll-${previewSection.size?.scroll || Orientation.Vertical}`],
          )}>
            {previewSection.content}
          </div>
        </div>
      </div>
    );

    const menu = !!menuSection && (
      <div className={classNames(
        layoutState.enableBoxLayout && !layoutState.overflowMenu && showHeader && this.props.classes.boxLayoutWithHeaderMargin,
        !layoutState.enableBoxLayout && !layoutState.overflowMenu && showHeader && this.props.classes.headerMargin,
        layoutState.enableBoxLayout && this.props.classes.boxLayout,
        this.props.classes.section,
        this.props.classes.menu,
        !menuSection?.detachFromMain && !layoutState.overflowMenu && this.props.classes.menuMergeWithContent,
        this.props.classes.vertical,
      )} style={{
        flexGrow: this.props.menu?.size?.flexGrow || 0,
        flexBasis: this.props.menu?.size?.breakWidth || 'content',
        width: this.props.menu?.size?.width,
        maxWidth: this.props.menu?.size?.maxWidth,
      }}>
        <div className={this.props.classes.hideShadows}>
          {!layoutState.overflowMenu && (title)}
          <div className={classNames(
            !!menuSection.size?.scroll ? this.props.classes.scroll : this.props.classes.noscroll,
            !!menuSection.size?.scroll && this.props.classes[`scroll-${menuSection.size?.scroll || Orientation.Vertical}`],
          )}>
            {menuSection.content}
          </div>
        </div>
      </div>
    );

    const main = !!mainSection && (
      <div className={classNames(
        layoutState.enableBoxLayout && showHeader && this.props.classes.boxLayoutWithHeaderMargin,
        !layoutState.enableBoxLayout && showHeader && this.props.classes.headerMargin,
        layoutState.enableBoxLayout && (mainSection.boxLayoutNoPaper ? this.props.classes.boxLayoutNoPaper : this.props.classes.boxLayout),
        !menuSection?.detachFromMain && layoutState.enableBoxLayout && !layoutState.overflowMenu && this.props.classes.contentMergeWithMenuBoxLayout,
        this.props.classes.section,
        this.props.classes.content,
        this.props.classes.vertical,
      )} style={{
        flexGrow: this.props.main?.size?.flexGrow || 0,
        flexBasis: this.props.main.size?.breakWidth || 'content',
        width: this.props.main.size?.width,
        maxWidth: this.props.main.size?.maxWidth,
      }}>
        <div className={this.props.classes.hideShadows}>
          {(!!layoutState.overflowMenu || !menu) && (title)}
          {action}
          {!!this.props.barTop && (
            <div>
              {this.props.barTop}
              <Divider />
            </div>
          )}
          <div className={classNames(
            !!mainSection.size?.scroll ? this.props.classes.scroll : this.props.classes.noscroll,
            !!mainSection.size?.scroll && this.props.classes[`scroll-${mainSection.size?.scroll || Orientation.Vertical}`],
            !!this.props.contentMargins && this.props.classes.contentMargins,
          )}>
            {mainSection.content}
          </div>
          {!!this.props.barBottom && (
            <div>
              <Divider />
              {this.props.barBottom}
            </div>
          )}
        </div>
      </div>
    );

    return (
      <div ref={this.containerRef}>
        {!!this.props.toolbarShow && (
          <AppBar elevation={0} color='default' className={this.props.classes.appBar}>
            <Toolbar>
              {!!layoutState.overflowMenu && !!menu && (
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
        {layoutState.overflowMenu && !!menu && (
          <Drawer
            variant='temporary'
            open={this.state.mobileMenuOpen}
            onClose={this.handleDrawerToggle.bind(this)}
            classes={{
              paper: classNames(this.props.classes.menuPaper),
            }}
            style={{
              width: menuSection?.size?.maxWidth || menuSection?.size?.width || menuSection?.size?.breakWidth || '100%',
            }}
            ModalProps={{
              container: () => this.containerRef.current!,
              keepMounted: true,
            }}
          >
            {!!this.props.toolbarShow && (<div className={this.props.classes.toolbarSpacer} />)}
            {menu}
          </Drawer>
        )}
        {layoutState.overflowPreview && !!preview && (
          <Drawer
            variant='temporary'
            SlideProps={{ mountOnEnter: true }}
            anchor='right'
            open={!!this.props.previewShow}
            onClose={this.handlePreviewToggle.bind(this)}
            classes={{
              paper: this.props.classes.previewMobilePaper,
            }}
            style={{
              width: previewSection?.size?.maxWidth || previewSection?.size?.width || previewSection?.size?.breakWidth || '100%',
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
            layoutState.enableBoxLayout && this.props.classes.boxLayoutParent,
          )}>
            {!layoutState.overflowMenu && !!menu && (
              menu
            )}
            {main}
            {!layoutState.overflowPreview && !!preview && (
              preview
            )}
          </div>
        </div>
      </div>
    );
  }

  handleDrawerToggle() {
    this.setState({ mobileMenuOpen: !this.state.mobileMenuOpen });
  };

  handlePreviewToggle() {
    this.props.previewShowChanged(!this.props.previewShow);
  };

  prerenderSectionContent<S extends Section>(layoutState: LayoutState, section?: S): (Omit<S, 'content'> & { content: React.ReactNode }) | undefined {
    if (!section) {
      return undefined;
    } else if (typeof section?.content === 'function') {
      const content = section.content(layoutState);
      if (!content) return undefined;
      return {
        ...section,
        content,
      };
    } else {
      return section;
    }
  }
}

export default withMediaQueries<keyof LayoutState, Props>(props => {
  const sizeMenu = props.menu?.size?.breakWidth || 0;
  const sizePreview = props.preview?.size?.breakWidth || 0;
  const sizeMenuBox = props.menu?.detachFromMain ? BOX_MARGIN : 0;
  const sizeContentBox = BOX_MARGIN * 2;
  const sizePreviewBox = BOX_MARGIN;

  // content
  const sizeContent = props.main.size?.breakWidth || 0;
  // content box
  const sizeContentWithBox = sizeContent + sizeContentBox;
  // content menu
  const sizeContentAndMenu = sizeContent + sizeMenu;
  // content menu box
  const sizeContentAndMenuWithBox = sizeContent + sizeContentBox + sizeMenu + sizeMenuBox;
  // content menu preview
  const sizeContentAndMenuAndPreview = sizeContent + sizeMenu + sizePreview;
  // content menu preview box
  const sizeContentAndMenuWithBoxAndPreviewWithBox = sizeContent + sizeContentBox + sizeMenu + sizeMenuBox + sizePreview + sizePreviewBox;

  return {
    enableBoxLayout:
      `(min-width: ${sizeContentWithBox}px) and (max-width: ${sizeContentAndMenu}px),`
      + `(min-width: ${sizeContentAndMenuWithBox}px) and (max-width: ${sizeContentAndMenuAndPreview}px),`
      + `(min-width: ${sizeContentAndMenuWithBoxAndPreviewWithBox}px)`,
    overflowPreview: `(max-width: ${sizeContentAndMenuAndPreview}px)`,
    overflowMenu: `(max-width: ${sizeContentAndMenu}px)`,
  };
})(withStyles(styles, { withTheme: true })(Layout));
