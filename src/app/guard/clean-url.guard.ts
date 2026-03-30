import { CanActivateFn } from '@angular/router';

export const cleanUrlGuard: CanActivateFn = (route) => {
  if ('attachment_id' in route.queryParams) {
    window.location.href = '/';
    return false;
  }

  return true;
};
