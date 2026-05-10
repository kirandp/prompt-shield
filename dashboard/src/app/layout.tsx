import type { Metadata } from 'next';
import './globals.css';

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
        <html lang="en">
            <body>
                <div className="dashboard-container">
                    <nav className="sidebar">
                        <div className="sidebar-header">
                            <div className="logo">🛡️</div>
                            <h1>PromptShield</h1>
                        </div>

                        <ul className="nav-menu">
                            <li><a href="/shield">Shield Demo</a></li>
                            <li><a href="/rules">Custom Rules</a></li>
                            <li><a href="/audit">Audit Log</a></li>
                            <li><a href="/dashboard">Analytics</a></li>
                            <li><a href="/settings">Settings</a></li>
                        </ul>
                    </nav>

                    <main className="main-content">
                        {children}
                    </main>
                </div>
            </body>
        </html>
    );
}
