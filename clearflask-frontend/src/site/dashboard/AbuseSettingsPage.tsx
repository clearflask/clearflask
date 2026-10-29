// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { CircularProgress, FormControlLabel, Switch, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import React, { useEffect, useRef, useState } from 'react';
import * as Admin from '../../api/admin';
import ServerAdmin from '../../api/serverAdmin';
import SubmitButton from '../../common/SubmitButton';
import { ProjectSettingsBase } from './ProjectSettings';

export default function AbuseSettingsPage() {
  const [settings, setSettings] = useState<Admin.RegistrationAbuseSettings>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const load = async () => {
      try {
        const dispatcher = await ServerAdmin.get().dispatchAdmin();
        const response = await dispatcher.registrationAbuseGetSuperAdmin();
        if (mounted.current) setSettings(response);
      } catch (e) {
        if (mounted.current) setError('Could not load abuse settings. Reload to try again.');
      }
    };
    load();
    return () => { mounted.current = false; };
  }, []);
  const save = async () => {
    if (!settings || pending.current) return;
    pending.current = true;
    setSaving(true);
    setSaved(false);
    setError(undefined);
    try {
      const dispatcher = await ServerAdmin.get().dispatchAdmin();
      const response = await dispatcher.registrationAbuseUpdateSuperAdmin({ registrationAbuseSettings: settings });
      if (mounted.current) {
        setSettings(response);
        setSaved(true);
      }
    } catch (e) {
      if (mounted.current) setError('Could not save abuse settings. Reload to verify the current settings before retrying.');
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return <ProjectSettingsBase title="Anti-spam / Abuse">
    <Typography paragraph>These settings apply only to new dashboard/admin accounts. Portal user registrations are unaffected. Existing users can still sign in.</Typography>
    {!!error && <Alert severity="error">{error}</Alert>}
    {!settings && !error && <CircularProgress aria-label="Loading abuse settings" size={24} />}
    {!!settings && <>
      <FormControlLabel label="Allow new admin account registrations" control={<Switch checked={settings.registrationsEnabled} disabled={saving}
        onChange={(_, checked) => { setSettings({ ...settings, registrationsEnabled: checked }); setSaved(false); }} />} />
      <FormControlLabel label="Require CAPTCHA for every admin account registration" control={<Switch checked={settings.registrationCaptchaEnabled} disabled={saving}
        onChange={(_, checked) => { setSettings({ ...settings, registrationCaptchaEnabled: checked }); setSaved(false); }} />} />
      <Typography paragraph variant="body2">Authenticated superadmins retain their CAPTCHA exemption. Normal rate limits remain active.</Typography>
      {!settings.registrationsEnabled && <Alert severity="warning">New admin account registrations will be blocked until enabled again.</Alert>}
      {saved && <Alert severity="success">Abuse settings saved.</Alert>}
      <SubmitButton isSubmitting={saving} disabled={saving} onClick={save}>Save</SubmitButton>
    </>}
  </ProjectSettingsBase>;
}
