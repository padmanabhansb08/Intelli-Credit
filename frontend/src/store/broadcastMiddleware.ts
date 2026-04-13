import { StateCreator, StoreApi, StoreMutatorIdentifier } from 'zustand';

type SetState<T> = StoreApi<T>['setState'];

export const broadcast = <T>(
    channelName: string,
    config: StateCreator<T>
): StateCreator<T> => (set, get, api) => {
    const isClient = typeof window !== 'undefined';
    let channel: BroadcastChannel | null = null;
    let isSyncingFromRemote = false;

    if (isClient) {
        try {
            channel = new BroadcastChannel(channelName);
        } catch (e) {
            console.warn('BroadcastChannel not supported', e);
        }
    }

    // Intercept the native set function
    const modifiedSet: typeof set = (...args: any[]) => {
        // Apply state locally
        (set as any)(...args);

        // If it's a remote sync triggered by the network, do not bounce the event back out
        if (isSyncingFromRemote) return;

        if (channel) {
            const state = get();

            // Serialize state (ignores functions implicitly via JSON.stringify)
            try {
                const payload = JSON.parse(JSON.stringify(state));
                channel.postMessage({ type: 'intelli-credit/SYNC_STATE', payload });
            } catch (e) {
                console.warn('BroadcastMiddleware: Failed to serialize state payload', e);
            }
        }
    };

    // We patch api.setState as well in case components use useStore.setState() externally
    api.setState = (...args: any[]) => {
        (modifiedSet as any)(...args);
    };

    // Listen for remote sync events
    if (channel) {
        channel.onmessage = (event) => {
            if (event.data?.type === 'intelli-credit/SYNC_STATE') {
                isSyncingFromRemote = true;
                try {
                    (set as any)(event.data.payload, true);
                } finally {
                    isSyncingFromRemote = false;
                }
            }
        };
    }

    return config(modifiedSet, get, api);
};
