import { Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import { ReduxState, Server, Status } from '../../api/server';
import { notEmpty } from '../../common/util/arrayUtil';
import { buttonHover, buttonSelected } from '../../common/util/cssUtil';
import keyMapper from '../../common/util/keyMapper';
import ErrorMsg from '../ErrorMsg';
import Loading from '../utils/Loading';
import { MaxContentWidth, PostClassification, PostDescription, PostTitle } from './Post';

const styles = (theme: Theme) => createStyles({
  itemMargin: {
    padding: theme.spacing(
      // Taken from PostList.tsx
      2 // widthExpandMarginSupplied
      // Taken from Post.tsx
      + 0.5 // titleAndDescription
      + 1 // postContent
    ),
  },
  nothing: {
    color: theme.palette.text.secondary,
    width: '100%',
    maxWidth: 350,
  },
  draftContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: MaxContentWidth,
    maxWidth: '100%',
    ...buttonHover(theme),
  },
  draftSelected: {
    ...buttonSelected(theme),
  },
  draftBottomBar: {
    display: 'flex',
    alignItems: 'center',
  },
  clickable: {
    cursor: 'pointer',
    textDecoration: 'none',
  },
});
const useStyles = makeStyles(styles);
interface Props {
  server: Server;
  filterCategoryId?: string;
  hideIfEmpty?: boolean;
  onClickDraft?: (draftId: string) => void,
  selectedDraftId?: string;
}
interface ConnectProps {
  searchStatus?: Status;
  searchDrafts?: Admin.IdeaDraftAdmin[];
  searchCursor?: string,
}
class PanelDraft extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  constructor(props) {
    super(props);

    if (!props.searchStatus) {
      props.server.dispatchAdmin().then(d => d.ideaDraftSearchAdmin({
        projectId: props.server.getProjectId(),
        filterCategoryId: props.filterCategoryId,
      }));
    }
  }

  render() {
    var content;
    switch (this.props.searchStatus || Status.PENDING) {
      default:
      case Status.REJECTED:
        content = (
          <ErrorMsg msg='Failed to load drafts' />
        );
        break;
      case Status.PENDING:
        if (this.props.hideIfEmpty) return null;
        content = (
          <Loading />
        );
        break;
      case Status.FULFILLED:
        if (this.props.hideIfEmpty && !this.props.searchDrafts?.length) return null;
        if (!this.props.searchDrafts?.length) {
          content = (
            <Typography variant='overline' className={classNames(this.props.classes.nothing, this.props.classes.itemMargin)}>Nothing found</Typography>
          )
        } else {
          content = this.props.searchDrafts.map(draft => (
            <DraftItem
              className={classNames(
                this.props.selectedDraftId === draft.draftId && this.props.classes.draftSelected,
              )}
              key={draft && draft.draftId}
              server={this.props.server}
              draft={draft}
              onClick={!this.props.onClickDraft ? undefined : () => this.props.onClickDraft?.(draft.draftId)}
            />
          ));
        }
        break;
    }
    return content;
  }
}

export const DraftItem = (props: {
  className: string;
  server: Server;
  draft: Admin.IdeaDraftAdmin;
  titleTruncateLines?: number;
  descriptionTruncateLines?: number;
  onClick?: () => void;
}) => {
  const classes = useStyles();
  const titleTruncateLines = props.titleTruncateLines !== undefined ? props.titleTruncateLines : undefined;
  const descriptionTruncateLines = props.descriptionTruncateLines !== undefined ? props.descriptionTruncateLines : 3;
  return (
    <div
      className={classNames(
        classes.draftContainer,
        classes.itemMargin,
        !!props.onClick && classes.clickable,
      )}
      onClick={!props.onClick ? undefined : () => props.onClick?.()}
    >
      <PostTitle
        variant='list'
        title={props.draft.title}
        titleTruncateLines={titleTruncateLines}
        descriptionTruncateLines={descriptionTruncateLines}
      />
      <PostDescription
        variant='list'
        description={props.draft.description}
        descriptionTruncateLines={descriptionTruncateLines}
      />
      <div className={classes.draftBottomBar}>
        <PostClassification title='Draft' />
      </div>
    </div>
  );
}

export default keyMapper(
  (ownProps: Props) => ownProps.filterCategoryId || 'empty',
  connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
    const searchKey = ownProps.filterCategoryId || '';
    const bySearch = state.drafts.bySearch[searchKey];
    var connectProps: ConnectProps = {
      searchStatus: bySearch?.status,
      searchDrafts: bySearch?.draftIds?.map(draftId => state.drafts.byId[draftId]?.draft).filter(notEmpty),
      searchCursor: bySearch?.cursor,
    };
    return connectProps;
  })(withStyles(styles, { withTheme: true })(PanelDraft)));
