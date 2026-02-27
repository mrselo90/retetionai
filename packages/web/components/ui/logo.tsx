import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
    theme?: 'light' | 'dark';
    iconOnly?: boolean;
}

export function Logo({ theme = 'light', iconOnly = false, className, ...props }: LogoProps) {
    const isDark = theme === 'dark';
    const textColor = isDark ? '#F8F5E6' : '#0A3D2E';

    // 420x120 for full logo, 140x120 for icon only
    const viewBox = iconOnly ? "0 0 140 120" : "0 0 420 120";
    const width = iconOnly ? "140" : "420";

    return (
        <svg
            viewBox={viewBox}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width={width}
            height="120"
            className={className}
            {...props}
        >
            <defs>
                {/* Emerald Gold Gradient */}
                <linearGradient id="emeraldGold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0A3D2E" />
                    <stop offset="35%" stopColor="#147c5d" />
                    <stop offset="100%" stopColor={isDark ? "#C5A866" : "#B3934A"} />
                </linearGradient>
                {/* Deep Green Shadow Gradient */}
                <linearGradient id="deepGreen" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#06291F" />
                    <stop offset="100%" stopColor="#0A3D2E" />
                </linearGradient>
            </defs>

            <g transform="translate(15, 10)">
                {/* Back Loop (Shadowed) */}
                <path
                    d="M 40,85 C 10,85 10,35 35,25 C 55,15 65,35 55,55"
                    fill="none"
                    stroke={isDark ? "url(#deepGreen)" : "#06291F"}
                    strokeWidth="18"
                    strokeLinecap="round"
                />

                {/* Main Stem & Right Bowl */}
                <path
                    d="M 45,75 C 45,15 70,5 95,15 C 120,25 120,60 95,75 C 70,90 45,70 55,50"
                    fill="none"
                    stroke="#127053"
                    strokeWidth="18"
                    strokeLinecap="round"
                />

                {/* Sweeping Golden Leg Overlap */}
                <path
                    d="M 65,60 C 85,85 100,95 125,95"
                    fill="none"
                    stroke="url(#emeraldGold)"
                    strokeWidth="18"
                    strokeLinecap="round"
                />
            </g>

            {!iconOnly && (
                <text
                    x="160"
                    y="86"
                    fontFamily="'Playfair Display', 'Georgia', 'Times New Roman', serif"
                    fontWeight="bold"
                    fontSize="76"
                    letterSpacing="-0.02em"
                    fill={textColor}
                >
                    recete
                </text>
            )}
        </svg>
    );
}
