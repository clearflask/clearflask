// SPDX-FileCopyrightText: 2022-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0

class StateAwait {
  pendingChanges: number = 0;
  pendingActions: (() => any)[] = [];

  incrementStateChange(): void {
    this.pendingChanges++
  }

  decrementStateChange(): void {
    this.pendingChanges--;
    if (this.pendingChanges <= 0) {
      while (this.pendingActions.length > 0) {
        this.pendingActions.shift()?.();
      }
    }
  }

  waitFor(): Promise<void> {
    if (this.pendingChanges <= 0) {
      return Promise.resolve();
    } else {
      return new Promise(resolve => this.execute(resolve));
    }
  }

  execute(action: () => any): void {
    if (this.pendingChanges <= 0) {
      action();
    } else {
      this.pendingActions.push(action);
    }
  }
}

export default StateAwait;
