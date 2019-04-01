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
  readonly paddingPerLevel = 10;

  constructor(props:Props) {
    super(props);

    this.state = {
      expanded: {},
    };
  }

  render() {
    const childPages:ConfigEditor.Page[] = this.props.page.getChildren().pages;
    const childPageGroups:ConfigEditor.PageGroup[] = this.props.page.getChildren().groups;
    var name:any = this.props.page.name || 'Unnamed';
    if(this.props.page.nameFromProp) {
      const nameProp = this.props.page.getChildren().props.find(p => p.path[p.path.length - 1] === this.props.page.nameFromProp);
      if(nameProp && nameProp.value) {
        name = nameProp.value;
      }
    }
    const expanded = this.isExpanded(this.props.page.path);
    return (
      <List component='nav' style={{padding: '0px'}}>
        <ListItem button onClick={() => {
          this.props.pageClicked(this.props.page.path);
        }}>
          <ListItemText style={this.paddingForLevel(this.props.page.path)} primary={name} />
        </ListItem>
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          {childPages.map(childPage =>
            <Menu {...this.props} page={childPage} />
          )}
          {childPageGroups.map(childPageGroup => {
            const pageGroupExpanded = this.isExpanded(childPageGroup.path);
            return [
              <ListItem button onClick={() => {
                this.props.pageClicked(childPageGroup.path);
              }}>
                <ListItemText style={this.paddingForLevel(childPageGroup.path)} primary={childPageGroup.name}/>
              </ListItem>,
              <Collapse in={pageGroupExpanded} timeout="auto" unmountOnExit>
                <div>
                  {childPageGroup.getChildPages().map(childPage =>
                    <Menu {...this.props} page={childPage} />
                  )}
                </div>
              </Collapse>,
            ];
          })}
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

  paddingForLevel(path:ConfigEditor.Path):React.CSSProperties {
    return { paddingLeft: (path.length * this.paddingPerLevel) + 'px' };
  }
}
