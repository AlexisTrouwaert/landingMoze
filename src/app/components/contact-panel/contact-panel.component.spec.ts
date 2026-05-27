import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ContactPanelComponent } from './contact-panel.component';
import { ContactPanelService } from '../../services/contact-panel.service';

describe('ContactPanelComponent', () => {
  let component: ContactPanelComponent;
  let fixture: ComponentFixture<ContactPanelComponent>;
  let service: ContactPanelService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactPanelComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactPanelComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(ContactPanelService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose the ContactPanelService as `panel`', () => {
    expect(component.panel).toBe(service);
  });

  it('emailCopied() should default to false', () => {
    expect(component.emailCopied()).toBe(false);
  });

  it('onEscape() should close panel when open', () => {
    service.open();
    const closeSpy = spyOn(service, 'close').and.callThrough();
    component.onEscape();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('onEscape() should be a no-op when panel is closed', () => {
    const closeSpy = spyOn(service, 'close');
    component.onEscape();
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('copyEmail() should write support@moze.fr to clipboard and toggle emailCopied()', fakeAsync(() => {
    const writeSpy = jasmine
      .createSpy('writeText')
      .and.returnValue(Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeSpy },
    });

    component.copyEmail();
    tick();

    expect(writeSpy).toHaveBeenCalledWith('support@moze.fr');
    expect(component.emailCopied()).toBe(true);

    tick(2000);
    expect(component.emailCopied()).toBe(false);
  }));

  it('escape keydown event should trigger onEscape()', () => {
    const spy = spyOn(component, 'onEscape');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(spy).toHaveBeenCalled();
  });
});
