import { avisData, typeAvis } from './avis.model';

describe('avisData', () => {
  it('should export at least one avis', () => {
    expect(avisData.length).toBeGreaterThan(0);
  });

  it('every avis should have name, avis text and image path', () => {
    avisData.forEach((a: typeAvis) => {
      expect(a.name).toBeTruthy();
      expect(a.avis).toBeTruthy();
      expect(a.image).toMatch(/^assets\/images\/.+\.(jpg|jpeg|png|webp|svg)$/);
    });
  });

  it('should have unique names', () => {
    const names = avisData.map((a) => a.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('should contain Anthony, Fanny and Mohammed', () => {
    const names = avisData.map((a) => a.name);
    expect(names).toContain('Anthony');
    expect(names).toContain('Fanny');
    expect(names).toContain('Mohammed');
  });
});
