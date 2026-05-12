import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemeBootstrap } from '@/components/ThemeBootstrap';
import { Sidebar } from '@/components/Sidebar';
import { BackgroundFX } from '@/components/BackgroundFX';

export const metadata: Metadata = {
    title: 'PromptShield Dashboard',
    description: 'Enterprise data loss prevention for AI tools',
    icons: {
        icon: [
            { url: '/promptshield-icon.png', type: 'image/png' },
        ],
        shortcut: '/promptshield-icon.png',
        apple: '/promptshield-icon.png',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" data-theme="futuristic" suppressHydrationWarning>
            <head>
                <ThemeBootstrap />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                <ThemeProvider>
                    <BackgroundFX />
                    <div className="dashboard-container">
                        <Sidebar />
                        <main className="main-content">{children}</main>
                    </div>
                </ThemeProvider>
            </body>
        </html>
    );
}
