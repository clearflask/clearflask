import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';
import { connect } from 'react-redux';
import * as Admin from '../../api/admin';
import { ReduxState } from '../../api/server';
import FilterControls, { FilterControlSelect } from './FilterControls';
import { UserLabels, userSearchToLabels } from './searchUtil';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  search?: Partial<Admin.UserSearchAdmin>;
  onSearchChanged: (search: Partial<Admin.UserSearchAdmin>) => void;
}
interface ConnectProps {
  creditsEnabled?: boolean;
}
class PostFilterControls extends React.Component<Props & ConnectProps & WithStyles<typeof styles, true>> {
  render() {
    const labels: UserLabels = userSearchToLabels(this.props.search);

    return (
      <FilterControls>
        <FilterControlSelect
          type='radio'
          name='Sort'
          labels={[
            { label: 'Newest', value: sortByAndOrderEncode(Admin.UserSearchAdminSortByEnum.Created, Admin.UserSearchAdminSortOrderEnum.Desc) },
            { label: 'Oldest', value: sortByAndOrderEncode(Admin.UserSearchAdminSortByEnum.Created, Admin.UserSearchAdminSortOrderEnum.Asc) },
            ...(this.props.creditsEnabled ? [{ label: 'Balance', value: sortByAndOrderEncode(Admin.UserSearchAdminSortByEnum.FundsAvailable, Admin.UserSearchAdminSortOrderEnum.Desc) }] : []),
          ]}
          selected={this.props.search?.sortBy && this.props.search?.sortOrder
            ? sortByAndOrderEncode(this.props.search?.sortBy, this.props.search?.sortOrder) : undefined}
          onToggle={value => {
            const { sortBy, sortOrder } = sortByAndOrderDecode(value);
            return this.props.onSearchChanged({
              ...this.props.search,
              sortBy,
              sortOrder,
            });
          }}
        />
        <FilterControlSelect
          type='check'
          name='Moderator'
          labels={[
            { label: 'Show only', value: 'true' },
          ]}
          selected={this.props.search?.isMod ? 'true' : 'false'}
          onToggle={value => {
            const { sortBy, sortOrder } = sortByAndOrderDecode(value);
            return this.props.onSearchChanged({
              ...this.props.search,
              isMod: this.props.search?.isMod ? undefined : true,
            });
          }}
        />
      </FilterControls>
    );
  }
}

const sortByAndOrderEncode = (sortBy: Admin.UserSearchAdminSortByEnum, sortOrder: Admin.UserSearchAdminSortOrderEnum) => {
  return `${sortBy}:${sortOrder}`;
};
const sortByAndOrderDecode = (value: string): { sortBy: Admin.UserSearchAdminSortByEnum, sortOrder: Admin.UserSearchAdminSortOrderEnum } => {
  const [sortBy, sortOrder] = value.split(':');
  return {
    sortBy: sortBy as Admin.UserSearchAdminSortByEnum,
    sortOrder: sortOrder as Admin.UserSearchAdminSortOrderEnum,
  };
};

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const newProps: ConnectProps = {
    creditsEnabled: !!state.conf.conf?.users.credits,
  };
  return newProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(PostFilterControls));
