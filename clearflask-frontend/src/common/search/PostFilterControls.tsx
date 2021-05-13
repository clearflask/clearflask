import MomentUtils from '@date-io/moment';
import { Checkbox, FormControlLabel, Radio, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CalendarIcon from '@material-ui/icons/Event';
import { KeyboardDatePicker, MuiPickersUtilsProvider } from '@material-ui/pickers';
import moment from 'moment';
import React from 'react';
import * as Admin from '../../api/admin';
import * as Client from '../../api/client';
import { GroupedLabels, groupLabels, PostLabels, postLabelsToSearch, postSearchToLabels } from './searchUtil';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing(2),
    minWidth: 'min-content',
  },
  group: {
    margin: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    minWidth: 'min-content',
  },
  label: {
    wordBreak: 'break-word',
  },
  datesVertical: {
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing(1, 0),
    '& input': {
      fontSize: '0.8em',
      width: 68,
    },
    '& > *:first-child': {
      marginBottom: theme.spacing(2),
    },
  },
  // datesHorizontal: {
  //   display: 'flex',
  //   margin: theme.spacing(1, 0),
  //   '& > *:first-child': {
  //     marginRight: theme.spacing(1),
  //   },
  //   '& > *:last-child': {
  //     marginLeft: theme.spacing(1),
  //   },
  //   '& > *': {
  //     width: 73,
  //   },
  //   '& input': {
  //     fontSize: '0.8em',
  //   },
  // },
  dateButtons: {
    marginTop: theme.spacing(1),
    columns: 'auto 2',
  },
  dateButton: {
    display: 'block',
    textTransform: 'unset',
    padding: 0,
  },
  dateIcon: {
    fontSize: '0.8em',
  },
});
interface Props {
  config?: Client.Config,
  explorer?: Client.PageExplorer,
  search?: Partial<Admin.IdeaSearchAdmin>;
  onSearchChanged: (search: Partial<Admin.IdeaSearchAdmin>) => void;
  forceSingleCategory?: boolean;
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

    const optionsGrouped: GroupedLabels = groupLabels(
      labels.options,
      this.props.forceSingleCategory);
    const checkedValues = new Set(labels.values.map(label => label.value));
    const toggleValue = value => {
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
    };

    // const prefilledDates: Array<{
    //   label: string,
    //   start?: Date,
    //   end?: Date,
    // }> = [
    //     { label: 'Today', start: moment().startOf('day').toDate(), end: moment().endOf('day').toDate() },
    //     { label: 'This week', start: moment().startOf('week').toDate(), end: moment().endOf('week').toDate() },
    //     { label: 'This month', start: moment().startOf('month').toDate(), end: moment().endOf('month').toDate() },
    //     { label: 'All time' },
    //     { label: 'Past week', start: moment().startOf('week').toDate(), end: moment().endOf('week').toDate() },
    //     { label: 'Past month', start: moment().startOf('month').toDate(), end: moment().endOf('month').toDate() },
    //   ];
    const range = (
      <MuiPickersUtilsProvider utils={MomentUtils} locale='en'>
        <div className={this.props.classes.group}>
          <Typography variant='subtitle1' component='div'>Range</Typography>
          <div className={this.props.classes.datesVertical}>
            {this.renderDatePicker('filterCreatedStart', 'From', from)}
            {this.renderDatePicker('filterCreatedEnd', 'To', to)}
          </div>
          {/* <div className={this.props.classes.dateButtons}>
          {prefilledDates.map((prefilledDate, index) => {
            const checked = prefilledDate.start?.getTime() === from?.getTime() && prefilledDate.end?.getTime() === to?.getTime();
            return (
              <Button
                key={`prefilledDate-${prefilledDate.label}`}
                className={this.props.classes.dateButton}
                variant='text'
                color={!!checked ? 'primary' : undefined}
                onClick={e => {
                  const newSearch: Admin.IdeaSearchAdmin = {
                    ...this.props.search,
                    filterCreatedStart: prefilledDate.start,
                    filterCreatedEnd: prefilledDate.end,
                  }
                  this.props.onSearchChanged(newSearch);
                }}
              >
                {prefilledDate.label}
              </Button>
            )
          })}
        </div> */}
        </div>
      </MuiPickersUtilsProvider>
    );

    const options = optionsGrouped.map(group => {
      const Control = group.controlType === 'check' ? Checkbox : Radio;
      return (
        <div
          key={`group-${group.groupName || 'noname'}`}
          className={this.props.classes.group}
        >
          <Typography variant='subtitle1' component='div'>{group.groupName}</Typography>
          {group.labels.map(label => (
            <FormControlLabel
              key={`label-${label.label}`}
              style={{ color: label.color }}
              label={(
                <Typography
                  variant='body2'
                  component='div'
                  className={this.props.classes.label}>
                  {label.label}
                </Typography>
              )}
              control={(
                <Control
                  size='small'
                  color='primary'
                  checked={!!checkedValues.has(label.value)
                    || (!this.props.search?.sortBy && label.label === Client.IdeaSearchSortByEnum.Trending)}
                  onChange={e => toggleValue(label.value)}
                />
              )}
            />
          ))}
        </div>
      );
    });

    return (
      <div className={this.props.classes.container}>
        {options}
        {range}
      </div>
    );
  }

  renderDatePicker(searchKey: string, name: string, val?: Date) {
    return (
      <KeyboardDatePicker
        shouldDisableDate={(date) => {
          if (!date) return true;
          if (date.isAfter(moment().endOf('day'))) return true;
          return false
        }}
        variant='inline'
        inputVariant='standard'
        size='small'
        views={['year', 'date']}
        format='YYYY/MM/DD'
        autoOk
        keyboardIcon={(
          <CalendarIcon className={this.props.classes.dateIcon} fontSize='inherit' />)}
        disableToolbar
        initialFocusedDate={new Date()}
        placeholder={name}
        value={val || null}
        onChange={val => {
          const newSearch: Admin.IdeaSearchAdmin = {
            ...this.props.search,
            [searchKey]: val?.toDate(),
          }
          this.props.onSearchChanged(newSearch);
        }}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(PostFilterControls);
