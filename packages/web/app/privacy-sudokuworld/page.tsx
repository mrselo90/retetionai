import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy - Sudoku World',
    description: 'Privacy Policy for Sudoku World app.',
};

export default function SudokuWorldsPrivacyPolicy() {
    return (
        <>
            <style>{`
          :root { color-scheme: light dark; }
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            background: #f6f8fc;
            color: #0f172a;
          }
          .wrap {
            max-width: 920px;
            margin: 0 auto;
            padding: 28px 18px 60px;
          }
          h1, h2 { line-height: 1.25; }
          h1 { margin-top: 0; }
          .card {
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 20px;
            margin-bottom: 16px;
          }
          .muted { color: #475569; }
          code {
            background: #f1f5f9;
            border-radius: 6px;
            padding: 2px 6px;
          }
          a { color: #1d4ed8; }
          ul { padding-left: 20px; }
        `}</style>
            <main className="wrap">
                <h1>Privacy Policy - Sudoku World</h1>
                <p className="muted"><strong>Last updated:</strong> March 6, 2026</p>

                <section className="card">
                    <p>
                        This Privacy Policy explains how <strong>Sudoku World</strong> (package:{' '}
                        <code>com.sudoku.app</code>) collects, uses, and shares information when you use the app.
                    </p>
                </section>

                <section className="card">
                    <h2>1. Information We Collect</h2>
                    <ul>
                        <li><strong>Gameplay Data:</strong> difficulty, game progress, score, streaks, statistics, settings.</li>
                        <li><strong>Device and Technical Data:</strong> device model, OS version, app version, language, approximate diagnostics.</li>
                        <li><strong>Crash and Performance Data:</strong> crash logs and diagnostics via Firebase Crashlytics.</li>
                        <li><strong>Analytics Data:</strong> app usage events via Firebase Analytics.</li>
                        <li><strong>Advertising Data:</strong> ad interactions and ad identifiers via Google AdMob.</li>
                        <li><strong>Purchase Data:</strong> purchase status (e.g. remove ads) via Google Play Billing.</li>
                        <li><strong>Play Games Data:</strong> leaderboard/achievement/cloud save data via Google Play Games Services.</li>
                    </ul>
                </section>

                    <section className="card">
                        <h2>2. How We Use Information</h2>
                        <ul>
                            <li>To provide core gameplay and save your progress.</li>
                            <li>To improve app stability and performance.</li>
                            <li>To provide leaderboards, achievements, and cloud sync features.</li>
                            <li>To show ads and measure ad performance.</li>
                            <li>To process and restore in-app purchases.</li>
                        </ul>
                    </section>

                    <section className="card">
                        <h2>3. Third-Party Services</h2>
                        <p>The app uses third-party services that may process data under their own privacy terms:</p>
                        <ul>
                            <li>Google Play Services: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">https://policies.google.com/privacy</a></li>
                            <li>Google AdMob: <a href="https://support.google.com/admob/answer/6128543" target="_blank" rel="noopener">https://support.google.com/admob/answer/6128543</a></li>
                            <li>Firebase (Analytics / Crashlytics): <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener">https://firebase.google.com/support/privacy</a></li>
                            <li>Google Play Billing: <a href="https://play.google.com/about/play-terms/" target="_blank" rel="noopener">https://play.google.com/about/play-terms/</a></li>
                        </ul>
                    </section>

                    <section className="card">
                        <h2>4. Data Retention</h2>
                        <p>
                            We retain data only as long as needed for app functionality, legal obligations, and legitimate business purposes.
                            Local game data remains on your device unless you uninstall the app or clear app data.
                        </p>
                    </section>

                    <section className="card">
                        <h2>5. Children&apos;s Privacy</h2>
                        <p>
                            The app is not directed to children under the age required by applicable law in your country.
                            If you believe a child has provided personal data, contact us and we will take reasonable steps.
                        </p>
                    </section>

                    <section className="card">
                        <h2>6. Your Rights</h2>
                        <p>
                            Depending on your location, you may have rights to access, correct, delete, or restrict processing of your personal data.
                            You can also reset ad identifiers from your device settings.
                        </p>
                    </section>

                    <section className="card">
                        <h2>7. Security</h2>
                        <p>
                            We take reasonable technical and organizational measures to protect data, but no method of transmission or storage is fully secure.
                        </p>
                    </section>

                    <section className="card">
                        <h2>8. Changes to This Policy</h2>
                        <p>
                            We may update this policy from time to time. The latest version will always be available on this page with the updated date.
                        </p>
                    </section>

                <section className="card">
                    <h2>9. Contact</h2>
                    <p>
                        For privacy questions, contact: <a href="mailto:privacy@recete.co.uk">privacy@recete.co.uk</a>
                    </p>
                </section>
            </main>
        </>
    );
}
