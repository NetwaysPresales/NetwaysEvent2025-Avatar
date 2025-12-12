import React from 'react';

type Props = {
    theme?: 'dark' | 'light';
};

export const OverlayBackground = ({ theme = 'dark' }: Props) => (
    <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div
            className="absolute inset-0"
            style={{
                background: theme === 'light'
                    ? 'radial-gradient(ellipse at 50% 85%, #10b98144 0%, #10b98122 35%, #10b98111 70%, transparent 100%)'
                    : 'radial-gradient(ellipse at 50% 85%, #19D6A722 0%, #10B98111 35%, #10B98105 70%, transparent 100%)',
            }}
        />
    </div>
);
