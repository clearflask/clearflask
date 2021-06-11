import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import FilterControls, { FilterControlDateRange, FilterControlSelect } from './FilterControls';
import { groupLabels, LabelGroup, PostLabels, postLabelsToSearch, postSearchToLabels } from './searchUtil';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  className?: string;
  config?: Client.Config,
  explorer?: Client.PageExplorer,
  search?: Partial<Admin.IdeaSearchAdmin>;
  onSearchChanged: (search: Partial<Admin.IdeaSearchAdmin>) => void;
  forceSingleCategory?: boolean;
  sortGroups?: (a: LabelGroup, b: LabelGroup) => number;
}
class PostFilterControls extends React.Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const labels: PostLabels = postSearchToLabels(
      this.props.config,
      this.props.explorer,
      this.props.search as Client.IdeaSearch,
      this.props.forceSingleCategory);
    const from = this.props.search?.filterCreatedStart;
    const to = this.props.search?.filterCreatedEnd;

    const optionsGrouped = groupLabels(
      labels.options,
      this.props.forceSingleCategory);
    const checkedValues = new Set(labels.values.map(label => label.value));
    if (!this.props.search?.sortBy) checkedValues.add(Client.IdeaSearchSortByEnum.Trending);

    if (this.props.sortGroups) {
      optionsGrouped.sort(this.props.sortGroups);
    }

    return (
      <FilterControls className={this.props.className}>
        {optionsGrouped.filter(group => group.controlType !== 'search').map(group => (
          <FilterControlSelect
            type={group.controlType as any}
            name={group.groupName}
            labels={group.labels}
            selected={checkedValues}
            onToggle={value => {
              var newLabels;
              if (checkedValues.has(value)) {
                newLabels = [...checkedValues].filter(l => l !== value);
              } else {
                newLabels = [...checkedValues, value];
              }

              const newSearch: Admin.IdeaSearchAdmin = postLabelsToSearch(newLabels, this.props.forceSingleCategory) as Admin.IdeaSearchAdmin;
              newSearch.filterCreatedStart = from;
              newSearch.filterCreatedEnd = to;
              this.props.onSearchChanged(newSearch);
            }}
          />
        ))}
        <FilterControlDateRange
          valueFrom={this.props.search?.filterCreatedStart}
          valueTo={this.props.search?.filterCreatedEnd}
          onFromChanged={val => this.props.onSearchChanged({
            ...this.props.search,
            filterCreatedStart: val,
          })}
          onToChanged={val => this.props.onSearchChanged({
            ...this.props.search,
            filterCreatedEnd: val,
          })}
        />
      </FilterControls>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PostFilterControls);
