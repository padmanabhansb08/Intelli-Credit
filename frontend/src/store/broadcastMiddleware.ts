import { StateCreator } from 'zustand';

export const broadcast = <T>(
    channelName: string,
    config: StateCreator<T>
): StateCreator<T> => (set, get, api) => {
    const isClient = typeof window !== 'undefined';
    let channel: BroadcastChannel | null = null;

    if (isClient) {
        try {
            channel = new BroadcastChannel(channelName);
        } catch (e) {
            console.warn('BroadcastChannel not supported', e);
        }
    }

    // Intercept the native set function
    const modifiedSet: typeof set = (partial: any, replace?: any, isRemoteSync?: boolean) => {
        // Apply state locally
        set(partial, replace);

        // If it's a remote sync triggered by the network, do not bounce the event back out
        if (isRemoteSync) return;

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
    const originalSetState = api.setState;
    api.setState = (partial: any, replace?: any) => {
        modifiedSet(partial as T, replace as boolean, false);
    };

    return config(modifiedSet, get, api);
};
