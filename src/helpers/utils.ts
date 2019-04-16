import Api from './api';
import GMailTracker from './gmail_tracker';
export const api = new Api(window['XMLHttpRequest']);
export const gmailTracker = new GMailTracker();

