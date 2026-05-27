import {
  CGV_ROUTES,
  MENTION_ROUTES,
  POLITIQUE_ROUTES,
} from './legal.routes';

describe('legal.routes', () => {
  it('CGV_ROUTES should lazy-load CgvComponent', async () => {
    expect(CGV_ROUTES.length).toBe(1);
    const cmp = await (CGV_ROUTES[0].loadComponent as () => Promise<any>)();
    expect(cmp.name).toContain('Cgv');
  });

  it('MENTION_ROUTES should lazy-load MentionComponent', async () => {
    expect(MENTION_ROUTES.length).toBe(1);
    const cmp = await (MENTION_ROUTES[0].loadComponent as () => Promise<any>)();
    expect(cmp.name).toContain('Mention');
  });

  it('POLITIQUE_ROUTES should lazy-load PolitiqueComponent', async () => {
    expect(POLITIQUE_ROUTES.length).toBe(1);
    const cmp = await (POLITIQUE_ROUTES[0].loadComponent as () =>
      Promise<any>)();
    expect(cmp.name).toContain('Politique');
  });
});
