'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Mail, Github, Twitter, Linkedin } from 'lucide-react';

export function Footer() {
    const t = useTranslations('Landing.footer');
    const currentYear = new Date().getFullYear();

    return (
        <footer className="border-t border-border bg-card">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                    <div className="col-span-1 md:col-span-1">
                        <Link href="/" className="inline-flex items-center gap-2.5 font-bold text-foreground text-xl mb-4">
                            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                                <span className="text-lg font-extrabold">R</span>
                            </div>
                            Recete
                        </Link>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                            {t('description')}
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold text-foreground mb-4">{t('product')}</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="#features" className="hover:text-primary transition-colors">{t('features')}</Link></li>
                            <li><Link href="#how-it-works" className="hover:text-primary transition-colors">{t('howItWorks')}</Link></li>
                            <li><Link href="/pricing" className="hover:text-primary transition-colors">{t('pricing')}</Link></li>
                            <li><Link href="/demo" className="hover:text-primary transition-colors">{t('demo')}</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-foreground mb-4">{t('company')}</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/about" className="hover:text-primary transition-colors">{t('about')}</Link></li>
                            <li><Link href="/blog" className="hover:text-primary transition-colors">{t('blog')}</Link></li>
                            <li><Link href="/careers" className="hover:text-primary transition-colors">{t('careers')}</Link></li>
                            <li><a href={`mailto:${t('contact')}`} className="hover:text-primary transition-colors">{t('contact')}</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-foreground mb-4">{t('legal')}</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="/privacy-policy" className="hover:text-primary transition-colors">{t('privacy')}</Link></li>
                            <li><Link href="/terms-of-service" className="hover:text-primary transition-colors">{t('terms')}</Link></li>
                            <li><Link href="/cookies" className="hover:text-primary transition-colors">{t('cookies')}</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground order-2 md:order-1">
                        &copy; {currentYear} Recete AI. {t('copyright')}
                    </p>

                    <div className="flex items-center gap-4 order-1 md:order-2">
                        <a href="#" className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" aria-label="Twitter">
                            <Twitter className="w-5 h-5" />
                        </a>
                        <a href="#" className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" aria-label="GitHub">
                            <Github className="w-5 h-5" />
                        </a>
                        <a href="#" className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" aria-label="LinkedIn">
                            <Linkedin className="w-5 h-5" />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
