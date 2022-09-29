// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Checkbox, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Table, TableBody, TableCell, TableHead, TableRow, TextField } from '@material-ui/core';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import UploadIcon from '@material-ui/icons/CloudUpload';
import FileIcon from '@material-ui/icons/InsertDriveFile';
import download from 'downloadjs';
import { withSnackbar, WithSnackbarProps } from 'notistack';
import React, { Component } from 'react';
import Dropzone from 'react-dropzone';
import { connect, Provider } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Admin from '../../../api/admin';
import { Server } from '../../../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../../../api/serverAdmin';
import { CategorySelectWithConnect } from '../../../app/comps/CategorySelect';
import SelectionPicker, { Label } from '../../../app/comps/SelectionPicker';
import { NeedHelpInviteTeammate, Section } from '../../../site/dashboard/ProjectSettings';
import UserSelection from '../../../site/dashboard/UserSelection';
import { contentScrollApplyStyles, Orientation } from '../../ContentScroll';
import SubmitButton from '../../SubmitButton';
import { csvPreviewLines } from '../../util/csvUtil';
import { getTimezoneOffsetInMin } from '../../util/dateUtil';
import { downloadBlobFile } from '../../util/fileUtil';
import { getProjectName } from '../../util/projectUtil';

const PreviewLines = 6;

const styles = (theme: Theme) => createStyles({
  container: {
    marginTop: 46,
  },
  exportCheckboxes: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  importSelectionRow: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  importCollapsed: {
    marginLeft: theme.spacing(2),
  },
  uploadIcon: {
    marginRight: theme.spacing(2),
  },
  tableContainer: {
    width: 'max-content',
    whiteSpace: 'nowrap',
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Horizontal }),
  },
  omitBorder: {
    border: 'none',
  },
  importProperty: {
    margin: theme.spacing(2, 2, 2, 0),
  },
  dropzone: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: theme.spacing(1),
    padding: theme.spacing(2),
    width: theme.spacing(30),
    color: theme.palette.text.hint,
    textAlign: 'center',
    borderStyle: 'dashed',
    borderColor: theme.palette.text.hint,
    borderWidth: 2,
    borderRadius: 6,
    outline: 'none',
    transition: theme.transitions.create(['border', 'color']),
    '&:hover': {
      color: theme.palette.text.primary,
      borderColor: theme.palette.text.primary,
    },
  },
  importDataHeaderRow: {
    fontWeight: 'bold',
  },
  indexSelection: {
    marginBottom: -7,
  },
});

interface Props {
  server: Server;
}
interface ConnectProps {
  account?: Admin.AccountAdmin;
}
interface State {
  importIsSubmitting?: boolean;
  importFile?: {
    file: File,
    preview: string[][],
  };
  importFirstRowIsHeader?: boolean;
  importCategoryId?: string;
  importAuthorUserId?: string;
  importIndexTitle?: number;
  importIndexDescription?: number;
  importIndexStatusId?: number;
  importIndexStatusName?: number;
  importIndexTagIds?: number;
  importIndexTagNames?: number;
  importIndexVoteValue?: number;
  importIndexDateTime?: number;
  tzOffInMin?: number;
  exportIsSubmitting?: boolean;
  exportIncludePosts?: boolean;
  exportIncludeUsers?: boolean;
  exportIncludeComments?: boolean;
  deleteIsSubmitting?: boolean;
  deleteDialogOpen?: boolean;
}
class DataSettings extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & WithSnackbarProps & RouteComponentProps, State> {
  state: State = {};
  unsubscribe?: () => void;

  componentDidMount() {
    this.unsubscribe = this.props.server.getStore().subscribe(() => this.forceUpdate());
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const projectName = getProjectName(this.props.server.getStore().getState().conf.conf);
    const DropzoneIcon = this.state.importFile ? FileIcon : UploadIcon;
    return (
      <div>
        <Section title='Import data'
          description={(
            <>
              Import posts into this project from another provider by uploading a Comma-Separated Value (CSV) file and then choose a mapping of your columns.
              <p>
                <Button
                  onClick={e => downloadBlobFile('clearflask-import-template.csv',
                    new Blob([
                      new Uint8Array([0xEF, 0xBB, 0xBF]), // UTF-8 BOM
                      'Created,Title,Description\n'
                      + '2019-04-01 00:00,First post,This is my first post\n'
                      + '2021-10-05 00:00,Second post,This is my second post\n',
                    ], { type: 'text/csv' }))}
                >Download template</Button>
              </p>
            </>
          )}
          preview={(
            <>
              <Dropzone
                minSize={1}
                onDrop={async (acceptedFiles, rejectedFiles, e) => {
                  rejectedFiles.forEach(rejectedFile => {
                    rejectedFile.errors.forEach(error => {
                      this.props.enqueueSnackbar(
                        `${rejectedFile.file.name}: ${error.message}`,
                        { variant: 'error' });
                    })
                  })
                  if (acceptedFiles.length > 0) {
                    const acceptedFile = acceptedFiles[0];
                    if (!acceptedFile.name.toLowerCase().endsWith(".csv")) {
                      this.props.enqueueSnackbar(
                        `${acceptedFile.name}: File type must be of type .csv`,
                        { variant: 'error' });
                      return;
                    }

                    var preview: string[][] | undefined;
                    try {
                      preview = await csvPreviewLines(acceptedFile, PreviewLines);
                    } catch (e) {
                      this.props.enqueueSnackbar(
                        `${acceptedFile.name}: Failed to parse`,
                        { variant: 'error' });
                      return;
                    }

                    if (preview.length === 0
                      || (preview.length === 1 && preview[0].length === 0)
                      || (preview.length === 1 && preview[0].length === 1 && preview[0][0] === '')) {
                      this.props.enqueueSnackbar(
                        `${acceptedFile.name}: File is empty`,
                        { variant: 'error' });
                      return;
                    }

                    this.setState({
                      importFirstRowIsHeader: preview.length > 1,
                      importFile: {
                        file: acceptedFile,
                        preview,
                      }
                    });
                  }
                }}
                disabled={this.state.importIsSubmitting}
              >
                {({ getRootProps, getInputProps }) => (
                  <div className={this.props.classes.dropzone} {...getRootProps()}>
                    <input {...getInputProps()} />
                    <DropzoneIcon color='inherit' className={this.props.classes.uploadIcon} />
                    {!this.state.importFile ? 'Import a CSV File' : this.state.importFile.file.name}
                  </div>
                )}
              </Dropzone>
              <Collapse in={!!this.state.importFile} className={this.props.classes.importCollapsed}>
                <div className={this.props.classes.importProperty}>
                  <FormControlLabel label='First line is a header' disabled={this.state.importIsSubmitting} control={(
                    <Checkbox size='small' color='primary' checked={!!this.state.importFirstRowIsHeader}
                      onChange={e => this.setState({ importFirstRowIsHeader: !this.state.importFirstRowIsHeader })}
                    />
                  )} />
                </div>
                <div className={this.props.classes.tableContainer}>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        {this.state.importFile && this.state.importFile.preview[0].map((header, index) => {
                          var selected: Label[] = [];
                          if (this.state.importIndexTitle === index) selected = [{ label: 'Title', value: 'title' }];
                          if (this.state.importIndexDescription === index) selected = [{ label: 'Description', value: 'description' }];
                          if (this.state.importIndexDateTime === index) selected = [{ label: 'Date/Time', value: 'dateTime' }];
                          if (this.state.importIndexStatusId === index) selected = [{ label: 'Status ID', value: 'statusId' }];
                          if (this.state.importIndexStatusName === index) selected = [{ label: 'Status Name', value: 'statusName' }];
                          if (this.state.importIndexTagIds === index) selected = [{ label: 'Tag IDs', value: 'tagIds' }];
                          if (this.state.importIndexTagNames === index) selected = [{ label: 'Tag Names', value: 'tagNames' }];
                          if (this.state.importIndexVoteValue === index) selected = [{ label: 'Vote Value', value: 'voteValue' }];
                          return (
                            <TableCell>
                              <SelectionPicker
                                className={this.props.classes.indexSelection}
                                disabled={this.state.importIsSubmitting}
                                showTags
                                bareTags
                                TextFieldProps={{
                                  size: 'small',
                                }}
                                placeholder={this.state.importFirstRowIsHeader ? header : undefined}
                                minWidth='150px'
                                disableInput
                                value={selected}
                                options={[
                                  { label: 'Title', value: 'importIndexTitle' },
                                  { label: 'Description', value: 'importIndexDescription' },
                                  { label: 'Date/Time', value: 'importIndexDateTime' },
                                  { label: 'Status ID', value: 'importIndexStatusId' },
                                  { label: 'Status Name', value: 'importIndexStatusName' },
                                  { label: 'Tag IDs', value: 'importIndexTagIds' },
                                  { label: 'Tag Names', value: 'importIndexTagNames' },
                                  { label: 'Vote Value', value: 'importIndexVoteValue' },
                                ]}
                                onValueChange={labels => {
                                  const stateUpdate = {};
                                  Object.entries(this.state).forEach(([prop, val]) => {
                                    if (prop.startsWith('importIndex') && val === index) {
                                      stateUpdate[prop] = undefined;
                                    }
                                  });
                                  const indexType = labels[0]?.value;
                                  if (indexType) stateUpdate[indexType] = index;
                                  this.setState(stateUpdate);
                                }}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {this.state.importFile && this.state.importFile.preview.map((line, indexRow) => (indexRow + 1 !== PreviewLines) ? ((!!this.state.importFirstRowIsHeader && indexRow === 0) ? null : (
                        <TableRow key={`row-${indexRow}`}>
                          {line.map((cell, indexCol) => (
                            <TableCell key={`cell-${indexRow}-${indexCol}`}>{cell}</TableCell>
                          ))}
                        </TableRow>
                      )) : (
                        <TableRow key='row-more'>
                          <TableCell key='cell-more' colSpan={line.length} className={this.props.classes.omitBorder}>
                            ...
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Provider key={this.props.server.getProjectId()} store={this.props.server.getStore()}>
                  <div className={this.props.classes.importSelectionRow}>
                    <CategorySelectWithConnect
                      className={this.props.classes.importProperty}
                      width={180}
                      variant='outlined'
                      size='small'
                      label='Category'
                      errorText={!this.state.importCategoryId && 'Select category' || undefined}
                      value={this.state.importCategoryId || ''}
                      onChange={categoryId => this.setState({ importCategoryId: categoryId })}
                      disabled={this.state.importIsSubmitting}
                    />
                    <UserSelection
                      className={this.props.classes.importProperty}
                      width={180}
                      variant='outlined'
                      size='small'
                      server={this.props.server}
                      label='As user'
                      errorMsg='Select author'
                      disabled={this.state.importIsSubmitting}
                      onChange={selectedUserLabel => this.setState({ importAuthorUserId: selectedUserLabel?.value })}
                      allowCreate
                    />
                    <TextField
                      className={this.props.classes.importProperty}
                      style={{ width: 180 }}
                      variant='outlined'
                      size='small'
                      label='Timezone offset (min)'
                      helperText={this.state.tzOffInMin === undefined
                        ? Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone
                        : undefined}
                      value={this.state.tzOffInMin !== undefined ? this.state.tzOffInMin : getTimezoneOffsetInMin()}
                      onChange={e => this.setState({ tzOffInMin: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </Provider>
                <SubmitButton
                  disabled={this.state.importFile === undefined
                    || this.state.importCategoryId === undefined
                    || this.state.importAuthorUserId === undefined
                    || this.state.importIndexTitle === undefined}
                  isSubmitting={this.state.importIsSubmitting}
                  onClick={() => {
                    this.setState({ importIsSubmitting: true });
                    this.props.server.dispatchAdmin().then(d => d.projectImportPostAdmin({
                      projectId: this.props.server.getProjectId(),
                      firstRowIsHeader: this.state.importFirstRowIsHeader,
                      categoryId: this.state.importCategoryId!,
                      authorUserId: this.state.importAuthorUserId!,
                      indexTitle: this.state.importIndexTitle!,
                      indexDescription: this.state.importIndexDescription,
                      indexStatusId: this.state.importIndexStatusId,
                      indexStatusName: this.state.importIndexStatusName,
                      indexTagIds: this.state.importIndexTagIds,
                      indexTagNames: this.state.importIndexTagNames,
                      indexVoteValue: this.state.importIndexVoteValue,
                      indexDateTime: this.state.importIndexDateTime,
                      tzOffInMin: this.state.tzOffInMin,
                      body: this.state.importFile!.file,
                    })
                      .then(result => {
                        if (result.userFacingMessage) {
                          this.props.enqueueSnackbar(
                            result.userFacingMessage,
                            { variant: result.isError ? 'error' : 'success' });
                        }
                        if (result.isError) {
                          this.setState({ importIsSubmitting: false });
                        } else {
                          this.setState({
                            importIsSubmitting: undefined,
                            importFile: undefined,
                            importIndexTitle: undefined,
                            importIndexDescription: undefined,
                            importIndexStatusId: undefined,
                            importIndexStatusName: undefined,
                            importIndexTagIds: undefined,
                            importIndexTagNames: undefined,
                            importIndexVoteValue: undefined,
                            importIndexDateTime: undefined,
                            tzOffInMin: undefined,
                          });
                        }
                      })
                      .catch(e => this.setState({ importIsSubmitting: false })));
                  }}
                >Import</SubmitButton>
              </Collapse>
              <NeedHelpInviteTeammate server={this.props.server} />
            </>
          )}
        />
        <Section title='Export data'
          description="Export this project's data in a CSV format. Useful if you'd like to analyze your data yourself or move to another provider."
          preview={(
            <>
              <div className={this.props.classes.exportCheckboxes}>
                <FormControlLabel label='Posts' disabled={this.state.exportIsSubmitting} control={(
                  <Checkbox size='small' color='primary' checked={!!this.state.exportIncludePosts}
                    onChange={e => this.setState({ exportIncludePosts: !this.state.exportIncludePosts })}
                  />
                )} />
                <FormControlLabel label='Comments' disabled={this.state.exportIsSubmitting} control={(
                  <Checkbox size='small' color='primary' checked={!!this.state.exportIncludeComments}
                    onChange={e => this.setState({ exportIncludeComments: !this.state.exportIncludeComments })}
                  />
                )} />
                <FormControlLabel label='Users' disabled={this.state.exportIsSubmitting} control={(
                  <Checkbox size='small' color='primary' checked={!!this.state.exportIncludeUsers}
                    onChange={e => this.setState({ exportIncludeUsers: !this.state.exportIncludeUsers })}
                  />
                )} />
              </div>
              <SubmitButton
                disabled={!this.state.exportIncludeComments
                  && !this.state.exportIncludePosts
                  && !this.state.exportIncludeUsers}
                isSubmitting={this.state.exportIsSubmitting}
                onClick={() => {
                  this.setState({ exportIsSubmitting: true });
                  this.props.server.dispatchAdmin().then(d => d.projectExportAdmin({
                    projectId: this.props.server.getProjectId(),
                    includePosts: this.state.exportIncludePosts,
                    includeComments: this.state.exportIncludeComments,
                    includeUsers: this.state.exportIncludeUsers,
                  })
                    .then(fileDownload => {
                      this.setState({ exportIsSubmitting: false })
                      download(fileDownload.blob, fileDownload.filename, fileDownload.contentType);
                    })
                    .catch(e => this.setState({ exportIsSubmitting: false })));
                }}
              >Export</SubmitButton>
            </>
          )}
        />
        <Section title='Delete Project'
          description={(
            <>
              Permanently deletes {projectName}, settings, users, and all content.
            </>
          )}
          content={(
            <>
              <Button
                disabled={this.state.deleteIsSubmitting}
                style={{ color: !this.state.deleteIsSubmitting ? this.props.theme.palette.error.main : undefined }}
                onClick={() => this.setState({ deleteDialogOpen: true })}
              >Delete</Button>
              <Dialog
                open={!!this.state.deleteDialogOpen}
                onClose={() => this.setState({ deleteDialogOpen: false })}
              >
                <DialogTitle>Delete project</DialogTitle>
                <DialogContent>
                  <DialogContentText>Are you sure you want to permanently delete {projectName} including all content?</DialogContentText>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => this.setState({ deleteDialogOpen: false })}>Cancel</Button>
                  <SubmitButton
                    isSubmitting={this.state.deleteIsSubmitting}
                    style={{ color: !this.state.deleteIsSubmitting ? this.props.theme.palette.error.main : undefined }}
                    onClick={() => {
                      this.setState({ deleteIsSubmitting: true });
                      this.props.server.dispatchAdmin().then(d => d.projectDeleteAdmin({
                        projectId: this.props.server.getProjectId(),
                      }))
                        .then(() => {
                          ServerAdmin.get().removeProject(this.props.server.getProjectId());
                          this.setState({
                            deleteIsSubmitting: false,
                            deleteDialogOpen: false,
                          });
                          this.props.history.push('/dashboard');
                        })
                        .catch(e => this.setState({ deleteIsSubmitting: false }));
                    }}>Delete</SubmitButton>
                </DialogActions>
              </Dialog>
            </>
          )}
        />
      </div>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ConnectProps = {
    account: state.account.account.account,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withSnackbar(withRouter(DataSettings))));
