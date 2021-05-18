import { Badge, IconButton, Link as MuiLink, ListItem, ListItemText } from '@material-ui/core';
import Collapse from '@material-ui/core/Collapse';
import List, { ListProps } from '@material-ui/core/List';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import ExpandIcon from '@material-ui/icons/ExpandLess';
import classNames from 'classnames';
import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import * as ConfigEditor from '../configEditor';

export interface MenuHeading {
  type: 'heading';
  text: string | React.ReactNode;
  offset?: number;
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

const paddingForLevel = (offset: number = 0, path: ConfigEditor.Path = []): React.CSSProperties | undefined => {
  var pathLengthWithoutGroup = 0;
  path.forEach(l => typeof l === 'string' && pathLengthWithoutGroup++);
  const paddingLevel = pathLengthWithoutGroup + offset;
  return paddingLevel === 0 ? undefined : { paddingLeft: paddingLevel * 10 };
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
  expandIcon: {
    transform: 'rotate(90deg)',
    transition: theme.transitions.create('transform'),
  },
  expandIconExpanded: {
    transform: 'rotate(180deg)',
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
            return (
              <ListItem
                key={`${index}-${item.slug || item.ext || 'empty'}`}
                button
                disabled={item.disabled}
                selected={item.slug === this.props.activePath}
                onClick={this.props.onAnyClick}
                className={this.props.classes.link}
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
            return (
              <MenuPage
                key={`${index}-${item.page.key}`}
                overrideName={item.name}
                offset={item.offset}
                page={item.page}
                hasUnsavedChanges={item.hasUnsavedChanges}
                activePath={item.slug === this.props.activePath ? this.props.activeSubPath : undefined}
                slug={item.slug}
                onAnyClick={this.props.onAnyClick}
              />
            );
          } else if (item.type === 'heading') {
            return (
              <ListItem key={`${index}-${item.text}`} disabled>
                <ListItemText style={paddingForLevel(item.offset)} primary={item.text} />
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
class MenuPageWithoutStyle extends Component<PropsPage & WithStyles<typeof styles, true>, StatePage> {
  state: StatePage = {};
  unsubscribe?: () => void;

  componentDidMount() {
    this.unsubscribe = this.props.page.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const hasChildren = this.props.page.getChildren().pages.some(p => !!p.value)
      || this.props.page.getChildren().groups.some(p => !!p.value);
    const expandedDontShow = !hasChildren || this.props.page.path.length < 1;
    const expanded = expandedDontShow
      || (this.state.expanded !== undefined
        ? this.state.expanded
        : this.isSelectedOrParent(this.props.page.path));
    const padding = paddingForLevel(this.props.offset || 0, this.props.page.path);
    const color = this.props.page.getColor();
    const { classes, ...menuProps } = this.props;
    return (
      <Collapse in={this.props.page.required || this.props.page.value === true} timeout="auto" unmountOnExit>
        <ListItem
          selected={this.isSelected(this.props.page.path)}
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
                  <IconButton
                    className={this.props.classes.expandButton}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      this.setState({ expanded: !this.state.expanded });
                    }}
                  >
                    <ExpandIcon
                      fontSize='inherit'
                      className={classNames(this.props.classes.expandIcon, !!expanded && this.props.classes.expandIconExpanded)}
                    />
                  </IconButton>
                )}
                {this.props.overrideName !== undefined ? this.props.overrideName : this.props.page.getDynamicName()}
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
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          {this.props.page.getChildren().all
            .map(child => {
              switch (child.type) {
                case ConfigEditor.PageType:
                  return (<MenuPage {...menuProps} overrideName={undefined} hasUnsavedChanges={false} key={child.key} page={child} />);
                case ConfigEditor.PageGroupType:
                  return (<MenuPageGroup {...menuProps} key={child.key} pageGroup={child} />);
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
const MenuPage = withStyles(styles, { withTheme: true })(MenuPageWithoutStyle);

interface PropsPageGroup {
  key: string;
  pageGroup: ConfigEditor.PageGroup;
  activePath?: ConfigEditor.Path;
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
    const padding = paddingForLevel(1, this.props.pageGroup.path);
    const { classes, ...menuProps } = this.props;
    return (
      <Collapse in={childPages.length > 0} timeout="auto" unmountOnExit>
        <div>
          <ListItem disabled>
            <ListItemText
              style={padding}
              primary={this.props.pageGroup.name} />
          </ListItem>
          {childPages.map(childPage =>
            <MenuPage {...menuProps} key={childPage.key} offset={1} page={childPage} />
          )}
        </div>
      </Collapse>
    );
  }
}
const MenuPageGroup = withStyles(styles, { withTheme: true })(MenuPageGroupWithoutStyle);
