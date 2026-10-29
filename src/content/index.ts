import { createApp } from 'vue';
import { t } from '../shared/i18n';
import { connectGmail } from './gmail';
import type { EmailNote } from '../shared/types';
import type { Participant } from './participants';
import SidebarPanel from './SidebarPanel.vue';

type PanelProps = {
  participants: Participant[];
  subject?: string;
  email?: EmailNote;
  bulk?: boolean;
  label?: string;
};

function mountPanel(props: PanelProps, width?: string) {
  const el = document.createElement('div');
  if (width) el.style.width = width;
  const app = createApp(SidebarPanel, props);
  app.mount(el);
  return { el, unmount: () => app.unmount() };
}

connectGmail({
  bulkButtonTitle: t('bulkButton'),
  onThreadOpen(thread) {
    const panel = mountPanel({
      participants: thread.participants,
      subject: thread.subject,
      email: { subject: thread.subject, url: thread.url, text: thread.text },
    });
    thread.showPanel(panel.el);
    thread.onClose(panel.unmount);
  },
  onBulkSelect(selection) {
    const panel = mountPanel(
      { participants: selection.participants, bulk: true, label: selection.label },
      '400px',
    );
    selection.showDrawer(panel.el, t('bulkTitle'), panel.unmount);
  },
}).catch((e) => console.error('[SendPulse] failed to start in Gmail', e));
