import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from './providers/ThemeProvider';
import { ClientSidebar } from './components/ClientSidebar';

export const metadata: Metadata = {
    title: 'PromptShield Dashboard',
    description: 'Enterprise data loss prevention for AI tools',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <ThemeProvider>
                    <div className="dashboard-container">
                        <ClientSidebar />
                        <main className="main-content">
                            {children}
                        </main>
                    </div>
                </ThemeProvider>
            </body>
        </html>
    );
}
