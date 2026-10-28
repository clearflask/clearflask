// SPDX-FileCopyrightText: 2026 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import ServerAdmin from '../../api/serverAdmin';
import DeleteAccountPage from './DeleteAccountPage';

jest.mock('../../api/serverAdmin', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('./ProjectSettings', () => ({ ProjectSettingsBase: ({ children }) => <div>{children}</div> }));

const current = { accountId: 'current', name: 'Admin', email: 'admin@example.com' };
const target = { accountId: 'target-id', name: 'Target', email: 'target@example.com' };
let container: HTMLDivElement;
let dispatcher: any;
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const button = (label: string): HTMLButtonElement => Array.from(document.querySelectorAll('button'))
  .find(element => element.textContent === label)!;

beforeEach(async () => {
  jest.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  dispatcher = {
    accountSearchSuperAdmin: jest.fn().mockResolvedValue({ results: [current, target] }),
    accountDeleteSuperAdmin: jest.fn().mockResolvedValue(undefined),
  };
  (ServerAdmin.get as jest.Mock).mockReturnValue({ dispatchAdmin: () => Promise.resolve(dispatcher) });
  act(() => { ReactDOM.render(<DeleteAccountPage account={current as any} />, container); });
  act(() => { jest.advanceTimersByTime(300); });
  await flush();
});
afterEach(() => {
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  container.remove();
  jest.useRealTimers();
});

async function confirmTarget() {
  act(() => { Simulate.click(button('Delete')); });
  expect(button('Permanently delete').disabled).toBe(false);
  expect(document.querySelector('[role="dialog"] input')).toBeNull();
  await flush();
}

test('protects current account and keeps confirmation before deleting by immutable ID', async () => {
  expect(document.body.textContent).toContain('Current account');
  expect(document.querySelectorAll('button').length).toBe(1);
  await confirmTarget();
  act(() => { Simulate.click(button('Permanently delete')); });
  await flush();
  expect(dispatcher.accountDeleteSuperAdmin).toHaveBeenCalledTimes(1);
  expect(dispatcher.accountDeleteSuperAdmin).toHaveBeenCalledWith({
    accountDeleteSuperAdmin: { accountOrEmailIds: ['target-id'] },
  });
  expect(document.body.textContent).toContain('Deleted target@example.com.');
  expect(button('Delete')).toBeUndefined();
});

test('cancel leaves the account intact and never calls deletion', async () => {
  await confirmTarget();
  act(() => { Simulate.click(button('Cancel')); });
  await flush();
  expect(dispatcher.accountDeleteSuperAdmin).not.toHaveBeenCalled();
  expect(button('Delete')).toBeDefined();
});

test('keeps failure visible and blocks duplicate deletion while request is pending', async () => {
  let rejectDeletion: (error: Error) => void = () => {};
  dispatcher.accountDeleteSuperAdmin.mockImplementation(() => new Promise((resolve, reject) => {
    rejectDeletion = reject;
  }));
  await confirmTarget();
  act(() => {
    Simulate.click(button('Permanently delete'));
    Simulate.click(button('Permanently delete'));
  });
  await flush();
  expect(dispatcher.accountDeleteSuperAdmin).toHaveBeenCalledTimes(1);
  expect(button('Cancel').disabled).toBe(true);
  await act(async () => { rejectDeletion(new Error('Failed')); });
  expect(document.body.textContent).toContain('The deletion may be incomplete');
  expect(button('Permanently delete').disabled).toBe(false);
});

test('ignores a stale account search after a newer query completes', async () => {
  let resolveOld: (response: any) => void = () => {};
  dispatcher.accountSearchSuperAdmin
    .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ results: [{ accountId: 'new', name: 'New result', email: 'new@example.com' }] });
  const input = container.querySelector('input')!;
  act(() => { Simulate.change(input, { target: { value: 'old' } } as any); });
  act(() => { jest.advanceTimersByTime(300); });
  await flush();
  act(() => { Simulate.change(input, { target: { value: 'new' } } as any); });
  act(() => { jest.advanceTimersByTime(300); });
  await flush();
  await act(async () => { resolveOld({ results: [target] }); });
  expect(container.textContent).toContain('New result');
  expect(container.textContent).not.toContain(target.email);
});
