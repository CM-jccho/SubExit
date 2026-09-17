export const WORKSPACE_LEAVE_EVENT = "ddeundeun-before-workspace-leave";

// React tab changes do not trigger beforeunload. Let an active editor veto them.
export function canLeaveWorkspace() {
  return window.dispatchEvent(
    new window.Event(WORKSPACE_LEAVE_EVENT, { cancelable: true }),
  );
}
