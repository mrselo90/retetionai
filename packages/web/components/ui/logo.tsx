import React from 'react';
import Image from 'next/image';

interface LogoProps {
    theme?: 'light' | 'dark';
    iconOnly?: boolean;
    className?: string;
}

export function Logo({ theme = 'light', iconOnly = false, className = '' }: LogoProps) {
    const isDark = theme === 'dark';
    const textColor = isDark ? 'text-[#F8F5E6]' : 'text-[#0A3D2E]';
    const width = iconOnly ? 48 : 48; // Ensure consistent height for the icon

    return (
        <div className={`flex items-center gap-2.5 ${className}`}>
            <Image
                src="/assets/logo.png"
                alt="Recete Logo"
                width={width}
                height={width}
                className="object-contain drop-shadow-sm rounded-lg"
                priority
            />
            {!iconOnly && (
                <span
                    style={{
                        fontFamily: "'Playfair Display', 'Georgia', 'Times New Roman', serif",
                        letterSpacing: "-0.02em"
                    }}
                    className={`font-bold text-2xl ${textColor}`}
                >
                    recete
                </span>
            )}
        </div>
    );
}
