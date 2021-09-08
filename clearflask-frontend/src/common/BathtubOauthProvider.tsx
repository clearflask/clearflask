// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, TextField } from '@material-ui/core';
import BathtubIcon from '@material-ui/icons/Bathtub';
import React, { useState } from 'react';
import { OAUTH_CODE_PARAM_NAME, OAUTH_STATE_PARAM_NAME } from './util/oauthUtil';
import windowIso from './windowIso';

const MockOauthProvider = () => {
  const [email, setEmail] = useState<string>('sandy@example.com');
  const [name, setName] = useState<string>('Sandy Beach');

  const params = new URL(windowIso.location.href).searchParams;
  const redirectLink = `${params.get('redirect_uri') || ''}`
    + `?${OAUTH_CODE_PARAM_NAME}=${encodeURIComponent(JSON.stringify({ email, name }))}`
    + `&${OAUTH_STATE_PARAM_NAME}=${encodeURIComponent(params.get(OAUTH_STATE_PARAM_NAME) || '')}`;

  return (
    <div style={{
      margin: 'auto',
      display: 'flex',
      flexDirection: 'column',
      rowGap: 24,
      maxWidth: 600,
    }}>
      <h1 style={{ display: 'flex', alignItems: 'center', columnGap: 24 }}>
        <BathtubIcon fontSize='inherit' />
        Bathtub
      </h1>
      <div>
        {[...params.entries()].map(entry => (
          <p>
            <b>{entry[0]}:</b> "{entry[1]}"
          </p>
        ))}
      </div>
      <TextField
        size='small'
        variant='outlined'
        label='Name'
        value={name || ''}
        onChange={e => setName(e.target.value)}
      />
      <TextField
        size='small'
        variant='outlined'
        label='Email'
        value={email || ''}
        onChange={e => setEmail(e.target.value)}
      />
      {redirectLink}
      <Button
        onClick={() => {
          if (windowIso.isSsr) return;
          windowIso.open(redirectLink, '_self');
        }}
      >Go</Button>
    </div>
  );
}
export default MockOauthProvider;
