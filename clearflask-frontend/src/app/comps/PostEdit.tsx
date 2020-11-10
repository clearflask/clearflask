import { Button, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Grid, Switch, TextField } from '@material-ui/core';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Client from '../../api/client';
import { Server } from '../../api/server';
import CreditView from '../../common/config/CreditView';
import RichEditor from '../../common/RichEditor';
import SubmitButton from '../../common/SubmitButton';
import notEmpty from '../../common/util/arrayUtil';
import { WithMediaQuery, withMediaQuery } from '../../common/util/MediaQuery';
import SelectionPicker, { ColorLookup, Label } from './SelectionPicker';
import TagSelect from './TagSelect';

const styles = (theme: Theme) => createStyles({
  row: {
    margin: theme.spacing(2),
  }
});

interface Props {
  server: Server;
  category: Client.Category;
  credits?: Client.Credits;
  loggedInUser?: Client.User;
  idea: Client.Idea;
  open?: boolean;
  onClose: () => void;
}
interface State {
  deleteDialogOpen?: boolean;
  isSubmitting?: boolean;
  title?: string;
  description?: string;
  response?: string;
  statusId?: string;
  tagIds?: string[];
  tagIdsHasError?: boolean;
  fundGoal?: string;
  suppressNotifications?: boolean;
}
class PostEdit extends Component<Props & WithMediaQuery & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    const isModLoggedIn = this.props.server.isModLoggedIn();
    const fundGoalHasError = this.state.fundGoal !== undefined && (!parseInt(this.state.fundGoal) || !+this.state.fundGoal || parseInt(this.state.fundGoal) !== parseFloat(this.state.fundGoal));
    const canSubmit = (
      this.state.tagIdsHasError !== true
      && !fundGoalHasError
      && (this.state.title !== undefined
        || this.state.description !== undefined
        || this.state.response !== undefined
        || this.state.statusId !== undefined
        || this.state.tagIds !== undefined
        || this.state.fundGoal !== undefined)
    );
    const notifyReasons = [
      this.state.statusId !== undefined ? 'status' : undefined,
      this.state.response !== undefined ? 'response' : undefined,
    ].filter(notEmpty).join(' and ') || undefined;
    const nextStatusValues: Label[] = [];
    const nextStatusOptions: Label[] = [];
    const nextStatusColorLookup: ColorLookup = {};
    if (isModLoggedIn) {
      const status: Client.IdeaStatus | undefined = this.props.idea.statusId ? this.props.category.workflow.statuses.find(s => s.statusId === this.props.idea.statusId) : undefined;
      const nextStatusIds: Set<string> | undefined = new Set(status?.nextStatusIds);
      if (nextStatusIds && nextStatusIds.size > 0) {
        const nextStatuses: Client.IdeaStatus[] | undefined = status ? this.props.category.workflow.statuses.filter(s => nextStatusIds.has(s.statusId)) : undefined;
        nextStatuses && nextStatuses.forEach(s => {
          const label = { label: s.name, value: s.statusId };
          nextStatusOptions.push(label);
          if (s.color) {
            nextStatusColorLookup[s.statusId] = s.color;
          }
          if (this.state.statusId === s.statusId) {
            nextStatusValues.push(label);
          }
        });
      }
    }

    return (
      <React.Fragment>
        <Dialog
          open={this.props.open || false}
          onClose={this.props.onClose.bind(this)}
          scroll='body'
          fullScreen={this.props.mediaQuery}
          fullWidth
        >
          <DialogTitle>Edit post</DialogTitle>
          <DialogContent>
            <Grid container alignItems='baseline'>
              {isModLoggedIn && (
                <React.Fragment>
                  {(nextStatusOptions && nextStatusOptions.length > 0) && (
                    <Grid item xs={12} className={this.props.classes.row}>
                      <SelectionPicker
                        disabled={this.state.isSubmitting}
                        width='100%'
                        label='Status'
                        showClearWithOneValue
                        value={nextStatusValues}
                        options={nextStatusOptions}
                        colorLookup={nextStatusColorLookup}
                        onValueChange={(labels, action) => this.setState({ statusId: labels.length > 0 ? labels[0].value || undefined : undefined })}
                      />
                    </Grid>
                  )}
                  {this.props.category.tagging.tags.length > 0 && (
                    <Grid item xs={12} className={this.props.classes.row}>
                      <TagSelect
                        label='Tags'
                        disabled={this.state.isSubmitting}
                        category={this.props.category}
                        tagIds={this.state.tagIds === undefined ? this.props.idea.tagIds : this.state.tagIds}
                        onChange={tagIds => this.setState({ tagIds: tagIds })}
                        onErrorChange={hasError => this.setState({ tagIdsHasError: hasError })}
                      />
                    </Grid>
                  )}
                  {!!this.props.category.support.fund && this.props.credits && (
                    <Grid item xs={12} className={this.props.classes.row}>
                      <TextField
                        variant='outlined'
                        disabled={this.state.isSubmitting}
                        label='Funding Goal'
                        fullWidth
                        value={this.state.fundGoal === undefined ? this.props.idea.fundGoal || 0 : this.state.fundGoal}
                        type='number'
                        inputProps={{
                          step: 1,
                        }}
                        error={fundGoalHasError}
                        helperText={fundGoalHasError ? 'Invalid value' : (
                          (this.state.fundGoal === undefined && this.props.idea.fundGoal === undefined) ? undefined : (
                            <CreditView
                              val={this.state.fundGoal === undefined ? this.props.idea.fundGoal || 0 : +this.state.fundGoal}
                              credits={this.props.credits}
                            />
                          ))}
                        onChange={e => this.setState({ fundGoal: e.target.value })}
                      />
                    </Grid>
                  )}
                </React.Fragment>
              )}
              <Grid item xs={12} className={this.props.classes.row}>
                <TextField
                  variant='outlined'
                  disabled={this.state.isSubmitting}
                  label='Title'
                  fullWidth
                  value={this.state.title === undefined ? this.props.idea.title : this.state.title}
                  onChange={e => this.setState({ title: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} className={this.props.classes.row}>
                <RichEditor
                  variant='outlined'
                  disabled={this.state.isSubmitting}
                  label='Description'
                  fullWidth
                  value={this.state.description === undefined ? this.props.idea.description : this.state.description}
                  onChange={e => this.setState({ description: e.target.value })}
                  multiline
                  rows={1}
                  rowsMax={15}
                />
              </Grid>
              {isModLoggedIn && (
                <React.Fragment>
                  <Grid item xs={12} className={this.props.classes.row}>
                    <RichEditor
                      variant='outlined'
                      disabled={this.state.isSubmitting}
                      label='Response'
                      fullWidth
                      value={this.state.response === undefined ? this.props.idea.response : this.state.response}
                      onChange={e => this.setState({ response: e.target.value })}
                      multiline
                      rows={1}
                      rowsMax={3}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Collapse in={!!notifyReasons}>
                      <FormControlLabel
                        className={this.props.classes.row}
                        disabled={this.state.isSubmitting}
                        control={(
                          <Switch
                            checked={!this.state.suppressNotifications}
                            onChange={(e, checked) => this.setState({ suppressNotifications: !checked })}
                            color='primary'
                          />
                        )}
                        label={`Notify subscribers of ${notifyReasons}`}
                      />
                    </Collapse>
                  </Grid>
                </React.Fragment>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.props.onClose()}>Close</Button>
            <SubmitButton
              isSubmitting={this.state.isSubmitting}
              style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
              onClick={() => this.setState({ deleteDialogOpen: true })}
            >Delete</SubmitButton>
            <SubmitButton color='primary' isSubmitting={this.state.isSubmitting} disabled={!canSubmit} onClick={() => {
              this.setState({ isSubmitting: true });
              (isModLoggedIn
                ? this.props.server.dispatchAdmin().then(d => d.ideaUpdateAdmin({
                  projectId: this.props.server.getProjectId(),
                  ideaId: this.props.idea.ideaId,
                  ideaUpdateAdmin: {
                    title: this.state.title,
                    description: this.state.description,
                    response: this.state.response,
                    statusId: this.state.statusId,
                    tagIds: this.state.tagIds,
                    fundGoal: this.state.fundGoal === undefined ? undefined : +this.state.fundGoal,
                    suppressNotifications: this.state.suppressNotifications,
                  },
                }))
                : this.props.server.dispatch().ideaUpdate({
                  projectId: this.props.server.getProjectId(),
                  ideaId: this.props.idea.ideaId,
                  ideaUpdate: {
                    title: this.state.title,
                    description: this.state.description,
                  },
                }))
                .then(idea => {
                  this.setState({
                    isSubmitting: false,
                    title: undefined,
                    description: undefined,
                    response: undefined,
                    statusId: undefined,
                    tagIds: undefined,
                    fundGoal: undefined,
                    suppressNotifications: undefined,
                  });
                  this.props.onClose();
                })
                .catch(e => this.setState({ isSubmitting: false }))
            }}>Save</SubmitButton>
          </DialogActions>
        </Dialog>
        <Dialog
          open={!!this.state.deleteDialogOpen && !!this.props.open}
          onClose={() => this.setState({ deleteDialogOpen: false })}
        >
          <DialogTitle>Delete Post</DialogTitle>
          <DialogContent>
            <DialogContentText>Are you sure you want to permanently delete this post?</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ deleteDialogOpen: false })}>Cancel</Button>
            <SubmitButton
              isSubmitting={this.state.isSubmitting}
              style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
              onClick={() => {
                this.setState({ isSubmitting: true });
                (isModLoggedIn
                  ? this.props.server.dispatchAdmin().then(d => d.ideaDeleteAdmin({
                    projectId: this.props.server.getProjectId(),
                    ideaId: this.props.idea.ideaId,
                  }))
                  : this.props.server.dispatch().ideaDelete({
                    projectId: this.props.server.getProjectId(),
                    ideaId: this.props.idea.ideaId,
                  }))
                  .then(() => {
                    this.setState({
                      isSubmitting: false,
                      deleteDialogOpen: false,
                    });
                    this.props.onClose();
                  })
                  .catch(e => this.setState({ isSubmitting: false }))
              }}>Delete</SubmitButton>
          </DialogActions>
        </Dialog>
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(
  withMediaQuery(theme => theme.breakpoints.down('xs'))(PostEdit));
