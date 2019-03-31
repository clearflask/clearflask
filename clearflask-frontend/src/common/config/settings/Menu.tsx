import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { ListItem, ListItemIcon, ListItemText } from '@material-ui/core';
import Collapse from '@material-ui/core/Collapse';
import List, { ListProps } from '@material-ui/core/List';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import ListSubheader from '@material-ui/core/ListSubheader';

interface Props extends ListProps {
  page:ConfigEditor.Page;
  level?:number;
  pageClicked:(page:ConfigEditor.Page|ConfigEditor.PageGroup)=>void;
}

interface State {
  expanded:{[groupKey:string]:boolean};
}

export default class Menu extends Component<Props, State> {
  readonly paddingPerLevel = 10;

  constructor(props:Props) {
    super(props);

    this.state = {
      expanded: {},
    };
  }

  render() {
    var childPages:ConfigEditor.Page[] = this.props.page.getChildren().pages;
    var childPageGroups:ConfigEditor.PageGroup[] = this.props.page.getChildren().groups;

    return (
      <List
        component='nav'
        {...this.props}
      >
        <ListItem button onClick={() => {
          this.props.pageClicked(this.props.page);
        }}>
          <ListItemText style={this.paddingForLevel(this.props.level)} primary={this.props.page.name} />
        </ListItem>
        {this.renderPages(childPages, (this.props.level || 0) + 1)}
        {childPageGroups.map(childPageGroup => {
          const key = childPageGroup.path.join('.');
          const grandChildPages = childPageGroup.getChildPages();
          return [
            <ListItem button onClick={() => {
              this.setState({expanded: {
                ...this.state.expanded,
                [key]: !this.state.expanded[key],
              }});
              this.props.pageClicked(childPageGroup);
            }}>
              <ListItemText style={this.paddingForLevel(this.props.level, 1)} primary={childPageGroup.name}/>
              {(grandChildPages.length > 0 || grandChildPages.length > 0)
                && (this.state.expanded ? <ExpandLess /> : <ExpandMore />)}
            </ListItem>,
            <Collapse in={this.state.expanded[key]} timeout="auto" unmountOnExit>
              <div>
                {this.renderPages(childPageGroup.getChildPages(), (this.props.level || 0) + 2)}
              </div>
            </Collapse>,
          ];
        })}
      </List>
    );
  }

  renderPages(childPages:ConfigEditor.Page[], level?:number) {
    return childPages.map(childPage =>
      <Menu
        level={level}
        page={childPage}
        pageClicked={this.props.pageClicked}
        // TODO component='div'
        disablePadding
      />
    );
  }

  paddingForLevel(currentLevel?:number, addLevel?:number):React.CSSProperties {
    const level = (currentLevel || 0) + (addLevel || 0);
    return { paddingLeft: (level * this.paddingPerLevel) + 'px' };
  }
}
