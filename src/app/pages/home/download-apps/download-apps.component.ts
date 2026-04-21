import { Component } from '@angular/core';

@Component({
  selector: 'app-download-apps',
  standalone: true,
  templateUrl: './download-apps.component.html',
  styleUrl: './download-apps.component.scss'
})
export class DownloadAppsComponent {
  appleStoreUrl = 'https://apps.apple.com/us/app/mozeconnect/id6758315106';
  playStoreUrl = 'https://play.google.com/store/apps/details?id=com.mozeplaceRemake.app&_gl=1*1hfedcj*_up*MQ..&gclid=CjwKCAjwwJzPBhBREiwAJfHRncoIKLJF6GFpJwykKHwHEWns_KtVJ7yZi3MFmoKNSDnnF4-bSdfpnRoC2rIQAvD_BwE&utm_source=emea_Med';
}
