import { Badge, Collapse, Divider, IconButton, Link as MuiLink, Tab, Tabs, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import BalanceIcon from '@material-ui/icons/AccountBalance';
import AccountIcon from '@material-ui/icons/AccountCircle';
import ReturnIcon from '@material-ui/icons/KeyboardBackspaceOutlined';
import NotificationsIcon from '@material-ui/icons/Notifications';
import SettingsIcon from '@material-ui/icons/Settings';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import * as Client from '../api/client';
import { ReduxState, Server, StateSettings, Status } from '../api/server';
import DropdownTab, { tabHoverApplyStyles } from '../common/DropdownTab';
import InViewObserver from '../common/InViewObserver';
import { notEmpty } from '../common/util/arrayUtil';
import windowIso from '../common/windowIso';
import { animateWrapper } from '../site/landing/animateUtil';
import LogIn from './comps/LogIn';
import TemplateLiquid from './comps/TemplateLiquid';
import NotificationBadge from './NotificationBadge';
import NotificationPopup from './NotificationPopup';

const largeLogoFactor = 1.7;

const styles = (theme: Theme) => createStyles({
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    flexWrap: 'wrap-reverse',
    minHeight: 48,
  },
  indicator: {
    borderRadius: '1px',
    // height: 1,
    // Uncomment to flip to the top
    // bottom: 'unset',
    // top: 0,
  },
  logoAndMenu: {
    flex: 100000,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  returnIcon: {
    marginLeft: theme.spacing(-1.5),
    color: theme.palette.text.hint,
  },
  headerSpacing: {
    width: '100%',
    maxWidth: '1024px',
    margin: '0px auto',
    [theme.breakpoints.down('xs')]: {
      padding: theme.spacing(2, 1),
    },
    [theme.breakpoints.between('sm', 'md')]: {
      padding: theme.spacing(2, 4),
    },
    [theme.breakpoints.up('lg')]: {
      padding: theme.spacing(2, 6),
    },
  },
  menu: {
    flex: 1,
    margin: '0px auto',
  },
  tabRoot: {
    minWidth: '0px!important',
    padding: '6px 12px',
    [theme.breakpoints.up('md')]: {
      padding: '6px 24px',
    },
    ...(tabHoverApplyStyles(theme)),
  },
  tabsFlexContainer: {
    alignItems: 'center',
  },
  tab: {
    textTransform: 'initial',
  },
  grow: {
    flexGrow: 1,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 2, 0, 2),
    minHeight: 48,
  },
  logoImg: {
    objectFit: 'contain',
    maxHeight: '48px',
    height: 'auto',
    width: 'auto',
    minWidth: 48, // Minimize reflow for square images
    minHeight: 48, // Minimize reflow for square images
    padding: theme.spacing(1),
    transition: theme.transitions.create(['min-width', 'min-height']),
  },
  logoImgLarge: {
    minWidth: largeLogoFactor * 48,
    minHeight: largeLogoFactor * 48, // Minimize reflow for square images
  },
  logoTextLinkWrapper: {
    flex: '1 0 auto',
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none'
  },
  logoText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textDecoration: 'none',
    transition: theme.transitions.create('font-size'),
  },
  logoTextLarge: {
    fontSize: `${largeLogoFactor}em`,
  },
  actions: {
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionsContainer: {
    flex: 1,
    // When menu is too big and things wrap,
    // allow actions to overlap to make sure logo and actions are on the same line
    height: 0,
    overflow: 'visible',
  },
  actionButton: {
    margin: theme.spacing(0, 0.5, 0, 0),
    [theme.breakpoints.down('sm')]: {
      margin: 0,
      padding: 8,
    },
    fontSize: '1.2rem',
  },
  menuDivider: {
    marginTop: -1,
    transition: theme.transitions.create('height'),
  },
  menuDividerLanding: {
    height: 0,
  },
});
const useStyles = makeStyles(styles);
interface Props {
  server: Server;
  pageSlug: string;
  pageChanged: (pageUrlName: string) => void;
}
interface ConnectProps {
  config?: Client.Config;
  page?: Client.Page;
  loggedInUser?: Client.UserMe;
  settings: StateSettings;
}
interface State {
  logInOpen?: boolean;
  notificationAnchorEl?: HTMLElement;
}
class Header extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  _isMounted: boolean = false;
  readonly inViewObserverRef = React.createRef<InViewObserver>();

  componentDidMount() {
    this._isMounted = true;
    if (!!this.props.settings.demoMenuAnimate) {
      this.demoMenuAnimate(this.props.settings.demoMenuAnimate);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    const isLanding = !!this.props.page?.landing;

    var menu;
    if (this.props.config?.style.templates?.menu) {
      menu = (
        <TemplateLiquid
          template={this.props.config.style.templates.menu}
          customPageSlug={this.props.pageSlug}
        />
      );
    } else if (this.props.config && this.props.config.layout.menu.length > 0) {
      var currentTabValue = this.props.page
        ? this.props.page.slug
        : false;
      var tabs;
      tabs = this.props.config.layout.menu.map(menu => {
        if (!menu.pageIds || menu.pageIds.length === 0) return null;
        if (menu.pageIds.length === 1) {
          const page = this.props.config!.layout.pages.find(p => p.pageId === menu.pageIds[0]);
          if (page === undefined) return null;
          return (
            <Tab
              key={page.slug}
              className={this.props.classes.tab}
              component={Link}
              to={`/${page.slug}`}
              value={page.slug}
              disableRipple
              label={menu.name || page.name}
              classes={{
                root: this.props.classes.tabRoot,
              }}
            />
          );
        }
        const dropdownItems = menu.pageIds.map(pageId => {
          const page = this.props.config!.layout.pages.find(p => p.pageId === pageId);
          if (!page) {
            return undefined;
          }
          if (this.props.page && this.props.page.pageId === page.pageId) {
            currentTabValue = menu.menuId;
          }
          return { name: page.name, val: page.slug };
        })
          .filter(notEmpty);
        return (
          <DropdownTab
            key={menu.menuId}
            className={this.props.classes.tab}
            value={menu.menuId}
            selectedValue={this.props.page && this.props.page.slug}
            label={menu.name}
            links={dropdownItems}
            onDropdownTabSelect={value => this.props.pageChanged(value)}
          />
        );
      });
      menu = (
        <div className={this.props.classes.menu}>
          <Collapse in={!isLanding}>
            <Tabs
              // centered
              variant='standard'
              scrollButtons='off'
              classes={{
                flexContainer: this.props.classes.tabsFlexContainer,
                indicator: this.props.classes.indicator,
              }}
              value={currentTabValue}
              onChange={(event, value) => this.props.pageChanged(value)}
              indicatorColor="primary"
              textColor="primary"
            >
              {tabs}
            </Tabs>
          </Collapse>
        </div>
      );
    }

    var header;
    if (this.props.config?.style.templates?.header) {
      header = (
        <TemplateLiquid
          template={this.props.config.style.templates.header}
          customPageSlug={this.props.pageSlug}
        />
      );
    } else {
      // TODO this should only show when Admin logged in, not mod
      const settingsButton = this.props.server.isModOrAdminLoggedIn() && (
        <IconButton
          className={this.props.classes.actionButton}
          aria-label='Dashboard'
          onClick={() => !windowIso.isSsr && windowIso.open(`https://clearflask.com/dashboard?projectId=${this.props.server.getProjectId()}`, '_self')}
        >
          <SettingsIcon fontSize='inherit' />
        </IconButton>
      );
      var rightSide;
      if (this.props.config && this.props.loggedInUser) {
        rightSide = (
          <Collapse classes={{ wrapperInner: this.props.classes.actions }} in={!isLanding}>
            <IconButton
              className={this.props.classes.actionButton}
              aria-label='Notifications'
              onClick={e => this.setState({ notificationAnchorEl: !!this.state.notificationAnchorEl ? undefined : e.currentTarget })}
            >
              <NotificationBadge server={this.props.server}>
                <NotificationsIcon fontSize='inherit' />
                <NotificationPopup
                  server={this.props.server}
                  anchorEl={this.state.notificationAnchorEl}
                  onClose={() => this.setState({ notificationAnchorEl: undefined })}
                />
              </NotificationBadge>
            </IconButton>
            {this.props.config.users.credits && (
              <IconButton
                className={this.props.classes.actionButton}
                aria-label='Balance'
                component={Link}
                to='/transaction'
              >
                <BalanceIcon fontSize='inherit' />
              </IconButton>
            )}
            <IconButton
              className={this.props.classes.actionButton}
              aria-label='Account'
              component={Link}
              to='/account'
            >
              <Badge
                color='secondary'
                invisible={!!this.props.loggedInUser.isExternal || !!this.props.loggedInUser.name}
                variant='dot'
              >
                <AccountIcon fontSize='inherit' />
              </Badge>
            </IconButton>
            {settingsButton}
          </Collapse>
        );
      } else if (this.props.config && !this.props.loggedInUser) {
        rightSide = (
          <div className={this.props.classes.actions}>
            <IconButton
              className={this.props.classes.actionButton}
              aria-label='Account'
              onClick={() => this.setState({ logInOpen: true })}
            >
              <AccountIcon fontSize='inherit' />
            </IconButton>
            <LogIn
              server={this.props.server}
              open={this.state.logInOpen}
              onClose={() => this.setState({ logInOpen: false })}
              onLoggedInAndClose={() => this.setState({ logInOpen: false })}
            />
            {settingsButton}
          </div>
        );
      }
      rightSide = (
        <div className={this.props.classes.actionsContainer}>
          {rightSide}
        </div>
      );

      header = (
        <div className={this.props.classes.headerSpacing}>
          <div className={this.props.classes.header}>
            <div className={this.props.classes.logoAndMenu}>
              <HeaderLogo config={this.props.config} large={isLanding} />
              {menu}
            </div>
            {rightSide}
          </div>
          <Divider className={classNames(
            this.props.classes.menuDivider,
            isLanding && this.props.classes.menuDividerLanding,
          )} />
        </div>
      );
    }

    return (
      <InViewObserver ref={this.inViewObserverRef}>
        {header}
      </InViewObserver>
    );
  }

  async demoMenuAnimate(changes: Array<{ path: string }>) {
    const animate = animateWrapper(
      () => this._isMounted,
      this.inViewObserverRef,
      () => this.props.settings,
      this.setState.bind(this));

    if (await animate({ sleepInMs: 1000 })) return;

    for (; ;) {
      for (const change of changes) {
        this.props.pageChanged(change.path);

        if (await animate({ sleepInMs: 2000 })) return;
      }
    }
  }
}


export const HeaderLogo = (props: {
  config?: Client.Config,
  targetBlank?: boolean;
  suppressLogoLink?: boolean;
  large?: boolean;
}) => {
  const classes = useStyles();

  const name = !props.config?.name ? undefined : (
    <Typography variant='h6' className={classNames(
      classes.logoText,
      props.large && classes.logoTextLarge,
    )}>
      {props.config && props.config.name}
    </Typography>
  );

  const logo = !props.config?.logoUrl ? undefined : (
    <img alt='' src={props.config.logoUrl} className={classNames(
      classes.logoImg,
      props.large && classes.logoImgLarge,
    )} />
  );

  const logoAndName = props.suppressLogoLink ? (
    <>
      {logo}
      {name}
    </>
  ) : (
    <Link className={classes.logoTextLinkWrapper} to='/'>
      {logo}
      {name}
    </Link>
  );

  const website = !props.config?.website ? undefined
    : (props.config.website.match(/http(s):\/\//)
      ? props.config.website
      : `https://${props.config.website}`)

  return props.config && (props.config.logoUrl || props.config.name) ? (
    <div className={classes.logo}>
      {!!website && (
        <IconButton
          className={classes.returnIcon}
          component={MuiLink}
          color='inherit'
          href={website}
          underline='none'
          rel='noopener nofollow'
          target={props.targetBlank ? '_blank' : undefined}
        >
          <ReturnIcon color='inherit' />
        </IconButton>
      )}
      {logoAndName}
    </div>
  ) : null;
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  var page: Client.Page | undefined = undefined;
  if (state.conf.status === Status.FULFILLED && state.conf.conf) {
    const pages = state.conf.conf.layout.pages;
    page = pages.find(p => p.slug === ownProps.pageSlug);
    if (!page && ownProps.pageSlug === '' && pages.length > 0) {
      page = pages[0];
    }
  }
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    page: page,
    loggedInUser: state.users.loggedIn.user,
    settings: state.settings,
  };
})(withStyles(styles, { withTheme: true })(Header));
