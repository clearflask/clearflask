import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { ListItem, ListItemIcon, ListItemText, ListSubheader } from '@material-ui/core';
import Collapse from '@material-ui/core/Collapse';
import List, { ListProps } from '@material-ui/core/List';

interface Props extends ListProps {
  page:ConfigEditor.Page;
  activePath:ConfigEditor.Path;
  pageClicked:(path:ConfigEditor.Path)=>void;
}

export default class Menu extends Component<Props> {
  unsubscribe?:()=>void;

  componentDidMount() {
    this.unsubscribe = this.props.page.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const childPages:ConfigEditor.Page[] = this.props.page.getChildren().pages;
    const childPageGroups:ConfigEditor.PageGroup[] = this.props.page.getChildren().groups;
    const expanded = this.isExpanded(this.props.page.path);
    return (
      <List component='nav' style={{padding: '0px'}}>
        <ListItem button onClick={() => {
          this.props.pageClicked(this.props.page.path);
        }}>
          <ListItemText style={Menu.paddingForLevel(this.props.page.path)} primary={this.props.page.getDynamicName()} />
        </ListItem>
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          {childPages.map(childPage =>
            <Menu {...this.props} page={childPage} />
          )}
          {childPageGroups.map(childPageGroup => (
            <MenuPageGroup {...this.props} pageGroup={childPageGroup} />
          ))}
        </Collapse>
      </List>
    );
  }

  isExpanded(path:ConfigEditor.Path):boolean {
    if(this.props.activePath.length < path.length) {
      return false;
    }
    for (let i = 0; i < path.length; i++) {
      if(path[i] !== this.props.activePath[i]) {
        return false;
      }
    }
    return true;
  }

  static paddingForLevel(path:ConfigEditor.Path, offset:number = 0):React.CSSProperties {
    return { paddingLeft: ((path.length + offset) * 10) + 'px' };
  }
}

interface PropsPageGroup extends ListProps {
  pageGroup:ConfigEditor.PageGroup;
  activePath:ConfigEditor.Path;
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
              style={Menu.paddingForLevel(this.props.pageGroup.path, 0.5)}
              primary={this.props.pageGroup.name} />
          </ListItem>
          {childPages.map(childPage =>
            <Menu {...this.props} page={childPage} />
          )}
        </div>
      </Collapse>
    );
  }
}
