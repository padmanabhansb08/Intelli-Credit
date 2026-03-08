import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

export const useTabSync = () => {
    const isEnabled = typeof window !== 'undefined';

    useEffect(() => {
        if (!isEnabled) return;

        // Create a listener specific to this browser tab instance
        const channel = new BroadcastChannel('intelli-credit-state-sync');

        channel.onmessage = (event) => {
            if (event.data?.type === 'intelli-credit/SYNC_STATE') {
                const remoteState = event.data.payload;
                // Inject remote state bypassing the middleware broadcast outward
                useStore.getState().__syncState(remoteState);
            }
        };

        // Strict Cleanup avoiding memory leaks on hot-reloads/unmounts
        return () => {
            channel.close();
        };
    }, [isEnabled]);
};
