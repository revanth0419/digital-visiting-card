# Digital Visiting Card

Your smart digital link hub. Share all your important links in one beautiful place for free.

## Project info

This project is a React + Vite + Supabase application deployed on Vercel.

## Development

```sh
# Install dependencies
npm install

# Start development server
npm run dev
```

## Email Configuration (Important)

Supabase uses a default email sender service which does not allow customizing the sender name. By default, emails will appear to come from "Supabase".

To change the sender name to "Digital Visiting Card", you MUST configure a custom SMTP provider in your Supabase project settings.

### Steps to Configure Custom SMTP:

1.  Go to your Supabase Project Dashboard.
2.  Navigate to **Project Settings** > **Auth** > **SMTP Settings**.
3.  Enable **Enable Custom SMTP**.
4.  Enter your SMTP provider details (e.g., Resend, SendGrid, AWS SES, or your own mail server).
    *   **Sender Email**: `noreply@yourdomain.com`
    *   **Sender Name**: `Digital Visiting Card`
5.  Save changes.

Once configured, all auth emails (signup, password reset) will show "Digital Visiting Card" as the sender.

## Technologies

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase Auth & Database
