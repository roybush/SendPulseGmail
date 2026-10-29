import { createApp } from 'vue';
import { onThreadOpen } from './gmail';
import SidebarPanel from './SidebarPanel.vue';

onThreadOpen((thread) => {
  const el = document.createElement('div');
  const app = createApp(SidebarPanel, { participants: thread.participants, subject: thread.subject });
  app.mount(el);
  thread.showPanel(el);
  thread.onClose(() => app.unmount());
}).catch((e) => console.error('[SendPulse] failed to start in Gmail', e));
