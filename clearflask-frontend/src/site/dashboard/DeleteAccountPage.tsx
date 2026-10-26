// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, List, ListItem, ListItemSecondaryAction, ListItemText, TextField, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import React, { useEffect, useRef, useState } from 'react';
import * as Admin from '../../api/admin';
import ServerAdmin from '../../api/serverAdmin';
import SubmitButton from '../../common/SubmitButton';
import { ProjectSettingsBase } from './ProjectSettings';

export default function DeleteAccountPage(props: { account: Admin.AccountAdmin }) {
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<Admin.Account[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [searching, setSearching] = useState(true);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [selected, setSelected] = useState<Admin.Account>();
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const requestId = useRef(0);
  const deletedIds = useRef(new Set<string>());

  const search = async (text: string, pageCursor?: string) => {
    const id = ++requestId.current;
    setSearching(true);
    setError(undefined);
    try {
      const dispatcher = await ServerAdmin.get().dispatchAdmin();
      const response = await dispatcher.accountSearchSuperAdmin({
        cursor: pageCursor,
        accountSearchSuperAdmin: { searchText: text.trim() || undefined },
      });
      if (id !== requestId.current) return;
      setResults(previous => {
        const accounts = new Map<string, Admin.Account>();
        [...(pageCursor ? previous : []), ...response.results].forEach(account => {
          if (!deletedIds.current.has(account.accountId)) accounts.set(account.accountId, account);
        });
        return Array.from(accounts.values());
      });
      setCursor(response.cursor);
    } catch (e) {
      if (id === requestId.current) setError('Account search failed. Please try again.');
    } finally {
      if (id === requestId.current) setSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => search(searchText), 300);
    return () => {
      clearTimeout(timer);
      ++requestId.current;
    };
  }, [searchText]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeDialog = () => {
    if (deletingRef.current) return;
    setSelected(undefined);
    setConfirmation('');
  };
  const deleteAccount = async () => {
    if (!selected || deletingRef.current || confirmation !== selected.email
      || selected.accountId === props.account.accountId) return;
    deletingRef.current = true;
    setDeleting(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const dispatcher = await ServerAdmin.get().dispatchAdmin();
      await dispatcher.accountDeleteSuperAdmin({
        accountDeleteSuperAdmin: { accountOrEmailIds: [selected.accountId] },
      });
      deletedIds.current.add(selected.accountId);
      setResults(previous => previous.filter(account => account.accountId !== selected.accountId));
      setSuccess(`Deleted ${selected.email}.`);
      setSelected(undefined);
      setConfirmation('');
    } catch (e) {
      setError(`Failed to delete ${selected.email}. The deletion may be incomplete. Check the account before retrying.`);
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  return (
    <ProjectSettingsBase title="Delete Account">
      <Alert severity="warning">Permanently delete an account and all projects it owns. This cannot be undone.</Alert>
      <TextField
        label="Search by name or email"
        variant="outlined"
        size="small"
        fullWidth
        autoFocus
        margin="normal"
        value={searchText}
        onChange={e => {
          ++requestId.current;
          setSearchText(e.target.value);
          setSearching(true);
          setResults([]);
          setCursor(undefined);
        }}
      />
      {!!success && <Alert severity="success">{success}</Alert>}
      {!!error && !selected && <Alert severity="error">{error}</Alert>}
      {searching && <CircularProgress size={20} aria-label="Searching accounts" />}
      {!searching && !error && results.length === 0 && <Typography>No accounts found</Typography>}
      <List dense>
        {results.map(account => (
          <ListItem key={account.accountId} divider>
            <ListItemText primary={account.name} secondary={account.email} />
            <ListItemSecondaryAction>
              {account.accountId === props.account.accountId ? (
                <Typography variant="caption" color="textSecondary">Current account</Typography>
              ) : (
                <Button size="small" color="secondary" disabled={deleting} onClick={() => {
                  setSelected(account);
                  setConfirmation('');
                  setError(undefined);
                  setSuccess(undefined);
                }}>Delete</Button>
              )}
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>
      {!!cursor && <Button disabled={searching || deleting} onClick={() => search(searchText, cursor)}>Load more</Button>}
      <Dialog open={!!selected} onClose={closeDialog} aria-labelledby="delete-account-title">
        <DialogTitle id="delete-account-title">Permanently delete account?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete {selected?.name} ({selected?.email}), account ID {selected?.accountId},
            and all projects owned by this account. Its access to other projects will also be removed
            and its billing account closed. This cannot be undone.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Type the account email to confirm"
            value={confirmation}
            disabled={deleting}
            onChange={e => setConfirmation(e.target.value)}
          />
          {!!error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={closeDialog}>Cancel</Button>
          <SubmitButton color="secondary" isSubmitting={deleting}
            disabled={!selected || confirmation !== selected.email || deleting}
            onClick={deleteAccount}>Permanently delete</SubmitButton>
        </DialogActions>
      </Dialog>
    </ProjectSettingsBase>
  );
}
