import { HOME_ROUTES } from './home.routes';
import { cleanUrlGuard } from '../guard/clean-url.guard';

describe('HOME_ROUTES', () => {
  it('should expose a single root route', () => {
    expect(HOME_ROUTES.length).toBe(1);
    expect(HOME_ROUTES[0].path).toBe('');
  });

  it('should protect home with cleanUrlGuard', () => {
    expect(HOME_ROUTES[0].canActivate).toEqual([cleanUrlGuard]);
  });

  it('should lazy-load the HomeComponent', async () => {
    const loader = HOME_ROUTES[0].loadComponent as unknown as () =>
      | Promise<any>
      | any;
    const cmp = await loader();
    expect(cmp).toBeTruthy();
    expect(cmp.name).toContain('Home');
  });
});
