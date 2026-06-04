import { redirect } from 'next/navigation';

// Root '/' redirects to the dashboard for now.
// Later we'll add auth guard to redirect unauthenticated users to /login.
export default function RootPage() {
  redirect('/dashboard');
}
