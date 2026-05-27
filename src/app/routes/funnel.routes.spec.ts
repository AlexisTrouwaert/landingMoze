import { FUNNEL_ROUTES } from './funnel.routes';

describe('FUNNEL_ROUTES', () => {
  it('should expose a single root route', () => {
    expect(FUNNEL_ROUTES.length).toBe(1);
    expect(FUNNEL_ROUTES[0].path).toBe('');
  });

  it('should lazy-load the FunnelComponent', async () => {
    const loader = FUNNEL_ROUTES[0].loadComponent as unknown as () =>
      | Promise<any>
      | any;
    const cmp = await loader();
    expect(cmp).toBeTruthy();
    expect(cmp.name).toContain('Funnel');
  });
});
