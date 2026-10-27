# Chrome Web Store listing — English

## Name (from the package)

SendPulse for Gmail

## Summary (from the package, max 132 characters)

SendPulse for Gmail: add people from your emails to SendPulse

## Category

Productivity → Workflow & Planning

## Description

🔥 Add people from your Gmail conversations to SendPulse mailing lists in one click.

If you use SendPulse and work in Gmail, stop copying addresses by hand or exporting CSV files. Open an email, and everyone in the conversation is right there in a SendPulse panel on the right — ready to add to the list you choose.

✨ What it does

• Shows everyone in the open conversation (sender, recipients, CC) except you
• Tells you which SendPulse mailing lists each person is already in
• Preselects people who aren't in SendPulse yet; skips noreply and notification senders
• Fills in first and last name from the email header or the signature
• Reads the sender's signature for phone, company, job title, website and LinkedIn profile
• Lets you review and edit everything before saving
• Adds all selected people to the chosen mailing list with one click
• Maps fields to your list's variables automatically (firstName, Name, Company, Phone…) and remembers your choice per list
• "Find on LinkedIn" opens LinkedIn's people search for the contact in a new tab

🚀 Getting started

1. Install the extension and open Gmail.
2. Open any email — the SendPulse icon appears in the right sidebar.
3. Connect your account right in the panel with a SendPulse API key
   (SendPulse → Settings → API → API keys → Create key),
   or with your REST API ID and Secret (Settings → API → Credentials).
4. Pick a mailing list and click "Add to SendPulse".

🔒 Privacy

• Your API key is stored only in your browser's extension storage and is never shown to Gmail's page.
• Your data goes only to the official SendPulse API (api.sendpulse.com). No servers of ours in between, no analytics, no ads. The Gmail integration library (InboxSDK) may send anonymous technical error reports to its developer.
• Email content is read locally, only to find names and contact details in the open conversation.
• When you open an email, the participants' addresses are looked up in your SendPulse account to show their status. Names and details are saved to SendPulse only when you click "Add".

Privacy policy: https://github.com/roybush/SendPulseGmail/blob/master/PRIVACY.md
Source code: https://github.com/roybush/SendPulseGmail

🆕 What's new in 2.0

Completely rebuilt for Manifest V3: a new Gmail sidebar panel, sign-in with API keys, contact details from signatures, field mapping per mailing list, and a refreshed Material design.
