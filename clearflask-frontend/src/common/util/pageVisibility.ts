
export function isPageVisible(): boolean {
  return !document.hidden;
}

export function waitUntilPageVisible(): Promise<void> {
  if (!document.hidden) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    if (!document.hidden) {
      resolve();
      return;
    }
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resolve();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
  })
}
