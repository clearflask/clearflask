import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { ListItem, ListItemIcon, ListItemText, ListSubheader, Divider } from '@material-ui/core';
import Collapse from '@material-ui/core/Collapse';
import List, { ListProps } from '@material-ui/core/List';

export interface MenuHeading {
  type: 'heading';
  text: string;
  offset?: number;
}

export interface MenuItem {
  type: 'item';
  name: string|React.ReactNode;
  slug?: string;
  onClick?: ()=>void;
  offset?: number;
}

export interface MenuProject {
  type: 'project';
  projectId: string;
  page: ConfigEditor.Page;
}

interface Props extends ListProps {
  items:(MenuProject|MenuItem|MenuHeading)[];
  activePath: string;
  activeSubPath: ConfigEditor.Path;
  pageClicked:(path:string, subPath?:ConfigEditor.Path)=>void;
}

export default class Menu extends Component<Props> {
  render() {
    return (
      <List dense component='nav' style={{padding: '0px'}}>
        {this.props.items.map(item => {
          if(item.type === 'item') {
            return (
              <ListItem selected={item.slug === this.props.activePath} button onClick={() => {
                if(item.onClick) {
                  item.onClick();
                }
                if(item.slug !== undefined) {
                  this.props.pageClicked(item.slug);
                }
              }}>
                <ListItemText style={Menu.paddingForLevel(item.offset)} primary={item.name} />
              </ListItem>
            );
          } else if(item.type === 'project') {
            return (
              <MenuPage
                key={item.page.key}
                page={item.page}
                activePath={item.projectId === this.props.activePath ? this.props.activeSubPath : undefined}
                pageClicked={path => this.props.pageClicked(item.projectId, path)}
              />
            );
          } else if(item.type === 'heading') {
            return (
              <ListItem disabled>
                <ListItemText style={Menu.paddingForLevel(item.offset)} primary={item.text} />
              </ListItem>
            );
          } else {
            return null;
          }
        })}
      </List>
    );
  }

  static paddingForLevel(offset:number = 0, path:ConfigEditor.Path = []):React.CSSProperties|undefined {
    const paddingLevel = path.length + offset;
    return paddingLevel === 0 ? undefined : { paddingLeft: paddingLevel * 10 };
  }
}

interface PropsPage {
  key:string;
  page:ConfigEditor.Page;
  activePath?:ConfigEditor.Path;
  pageClicked:(path:ConfigEditor.Path)=>void;
}

class MenuPage extends Component<PropsPage> {
  unsubscribe?:()=>void;

  componentDidMount() {
    this.unsubscribe = this.props.page.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const expanded = this.isExpanded(this.props.page.path);
    return (
      <Collapse in={this.props.page.required || this.props.page.value === true} timeout="auto" unmountOnExit>
        <ListItem selected={this.isSelected(this.props.page.path)} button onClick={() => {
          this.props.pageClicked(this.props.page.path);
        }}>
          <ListItemText style={Menu.paddingForLevel(1, this.props.page.path)} primary={this.props.page.getDynamicName()} />
        </ListItem>
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          {this.props.page.getChildren().all
            .map(child => {
              switch(child.type) {
                case ConfigEditor.PageType:
                  return ( <MenuPage {...this.props} key={child.key} page={child} /> );
                case ConfigEditor.PageGroupType:
                  return ( <MenuPageGroup {...this.props} key={child.key} pageGroup={child} /> );
                default:
                  return null;
              }
          })}
        </Collapse>
      </Collapse>
    );
  }

  isExpanded(path:ConfigEditor.Path):boolean {
    if(!this.props.activePath || this.props.activePath.length < path.length) {
      return false;
    }
    for (let i = 0; i < path.length; i++) {
      if(path[i] !== this.props.activePath[i]) {
        return false;
      }
    }
    return true;
  }

  isSelected(path:ConfigEditor.Path) {
    if(!this.props.activePath || this.props.activePath.length !== path.length) {
      return false;
    }
    for (let i = 0; i < path.length; i++) {
      if(path[i] !== this.props.activePath[i]) {
        return false;
      }
    }
    return true;
  }
}

interface PropsPageGroup {
  key:string;
  pageGroup:ConfigEditor.PageGroup;
  activePath?:ConfigEditor.Path;
  pageClicked:(path:ConfigEditor.Path)=>void;
}

class MenuPageGroup extends Component<PropsPageGroup> {
  unsubscribe?:()=>void;

  componentDidMount() {
    this.unsubscribe = this.props.pageGroup.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const childPages = this.props.pageGroup.getChildPages();
    return (
      <Collapse in={childPages.length > 0} timeout="auto" unmountOnExit>
        <div>
          <ListItem disabled>
            <ListItemText
              style={Menu.paddingForLevel(1, this.props.pageGroup.path)}
              primary={this.props.pageGroup.name} />
          </ListItem>
          {childPages.map(childPage =>
            <MenuPage {...this.props} key={childPage.key} page={childPage} />
          )}
        </div>
      </Collapse>
    );
  }
}
