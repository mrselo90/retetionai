'use client';

/**
 * ShopifySaveBar — BFS 4.1.5 Contextual Save Bar
 *
 * When the app is embedded in Shopify Admin, this renders an App Bridge
 * <s-save-bar> that sticks to the top of the page and shows Save/Discard.
 * When standalone, returns null (inline Save buttons handle this instead).
 */
import { useEffect, useRef } from 'react';
import { isShopifyEmbedded } from '@/lib/shopifyEmbedded';

interface ShopifySaveBarProps {
    id: string;
    isDirty: boolean;
    onSave: () => void | Promise<void>;
    onDiscard: () => void;
    saveLabel?: string;
    discardLabel?: string;
}

type SaveBarElement = HTMLElement & {
    show: () => void;
    hide: () => void;
};

export function ShopifySaveBar({
    id,
    isDirty,
    onSave,
    onDiscard,
    saveLabel = 'Save',
    discardLabel = 'Discard',
}: ShopifySaveBarProps) {
    const ref = useRef<SaveBarElement>(null);

    useEffect(() => {
        if (!ref.current) return;
        if (isDirty) {
            ref.current.show?.();
        } else {
            ref.current.hide?.();
        }
    }, [isDirty]);

    if (!isShopifyEmbedded()) return null;

    return (
        /* @ts-expect-error - App Bridge web component */
        <s-save-bar id={id} ref={ref as React.Ref<HTMLElement>}>
            <button
                // @ts-expect-error — App Bridge web component slot attribute
                variant="primary"
                slot="primary-action"
                onClick={onSave}
            >
                {saveLabel}
            </button>
            <button slot="secondary-action" onClick={onDiscard}>
                {discardLabel}
            </button>
            {/* @ts-expect-error - App Bridge web component */}
        </s-save-bar>
    );
}
