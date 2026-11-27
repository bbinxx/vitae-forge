import type { MouseEvent } from 'react';
import { NAV_ITEMS } from './nav.js';

const defaultTab = 'applications';

export function workspacePath(tab: string): string {
  return '/workspace/' + (NAV_ITEMS.some(item => item.id === tab) ? tab : defaultTab);
}

export function workspaceTab(path: string): string {
  return NAV_ITEMS.find(item => workspacePath(item.id) === path)?.id ?? defaultTab;
}

export function workspaceReturnPath(path: string | null): string {
  return workspacePath(workspaceTab(path ?? ''));
}

export function handleWorkspaceLink(event: MouseEvent<HTMLAnchorElement>, navigate: () => void) {
  if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  event.preventDefault();
  navigate();
}
