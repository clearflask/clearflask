import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { ListItem, ListItemIcon, ListItemText } from '@material-ui/core';
import Collapse from '@material-ui/core/Collapse';
import List, { ListProps } from '@material-ui/core/List';

interface Props extends ListProps {
  activePath:ConfigEditor.Path;
  page:ConfigEditor.Page;
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
    const expanded = Menu.isExpanded(this.props.activePath, this.props.page.path);
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

  static isExpanded(activePath:ConfigEditor.Path, path:ConfigEditor.Path):boolean {
    if(activePath.length < path.length) {
      return false;
    }
    for (let i = 0; i < path.length; i++) {
      if(path[i] !== activePath[i]) {
        return false;
      }
    }
    return true;
  }

  static paddingForLevel(path:ConfigEditor.Path):React.CSSProperties {
    return { paddingLeft: (path.length * 10) + 'px' };
  }
}

interface PropsPageGroup extends ListProps {
  activePath:ConfigEditor.Path;
  pageGroup:ConfigEditor.PageGroup;
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
    const pageGroupExpanded = Menu.isExpanded(this.props.activePath, this.props.pageGroup.path);
    return [
      <ListItem button onClick={() => {
        this.props.pageClicked(this.props.pageGroup.path);
      }}>
        <ListItemText style={Menu.paddingForLevel(this.props.pageGroup.path)} primary={this.props.pageGroup.name}/>
      </ListItem>,
      <Collapse in={pageGroupExpanded} timeout="auto" unmountOnExit>
        <div>
          {this.props.pageGroup.getChildPages().map(childPage =>
            <Menu {...this.props} page={childPage} />
          )}
        </div>
      </Collapse>,
    ];
  }
}
