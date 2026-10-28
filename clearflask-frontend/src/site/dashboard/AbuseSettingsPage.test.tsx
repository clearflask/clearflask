import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import ServerAdmin from '../../api/serverAdmin';
import AbuseSettingsPage from './AbuseSettingsPage';

jest.mock('../../api/serverAdmin', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('./ProjectSettings', () => ({ ProjectSettingsBase: ({ children }) => <div>{children}</div> }));
let container: HTMLDivElement;
let dispatcher: any;
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
beforeEach(() => {
  container = document.createElement('div'); document.body.appendChild(container);
  dispatcher = {
    registrationAbuseGetSuperAdmin: jest.fn().mockResolvedValue({ registrationsEnabled: true, registrationCaptchaEnabled: true }),
    registrationAbuseUpdateSuperAdmin: jest.fn().mockImplementation(request => Promise.resolve(request.registrationAbuseSettings)),
  };
  (ServerAdmin.get as jest.Mock).mockReturnValue({ dispatchAdmin: () => Promise.resolve(dispatcher) });
});
afterEach(() => { act(() => { ReactDOM.unmountComponentAtNode(container); }); container.remove(); });
test('loads actual controls and persists changed settings only on Save', async () => {
  act(() => { ReactDOM.render(<AbuseSettingsPage />, container); }); await flush();
  const switches = container.querySelectorAll('input');
  expect(switches[0].checked).toBe(true); expect(switches[1].checked).toBe(true);
  act(() => { Simulate.change(switches[0], { target: { checked: false } } as any); });
  expect(dispatcher.registrationAbuseUpdateSuperAdmin).not.toHaveBeenCalled();
  const save = container.querySelector('button')!;
  act(() => { Simulate.click(save); Simulate.click(save); }); await flush();
  expect(dispatcher.registrationAbuseUpdateSuperAdmin).toHaveBeenCalledTimes(1);
  expect(dispatcher.registrationAbuseUpdateSuperAdmin).toHaveBeenCalledWith({ registrationAbuseSettings: { registrationsEnabled: false, registrationCaptchaEnabled: true } });
  expect(container.textContent).toContain('Abuse settings saved');
});
test('load failure does not present guessed enabled states', async () => {
  dispatcher.registrationAbuseGetSuperAdmin.mockRejectedValue(new Error('Denied'));
  act(() => { ReactDOM.render(<AbuseSettingsPage />, container); }); await flush();
  expect(container.textContent).toContain('Could not load abuse settings');
  expect(container.querySelector('input')).toBeNull();
});
