import React, { Component } from 'react';
import { Server, getSearchKey } from '../../api/server';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import * as Client from '../../api/client';
import Panel, { Direction } from './Panel';
import { Typography, TextField, Divider } from '@material-ui/core';
import DividerVertical from '../utils/DividerVertical';
import PanelSearch from './PanelSearch';
import DividerCorner from '../utils/DividerCorner';

enum FilterType {
  Search = 'search',
  Sort = 'sort',
  Category = 'category',
  Tag = 'tag',
  Status = 'status',
}

const styles = (theme:Theme) => createStyles({
  explorer: {
    margin: theme.spacing.unit,
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    gridTemplateRows: 'auto minmax(0, 1fr)',
    gridTemplateAreas:
      '". search"'
      + '"create results"',
  },
  search: {
    gridArea: 'search',
    margin: theme.spacing.unit * 2,
  },
  results: {
    gridArea: 'results',
  },
  resultsInner: {
    margin: theme.spacing.unit * 2,
  },
  create: {
    gridArea: 'create',
    margin: theme.spacing.unit,
  },
  createFormFields: {
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing.unit,
  },
  createFormField: {
    margin: theme.spacing.unit,
    width: '100px',
  },
  caption: {
    margin: theme.spacing.unit,
    color: theme.palette.text.hint,
  },
});

interface Props extends WithStyles<typeof styles, true> {
  server:Server;
  explorer:Client.PageExplorer;
}

interface State {
  createFormFocused?: boolean;
  newItemTitle?:string;
  newItemDescription?:string;
  search?:Partial<Client.IdeaSearch>;
}

class Explorer extends Component<Props, State> {
  readonly panelSearchRef:React.RefObject<any> = React.createRef();

  constructor(props:Props) {
    super(props);
    this.state = {};
  }

  render() {
    const createFormHasTypedIn = this.state.newItemTitle || this.state.newItemDescription;
    const createFormIsFocused = this.state.createFormFocused;
    var content, topBar;
    if(createFormHasTypedIn) {
      topBar = (
        <Typography variant='overline' className={this.props.classes.caption}>Similar:</Typography>
        );
      content = (
        <div>
          <Panel
            key={getSearchKey(this.props.explorer.panel.search)}
            direction={Direction.Vertical}
            panel={this.props.explorer.panel}
            searchOverride={{searchText: `${this.state.newItemTitle || ''} ${this.state.newItemDescription || ''}`}}
            server={this.props.server}
            displayDefaults={{
              titleTruncateLines: 1,
              descriptionTruncateLines: 2,
              showDescription: true,
              showCommentCount: false,
              showCategoryName: false,
              showCreated: false,
              showAuthor: false,
              showStatus: false,
              showTags: false,
              showVoting: false,
              showFunding: false,
              showExpression: false,
            }} />
        </div>
      );
    } else {
      topBar = (
        <PanelSearch
          innerRef={this.panelSearchRef}
          server={this.props.server}
          search={this.state.search}
          onSearchChanged={search => this.setState({search: search})}
          panel={this.props.explorer.panel}
        />
      );
      content = (
        <div>
          <Panel
            key={getSearchKey(this.props.explorer.panel.search)}
            server={this.props.server}
            direction={Direction.Vertical}
            panel={this.props.explorer.panel}
            displayDefaults={{
              titleTruncateLines: 1,
              descriptionTruncateLines: 2,
              showDescription: true,
              showCommentCount: true,
              showCreated: true,
              showAuthor: true,
              showVoting: true,
              showFunding: true,
              showExpression: true,
            }} 
            searchOverride={this.state.search}
            onClickTag={this.panelSearchRef.current && this.panelSearchRef.current.isFilterControllable(FilterType.Tag)
              ? tagId => this.panelSearchRef.current && this.panelSearchRef.current.onClickTag(tagId) : undefined}
            onClickStatus={this.panelSearchRef.current && this.panelSearchRef.current.isFilterControllable(FilterType.Status)
              ? statusId => this.panelSearchRef.current && this.panelSearchRef.current.onClickStatus(statusId) : undefined}
            onClickCategory={this.panelSearchRef.current && this.panelSearchRef.current.isFilterControllable(FilterType.Category)
              ? categoryId => this.panelSearchRef.current && this.panelSearchRef.current.onClickCategory(categoryId) : undefined}
          />
        </div>
      );
    }

    const create = (
      <div className={this.props.classes.create}>
        <Typography variant='overline' className={this.props.classes.caption}>Create</Typography>
        <div className={this.props.classes.createFormFields}>
          <TextField
            onFocus={e => this.setState({createFormFocused: true})}
            onBlur={e => this.setState({createFormFocused: false})}
            id='createTitle'
            className={this.props.classes.createFormField}
            placeholder='Title'
            value={this.state.newItemTitle}
            onChange={e => this.setState({newItemTitle: e.target.value})}
          />
          <TextField
            onFocus={e => this.setState({createFormFocused: true})}
            onBlur={e => this.setState({createFormFocused: false})}
            id='createDescription'
            className={this.props.classes.createFormField}
            placeholder='Description'
            value={this.state.newItemDescription}
            onChange={e => this.setState({newItemDescription: e.target.value})}
            multiline
          />
        </div>
    </div>
    );

    return (
      <div className={this.props.classes.explorer}>
        <div className={this.props.classes.search}>
          {topBar}
        </div>
        <div className={this.props.classes.create}>
          {create}
        </div>
        <div className={this.props.classes.results}>
          <DividerCorner width='160px' height='240px'>
            <div className={this.props.classes.resultsInner}>
              {content}
            </div>
          </DividerCorner>
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Explorer);
