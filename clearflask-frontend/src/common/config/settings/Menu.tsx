// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Badge, Link as MuiLink, ListItem, ListItemText } from '@material-ui/core';
import Collapse from '@material-ui/core/Collapse';
import List, { ListProps } from '@material-ui/core/List';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ExpandIcon from '../../icon/ExpandIcon';
import * as ConfigEditor from '../configEditor';

export interface MenuHeading {
  type: 'heading';
  text: string | React.ReactNode;
  offset?: number;
  hasUnsavedChanges?: boolean;
}

export interface MenuItem {
  type: 'item';
  name: string | React.ReactNode;
  disabled?: boolean;
  slug?: string;
  ext?: string;
  newTab?: string;
  offset?: number;
  hasNotification?: boolean;
}

export interface MenuProject {
  type: 'project';
  name?: string | React.ReactNode;
  slug: string;
  projectId: string;
  page: ConfigEditor.Page;
  hasUnsavedChanges?: boolean;
  offset?: number;
}

const paddingForLevel = (offset: number = 0): React.CSSProperties | undefined => {
  return offset === 0 ? undefined : { paddingLeft: offset * 10 };
};

const styles = (theme: Theme) => createStyles({
  badgeDot: {
    backgroundColor: theme.palette.text.primary,
  },
  link: {
    color: 'currentColor',
  },
  text: {
    position: 'relative', // for expandButton
  },
  expandButton: {
    position: 'absolute',
    padding: theme.spacing(1),
    left: theme.spacing(0.5),
    top: '50%',
    transform: 'translate(-100%, -50%)',
  },
  menuItem: {
    padding: theme.spacing(0.5, 3),
  },
  isSelected: {
    color: theme.palette.primary.main + '!important',
  },
});

interface Props extends ListProps {
  items: (MenuProject | MenuItem | MenuHeading)[];
  activePath: string;
  activeSubPath: ConfigEditor.Path;
  onAnyClick?: () => void;
}

class MenuWithoutStyle extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const activeSlug = [this.props.activePath, ...this.props.activeSubPath].join('/');
    return (
      <List dense component='nav' style={{ padding: '0px' }}>
        {this.props.items.map((item, index) => {
          if (item.type === 'item') {
            var component;
            var componentProps = {};
            if (item.slug !== undefined) {
              component = Link;
              componentProps = {
                to: `/dashboard/${item.slug}`,
              };
            } else if (item.ext) {
              component = MuiLink;
              componentProps = {
                href: item.ext,
                target: '_blank',
              };
            }
            const isSelected = item.slug === activeSlug;
            return (
              <ListItem
                key={`${index}-${item.slug || item.ext || 'empty'}`}
                button
                disabled={item.disabled}
                // selected={isSelected}
                onClick={this.props.onAnyClick}
                className={classNames(
                  this.props.classes.link,
                  this.props.classes.menuItem,
                  isSelected && this.props.classes.isSelected,
                )}
                component={component}
                {...componentProps}
              >
                <ListItemText style={paddingForLevel(item.offset)} primary={(
                  <>
                    <span>{item.name}</span>
                    <Badge
                      color='primary'
                      variant='dot'
                      invisible={!item.hasNotification}
                    >
                      &nbsp;&nbsp;
                    </Badge>
                  </>
                )} />
              </ListItem>
            );
          } else if (item.type === 'project') {
            const activePath = !activeSlug.startsWith(item.slug) ? undefined
              : activeSlug.slice(item.slug.length)
                .split('/')
                .filter(value => value !== '')
                .map(value => /^\d+$/.test(value) ? parseInt(value) : value);
            return (
              <MenuPage
                key={`${index}-${item.page.key}`}
                overrideName={item.name}
                offset={item.offset}
                page={item.page}
                hasUnsavedChanges={item.hasUnsavedChanges}
                activePath={activePath}
                slug={item.slug}
                onAnyClick={this.props.onAnyClick}
              />
            );
          } else if (item.type === 'heading') {
            return (
              <ListItem
                key={`${index}-${item.text}`}
                disabled
                className={this.props.classes.menuItem}
              >
                <ListItemText style={paddingForLevel(item.offset)} primary={(
                  <>
                    {item.text}
                    <Badge
                      color='primary'
                      variant='dot'
                      invisible={!item.hasUnsavedChanges}
                    >
                      &nbsp;&nbsp;
                    </Badge>
                  </>
                )} />
              </ListItem>
            );
          } else {
            return null;
          }
        })}
      </List>
    );
  }
}
const Menu = withStyles(styles, { withTheme: true })(MenuWithoutStyle);
export default Menu;

interface PropsPage {
  key: string;
  page: ConfigEditor.Page;
  overrideName?: string | React.ReactNode | undefined;
  activePath?: ConfigEditor.Path;
  slug: string;
  onAnyClick?: () => void;
  offset?: number;
  hasUnsavedChanges?: boolean;
}
interface StatePage {
  expanded?: boolean;
}
class MenuPageWithoutStyle extends Component<PropsPage & WithTranslation<'app'> & WithStyles<typeof styles, true>, StatePage> {
  state: StatePage = {};
  unsubscribe?: () => void;

  componentDidMount() {
    this.unsubscribe = this.props.page.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const hasChildren = this.props.page.getChildren().pages.filter(p => !p.hide).some(p => !!p.value)
      || this.props.page.getChildren().groups.filter(p => !p.hide).some(p => !!p.value);
    const autoExpandLevel = 0; // Disabled for now
    const expandedDontShow = !hasChildren || this.props.page.path.length < autoExpandLevel;
    const expanded = expandedDontShow
      || (this.state.expanded !== undefined
        ? this.state.expanded
        : this.isSelectedOrParent(this.props.page.path));
    const padding = paddingForLevel(this.props.offset || 0);
    const color = this.props.page.getColor();
    const { classes, ...menuProps } = this.props;
    const isSelected = this.isSelected(this.props.page.path);
    return (
      <Collapse in={this.props.page.required || this.props.page.value === true} timeout="auto" mountOnEnter unmountOnExit>
        <ListItem
          // selected={isSelected}
          className={classNames(
            this.props.classes.menuItem,
            isSelected && this.props.classes.isSelected,
          )}
          button
          component={Link}
          to={`/dashboard/${[this.props.slug, ...this.props.page.path].join('/')}`}
          onClick={() => {
            this.props.onAnyClick && this.props.onAnyClick();
            if (!this.state.expanded) {
              this.setState({ expanded: true });
            }
          }}
        >
          <ListItemText style={padding} primary={(
            <>
              <span className={this.props.classes.text} style={{ color }}>
                {!expandedDontShow && (
                  <ExpandIcon
                    IconButtonProps={{
                      className: this.props.classes.expandButton,
                      onClick: e => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.setState({ expanded: !this.state.expanded });
                      },
                    }}
                    IconProps={{
                      fontSize: 'inherit',
                    }}
                    expanded={expanded}
                  />
                )}
                {this.props.overrideName !== undefined ? this.props.overrideName : this.props.t(this.props.page.getDynamicName() as any)}
              </span>
              {this.props.hasUnsavedChanges && (
                <Badge
                  variant='dot'
                  color='primary'
                >
                  &nbsp;&nbsp;
                </Badge>
              )}
            </>
          )} />
        </ListItem>
        <Collapse in={expanded} timeout="auto" mountOnEnter unmountOnExit>
          {this.props.page.getChildren().all
            .map(child => {
              if (child.hide) return null;
              switch (child.type) {
                case ConfigEditor.PageType:
                  return (<MenuPage
                    {...menuProps}
                    key={child.key}
                    offset={(this.props.offset || 0) + 1}
                    overrideName={undefined}
                    hasUnsavedChanges={false}
                    page={child}
                  />);
                case ConfigEditor.PageGroupType:
                  return (<MenuPageGroup
                    {...menuProps}
                    key={child.key}
                    offset={(this.props.offset || 0) + 1}
                    pageGroup={child}
                  />);
                default:
                  return null;
              }
            })}
        </Collapse>
      </Collapse>
    );
  }

  isSelectedOrParent(path: ConfigEditor.Path): boolean {
    if (!this.props.activePath || this.props.activePath.length < path.length) {
      return false;
    }
    for (let i = 0; i < path.length; i++) {
      if (path[i] !== this.props.activePath[i]) {
        return false;
      }
    }
    return true;
  }

  isSelected(path: ConfigEditor.Path) {
    if (!this.props.activePath || this.props.activePath.length !== path.length) {
      return false;
    }
    for (let i = 0; i < path.length; i++) {
      if (path[i] !== this.props.activePath[i]) {
        return false;
      }
    }
    return true;
  }
}
const MenuPage = withStyles(styles, { withTheme: true })(withTranslation('app', { withRef: true })(MenuPageWithoutStyle));

interface PropsPageGroup {
  key: string;
  pageGroup: ConfigEditor.PageGroup;
  activePath?: ConfigEditor.Path;
  offset?: number;
  slug: string;
  onAnyClick?: () => void;
}

class MenuPageGroupWithoutStyle extends Component<PropsPageGroup & WithStyles<typeof styles, true>> {
  unsubscribe?: () => void;

  componentDidMount() {
    this.unsubscribe = this.props.pageGroup.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const childPages = this.props.pageGroup.getChildPages();
    const padding = paddingForLevel(this.props.offset);
    const { classes, ...menuProps } = this.props;
    return (
      <Collapse in={childPages.length > 0} timeout="auto" mountOnEnter unmountOnExit>
        <div>
          <ListItem
            className={this.props.classes.menuItem}
            disabled
          >
            <ListItemText
              style={padding}
              primary={this.props.pageGroup.name} />
          </ListItem>
          {childPages.map(childPage =>
            <MenuPage
              {...menuProps}
              key={childPage.key}
              offset={this.props.offset}
              page={childPage}
            />
          )}
        </div>
      </Collapse>
    );
  }
}
const MenuPageGroup = withStyles(styles, { withTheme: true })(MenuPageGroupWithoutStyle);
