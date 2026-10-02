import NetInfo, {
  NetInfoState,
  NetInfoStateType,
  NetInfoSubscription,
} from "@react-native-community/netinfo";
import { useState, useEffect } from "react";

export type ConnectivityStatus =
  | "unknown"
  | "connected"
  | "disconnected"
  | "no_internet";

export interface ConnectivityState {
  status: ConnectivityStatus;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  connectionType: string;
  isOffline: boolean;
}

/**
 * Normalizes native NetInfoState into Groveveil domain-level ConnectivityState.
 *
 * Distinguishes between:
 * - "unknown": initial/undetermined state before native resolver answers (isOffline: false to prevent UI flash)
 * - "connected": active network connection with verified reachable internet (isOffline: false)
 * - "disconnected": no physical/wireless network connection (isOffline: true)
 * - "no_internet": connected to local link (e.g. Wi-Fi router / captive portal) but WAN internet is unreachable (isOffline: true)
 */
export function mapNetInfoStateToConnectivity(
  state: NetInfoState
): ConnectivityState {
  const isConnected = state.isConnected;
  const isInternetReachable = state.isInternetReachable;
  const connectionType = state.type ?? "unknown";

  // 1. Initial/Unknown state - not yet resolved by native module
  if (isConnected === null || connectionType === NetInfoStateType.unknown) {
    return {
      status: "unknown",
      isConnected: null,
      isInternetReachable: null,
      connectionType,
      isOffline: false,
    };
  }

  // 2. Disconnected - device has no network link
  if (isConnected === false || connectionType === NetInfoStateType.none) {
    return {
      status: "disconnected",
      isConnected: false,
      isInternetReachable: false,
      connectionType,
      isOffline: true,
    };
  }

  // 3. Connected to local link, but internet is explicitly unreachable (e.g. captive portal)
  if (isInternetReachable === false) {
    return {
      status: "no_internet",
      isConnected: true,
      isInternetReachable: false,
      connectionType,
      isOffline: true,
    };
  }

  // 4. Usable connection (isInternetReachable is true, or pending verification while connected)
  return {
    status: "connected",
    isConnected: true,
    isInternetReachable: isInternetReachable ?? true,
    connectionType,
    isOffline: false,
  };
}

let lastKnownState: ConnectivityState = {
  status: "unknown",
  isConnected: null,
  isInternetReachable: null,
  connectionType: "unknown",
  isOffline: false,
};

/**
 * Returns the last known cached connectivity state synchronously.
 */
export function getCachedConnectivityState(): ConnectivityState {
  return lastKnownState;
}

/**
 * Resets the in-memory cached state (useful for test isolation).
 */
export function resetCachedConnectivityState(): void {
  lastKnownState = {
    status: "unknown",
    isConnected: null,
    isInternetReachable: null,
    connectionType: "unknown",
    isOffline: false,
  };
}

/**
 * Fetches the current native connectivity state on demand.
 */
export async function getConnectivityState(): Promise<ConnectivityState> {
  try {
    const netState = await NetInfo.fetch();
    lastKnownState = mapNetInfoStateToConnectivity(netState);
    return lastKnownState;
  } catch {
    return lastKnownState;
  }
}

/**
 * Subscribes to real-time native connectivity changes.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToConnectivity(
  listener: (state: ConnectivityState) => void
): () => void {
  const unsubscribe: NetInfoSubscription = NetInfo.addEventListener(
    (netState: NetInfoState) => {
      const mapped = mapNetInfoStateToConnectivity(netState);
      lastKnownState = mapped;
      listener(mapped);
    }
  );

  return () => {
    unsubscribe();
  };
}

/**
 * React hook for consuming connectivity state.
 * Encapsulates subscription lifecycle and cleans up listeners on unmount.
 * Prevents initial state flicker by defaulting isOffline to false during unknown state.
 */
export function useConnectivity(): ConnectivityState {
  const [connectivity, setConnectivity] = useState<ConnectivityState>(
    getCachedConnectivityState
  );

  useEffect(() => {
    let isMounted = true;

    // Refresh current state on mount
    getConnectivityState().then((state) => {
      if (isMounted) {
        setConnectivity(state);
      }
    });

    // Subscribe to native updates
    const unsubscribe = subscribeToConnectivity((state) => {
      if (isMounted) {
        setConnectivity(state);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return connectivity;
}
