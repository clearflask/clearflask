// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { AppBar, Button, Divider, Drawer, IconButton, Portal, SvgIconTypeMap, Toolbar, Typography, WithWidthProps } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { CSSProperties } from '@material-ui/core/styles/withStyles';
import CloseIcon from '@material-ui/icons/Close';
import MenuIcon from '@material-ui/icons/Menu';
import classNames from 'classnames';
import React, { Component } from 'react';
import * as ConfigEditor from './config/configEditor';
import { contentScrollApplyStyles, Orientation } from './ContentScroll';
import HelpPopper from './HelpPopper';
import { TourAnchor } from './tour';
import { notEmpty } from './util/arrayUtil';
import keyMapper from './util/keyMapper';
import { withMediaQueries, WithMediaQueries } from './util/MediaQuery';
import { customShouldComponentUpdate } from './util/reactUtil';

export interface LayoutState {
  isShown: (name: string) => BreakAction;
  enableBoxLayout: boolean;
}
export interface HeaderTitle {
  title?: string;
  icon?: OverridableComponent<SvgIconTypeMap>;
  help?: string;
}
export interface HeaderAction {
  label: string;
  onClick: () => void;
  icon?: OverridableComponent<SvgIconTypeMap>;
  tourAnchorProps?: React.ComponentProps<typeof TourAnchor>;
}
export interface Header {
  left?: React.ReactNode;
  title?: HeaderTitle;
  middle?: React.ReactNode;
  action?: HeaderAction;
  right?: React.ReactNode;
  height?: number;
}
export interface LayoutSize {
  breakWidth?: number;
  width?: number | string;
  flexGrow?: number;
  maxWidth?: number | string;
  scroll?: Orientation;
}
export type SectionContent = React.ReactNode | ((layoutState: LayoutState) => (React.ReactNode | null));
export type BreakAction = 'show' | 'hide' | 'menu' | 'drawer' | 'stack';
export type Section = {
  name: string;
  size?: LayoutSize;
  breakPriority?: number;
  breakAlways?: boolean;
  noPaper?: boolean;
  collapseLeft?: boolean;
  collapseTopBottom?: boolean;
  collapseTop?: boolean;
  collapseBottom?: boolean;
  collapseRight?: boolean;
  header?: Header | ((layoutState: LayoutState) => Header | undefined);
  barTop?: SectionContent;
  content: SectionContent;
  barBottom?: SectionContent;
} & (
    {
      breakAction?: Exclude<BreakAction, 'stack'>; // default: 'show'
    } | {
      breakAction: 'stack';
      stackWithSectionName: string;
      stackLevel: Exclude<number, 0>;
    }
  );

export const BOX_MARGIN = 36;
const HEADER_HEIGHT = 56;
export const BoxLayoutBoxApplyStyles = (theme: Theme): Record<string, string | CSSProperties> => ({
  boxShadow: `0px 0px 50px 0 ${theme.palette.divider}`,
});

const styles = (theme: Theme) => createStyles({
  sectionHeader: {
    position: 'absolute',
    top: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
    left: 0,
  },
  sectionHeaderNobox: {
    backgroundColor: theme.palette.background.default,
  },
  headerTitle: {
    alignSelf: 'center',
    display: 'flex',
    alignItems: 'center',
    marginLeft: theme.spacing(4),
    color: theme.palette.text.hint,
  },
  headerAction: {
    alignSelf: 'center',
    marginRight: theme.spacing(4),
  },
  menuPaper: {
    zIndex: theme.zIndex.drawer + 1,
  },
  bar: {
  },
  previewMobileModal: {
    zIndex: (theme.zIndex.drawer + '!important') as any,
  },
  previewMobilePaper: {
    overflowY: 'scroll' as 'scroll',
    maxWidth: '100%',
    background: theme.palette.background.default,
  },
  previewCloseButton: {
    alignSelf: 'center',
  },
  appBar: {
    zIndex: Math.max(theme.zIndex.appBar, theme.zIndex.drawer) + 1,
    ...BoxLayoutBoxApplyStyles(theme),
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Horizontal, backgroundColor: theme.palette.background.paper }),
  },
  menuButton: {
    marginRight: 20,
  },
  toolbarSpacer: theme.mixins.toolbar,
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
  shadows: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
  },
  hideShadows: {
    position: 'relative',
    backgroundColor: theme.palette.background.paper,
  },
  flexHorizontal: {
    display: 'flex',
    alignItems: 'stretch',
    minHeight: 0,
  },
  flexVertical: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'stretch',
    minHeight: 0,
  },
  noscroll: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  scroll: {
    minHeight: 0,
    flexGrow: 1,
  },
  sectionsBox: {
    padding: BOX_MARGIN / 2, // Outer box margins
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Horizontal }),
  },
  sectionsNobox: {
    backgroundColor: theme.palette.divider,
    ...contentScrollApplyStyles({
      theme, orientation: Orientation.Horizontal,
      backgroundColor: theme.palette.divider
    }),
  },
  sections: {
    position: 'relative',
    zIndex: 0,
    // Border-hack between collapsed sections
    columnGap: 1,
    columnRuleColor: theme.palette.divider,
  },
  stackedSections: {
    // Border-hack between collapsed sections
    rowGap: 1,
    columnRuleColor: theme.palette.divider,
  },
  section: {
    minWidth: 0,
  },
  boxPaper: {
    ...BoxLayoutBoxApplyStyles(theme),
  },
  boxNoPaper: {
    zIndex: -1,
  },
  boxLeft: {
    marginLeft: BOX_MARGIN / 2,
  },
  collapseLeft: {
    marginLeft: -BOX_MARGIN / 2,
  },
  boxRight: {
    marginRight: BOX_MARGIN / 2,
  },
  collapseRight: {
    marginRight: -BOX_MARGIN / 2,
  },
  boxTop: {
    marginTop: BOX_MARGIN / 2,
  },
  collapseTop: {
    marginTop: -BOX_MARGIN / 2,
  },
  boxBottom: {
    marginBottom: BOX_MARGIN / 2,
  },
  collapseBottom: {
    marginBottom: -BOX_MARGIN / 2,
  },
  'scroll-both': {
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Both }),
  },
  'scroll-horizontal': {
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Horizontal }),
  },
  'scroll-vertical': {
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
});
interface Props {
  sections: Array<Section>;
  toolbarShow: boolean;
  toolbarLeft: React.ReactNode;
  toolbarRight?: React.ReactNode;
  previewShow?: boolean;
  previewForceShowClose?: boolean;
  previewShowNot: () => void;
}
interface State {
  mobileMenuOpen: boolean;
}
class Layout extends Component<Props & WithMediaQueries<any> & WithStyles<typeof styles, true> & WithWidthProps, State> {
  readonly editor: ConfigEditor.Editor = new ConfigEditor.EditorImpl();

  constructor(props) {
    super(props);
    this.state = {
      mobileMenuOpen: false,
    };
  }

  shouldComponentUpdate = customShouldComponentUpdate({
    nested: new Set(['sections', 'mediaQueries']),
    presence: new Set(['previewShowNot']),
  });

  renderHeader(layoutState: LayoutState, header: Section['header']): Header | undefined {
    if (!header) return undefined;
    if (typeof header === 'function') {
      return header(layoutState);
    } else {
      return header;
    }
  }

  renderHeaderContent(header?: Header, breakAction: BreakAction = 'show'): React.ReactNode | null {
    if (!header && breakAction !== 'drawer') return null;

    const HeaderActionIcon = header?.action?.icon;
    const headerAction = !header?.action ? undefined : (
      <TourAnchor {...header.action.tourAnchorProps}>
        {(next, isActive, anchorRef) => (
          <Button
            ref={anchorRef}
            className={this.props.classes.headerAction}
            disableElevation
            color='primary'
            onClick={() => {
              header.action?.onClick();
              next();
            }}
          >
            {header.action?.label}
            {!!HeaderActionIcon && (
              <>
                &nbsp;
                <HeaderActionIcon fontSize='inherit' color='inherit' />
              </>
            )}
          </Button>
        )}
      </TourAnchor>
    );
    const HeaderIcon = header?.title?.icon;
    return (
      <>
        {header?.left}
        {!!header?.title && (
          <Typography variant='h4' component='h1' className={this.props.classes.headerTitle}>
            {HeaderIcon && (
              <>
                <HeaderIcon fontSize='inherit' color='primary' />
                &nbsp;&nbsp;
              </>
            )}
            {header.title.title}
            {header.title.help && (
              <>
                &nbsp;
                <HelpPopper description={header.title.help} />
              </>
            )}
          </Typography>
        )}
        <div className={this.props.classes.grow} />
        {header?.middle && (
          <>
            {header.middle}
            <div className={this.props.classes.grow} />
          </>
        )}
        {headerAction}
        {breakAction === 'drawer' && (
          <IconButton
            color='inherit'
            aria-label=''
            onClick={this.handlePreviewClose.bind(this)}
            className={this.props.classes.previewCloseButton}
          >
            <CloseIcon />
          </IconButton>
        )}
        {header?.right}
      </>
    );
  }

  renderContent(layoutState: LayoutState, content: SectionContent): React.ReactNode | null {
    if (!content) {
      return null;
    } else if (typeof content === 'function') {
      return content(layoutState) || null;
    } else {
      return content;
    }
  }

  renderStackedSections(layoutState: LayoutState, section: Section, breakAction: BreakAction = 'show', stackedSections: Section[] = []): React.ReactNode | null {
    if (!stackedSections.length) return this.renderSection(layoutState, section, breakAction);

    const sections = [section, ...stackedSections]
      .sort((l, r) => (l.breakAction === 'stack' ? l.stackLevel || -1 : 0) - (r.breakAction === 'stack' ? r.stackLevel || -1 : 0));
    const contents = sections
      .map((section, index, arr) => this.renderSection(layoutState, section, (index === (arr.length - 1)) ? breakAction : 'stack'))
      .filter(notEmpty);
    if (contents.length === 0) return null;
    if (contents.length === 1) return contents[0];

    const breakWidth = sections.reduce<number | undefined>((val, section) => section.size?.breakWidth ? Math.max(section.size.breakWidth, (val || 0)) : val, undefined);
    return (
      <div key={section.name} className={classNames(
        this.props.classes.flexVertical,
        this.props.classes.stackedSections,
      )} style={{
        flexGrow: sections.reduce((val, section) => Math.max(section.size?.flexGrow || 0, val), 0),
        flexBasis: breakWidth || 'content',
        minWidth: breakWidth,
        width: sections.find(section => section.size?.width !== undefined)?.size?.width,
        maxWidth: sections.find(section => section.size?.maxWidth !== undefined)?.size?.maxWidth,
      }}>
        {contents}
      </div>
    );
  }

  renderSection(layoutState: LayoutState, section: Section, breakAction: BreakAction = 'show'): React.ReactNode | null {
    var content = this.renderContent(layoutState, section.content);
    if (!content) return null;

    if (section.size?.scroll) {
      content = (
        <div className={classNames(
          !!section.size?.scroll ? this.props.classes.scroll : this.props.classes.noscroll,
          !!section.size?.scroll && this.props.classes[`scroll-${section.size.scroll}`],
        )}>
          {content}
        </div>
      );
    }

    const isOverflow = breakAction !== 'show' && breakAction !== 'stack';
    const header = this.renderHeader(layoutState, section.header);
    const headerContent = this.renderHeaderContent(header, breakAction)
    const barTop = this.renderContent(layoutState, section.barTop);
    const barBottom = this.renderContent(layoutState, section.barBottom);
    return (
      <div key={section.name} className={classNames(
        this.props.classes.section,
        this.props.classes.flexVertical,
        !isOverflow && layoutState.enableBoxLayout && (!section.noPaper ? this.props.classes.boxPaper : this.props.classes.boxNoPaper),
        !isOverflow && layoutState.enableBoxLayout && (section.collapseLeft ? this.props.classes.collapseLeft : this.props.classes.boxLeft),
        !isOverflow && layoutState.enableBoxLayout && (section.collapseRight ? this.props.classes.collapseRight : this.props.classes.boxRight),
        !isOverflow && layoutState.enableBoxLayout && ((section.collapseTopBottom || section.collapseTop) ? this.props.classes.collapseTop : this.props.classes.boxTop),
        !isOverflow && layoutState.enableBoxLayout && breakAction !== 'stack' && ((section.collapseTopBottom || section.collapseBottom) ? this.props.classes.collapseBottom : this.props.classes.boxBottom),
      )} style={{
        flexGrow: section.size?.flexGrow || 0,
        flexBasis: section.size?.breakWidth || 'content',
        minWidth: section.size?.breakWidth,
        width: section.size?.width,
        maxWidth: section.size?.maxWidth,
        ...(header ? {
          marginTop: (header.height || HEADER_HEIGHT) + 1,
        } : {})
      }}>
        <div className={classNames(
          this.props.classes.shadows,
          !section.noPaper && this.props.classes.hideShadows,
        )}>
          {!!headerContent && (
            <div className={classNames(
              this.props.classes.sectionHeader,
              !layoutState.enableBoxLayout && this.props.classes.sectionHeaderNobox,
            )} style={{
              transform: `translateY(-${HEADER_HEIGHT + 1}px)`,
              height: header?.height || HEADER_HEIGHT,
            }}>
              {headerContent}
            </div>
          )}
          {!!barTop && (
            <>
              <div className={this.props.classes.bar}>
                {barTop}
              </div>
              <Divider />
            </>
          )}
          {content}
          {!!barBottom && (
            <>
              <Divider />
              <div className={this.props.classes.bar}>
                {barBottom}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  render() {
    const stackedSectionsForName: { [name: string]: Section[] } = {};
    const breakActionForName: { [name: string]: BreakAction } = {};
    this.props.sections.forEach(section => {
      const breakAction = (section.breakAlways
        ? section.breakAction
        : (this.props.mediaQueries[section.name] === false && section.breakAction))
        || 'show';
      breakActionForName[section.name] = breakAction;
      if (breakAction === 'stack' && section.breakAction === 'stack') {
        stackedSectionsForName[section.stackWithSectionName] = stackedSectionsForName[section.stackWithSectionName] || [];
        stackedSectionsForName[section.stackWithSectionName].push(section);
      }
    });
    const layoutState: LayoutState = {
      isShown: name => breakActionForName[name] || 'show',
      enableBoxLayout: this.props.mediaQueries.enableBoxLayout,
    };

    const sectionPreview = this.props.sections.find(s => s.breakAction === 'drawer');
    const contentPreview = !sectionPreview || layoutState.isShown(sectionPreview.name) !== 'drawer'
      ? null : this.renderStackedSections(layoutState, sectionPreview, 'drawer', stackedSectionsForName[sectionPreview.name]);
    const sectionMenu = this.props.sections.find(s => s.breakAction === 'menu');
    const contentMenu = !sectionMenu || layoutState.isShown(sectionMenu.name) !== 'menu'
      ? null : this.renderStackedSections(layoutState, sectionMenu, 'menu', stackedSectionsForName[sectionMenu.name]);

    const contents: React.ReactNode[] = [];
    this.props.sections.forEach(section => {
      const breakAction = breakActionForName[section.name];
      if (breakAction !== 'show') return;
      const content = this.renderStackedSections(layoutState, section, breakAction, stackedSectionsForName[section.name]);
      if (!content) return;
      contents.push(content);
    });

    return (
      <div>
        {!!this.props.toolbarShow && (
          <Portal>
            <AppBar elevation={0} color='default' className={this.props.classes.appBar}>
              <Toolbar>
                {!!contentMenu && (
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
          </Portal>
        )}
        {!!contentMenu && (
          <Drawer
            variant='temporary'
            open={this.state.mobileMenuOpen}
            onClose={this.handleDrawerToggle.bind(this)}
            classes={{
              paper: classNames(this.props.classes.menuPaper),
            }}
            style={{
              width: sectionMenu?.size?.maxWidth || sectionMenu?.size?.width || sectionMenu?.size?.breakWidth || '100%',
            }}
            ModalProps={{
              keepMounted: true,
            }}
          >
            {!!this.props.toolbarShow && (<div className={this.props.classes.toolbarSpacer} />)}
            {contentMenu}
          </Drawer>
        )}
        {!!contentPreview && (
          <Drawer
            variant='temporary'
            SlideProps={{ mountOnEnter: true }}
            anchor='right'
            open={!!this.props.previewShow}
            onClose={this.handlePreviewClose.bind(this)}
            classes={{
              modal: this.props.classes.previewMobileModal,
              paper: this.props.classes.previewMobilePaper,
            }}
            style={{
              width: sectionPreview?.size?.maxWidth || sectionPreview?.size?.width || sectionPreview?.size?.breakWidth || '100%',
            }}
          >
            {!!this.props.toolbarShow && (<div className={this.props.classes.toolbarSpacer} />)}
            {contentPreview}
          </Drawer>
        )}
        <div className={classNames(this.props.classes.page, this.props.classes.flexVertical)}>
          {!!this.props.toolbarShow && (<div className={this.props.classes.toolbarSpacer} />)}
          <div className={classNames(
            this.props.classes.sections,
            layoutState.enableBoxLayout ? this.props.classes.sectionsBox : this.props.classes.sectionsNobox,
            this.props.classes.grow,
            this.props.classes.flexHorizontal,
          )}>
            {contents}
          </div>
        </div>
      </div>
    );
  }

  handleDrawerToggle() {
    this.setState({ mobileMenuOpen: !this.state.mobileMenuOpen });
  };

  handlePreviewClose() {
    this.props.previewShowNot();
  };
}

export default keyMapper(
  (ownProps: Props) => {
    const sectionNames = ownProps.sections
      .map(s => s.name)
      .join('-');
    // Number of sections cannot change as it causes dynamic number of hooks
    return `section-count-${sectionNames}`;
  },
  withMediaQueries<'enableBoxLayout' | any, Props>(ownProps => {
    var staticWidth = 0;
    var staticBoxWidth = BOX_MARGIN; // Outer margin
    var variableWidth = 0;
    var variableBoxWidth = 0;
    variableWidth += ownProps.sections.length - 1; // Accounts for column-gap 1px
    const sectionsByPrio: Section[] = [];
    for (const section of ownProps.sections) {
      if (section.breakAlways && section.breakAction !== 'show') continue;
      const sectionWidth = section.size?.breakWidth || 0;
      const sectionBoxWidth = ((section.collapseLeft ? -0.5 : 0.5) + (section.collapseRight ? -0.5 : 0.5)) * BOX_MARGIN;
      if (!section.breakAction || section.breakAction === 'show') {
        staticWidth += sectionWidth;
        staticBoxWidth += sectionBoxWidth;
      } else {
        variableWidth += sectionWidth;
        variableBoxWidth += sectionBoxWidth;
        sectionsByPrio.push(section);
      }
    }
    sectionsByPrio.sort((l, r) => (l.breakPriority || -1) - (r.breakPriority || -1));

    const mediaQueries = {};
    mediaQueries['enableBoxLayout'] = `(min-width: ${staticWidth + staticBoxWidth + variableWidth + variableBoxWidth}px)`;
    while (true) {
      const section = sectionsByPrio.pop();
      if (!section) break;
      const sectionWidth = section.size?.breakWidth || 0;
      const sectionBoxWidth = ((section.collapseLeft ? -0.5 : 0.5) + (section.collapseRight ? -0.5 : 0.5)) * BOX_MARGIN;

      const overflowSection = staticWidth + variableWidth;
      mediaQueries[section.name] = `(min-width: ${overflowSection}px)`;

      variableWidth -= sectionWidth;
      variableWidth -= 1; // Accounts for column-gap 1px
      variableBoxWidth -= sectionBoxWidth;

      const showBoxMaxWidth = overflowSection - 1;
      const showBoxMinWidth = staticWidth + staticBoxWidth + variableWidth + variableBoxWidth;
      mediaQueries['enableBoxLayout'] = `(min-width: ${showBoxMinWidth}px) and (max-width: ${showBoxMaxWidth}px),` + mediaQueries['enableBoxLayout'];
    }
    return mediaQueries;
  })(withStyles(styles, { withTheme: true })(Layout)));
