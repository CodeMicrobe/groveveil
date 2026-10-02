import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import NetInfo, {
  NetInfoState,
  NetInfoStateType,
} from "@react-native-community/netinfo";
import {
  mapNetInfoStateToConnectivity,
  getConnectivityState,
  getCachedConnectivityState,
  resetCachedConnectivityState,
  subscribeToConnectivity,
} from "../src/domain/connectivity.service";
import { OfflineBanner } from "../src/presentation/components/OfflineBanner";

vi.mock("react-native", () => ({
  View: (props: any) => ({ type: "View", props }),
  Text: (props: any) => ({ type: "Text", props }),
  StyleSheet: {
    create: (styles: any) => styles,
  },
}));

vi.mock("@react-native-community/netinfo", () => {
  return {
    default: {
      fetch: vi.fn(),
      addEventListener: vi.fn(),
    },
    NetInfoStateType: {
      unknown: "unknown",
      none: "none",
      cellular: "cellular",
      wifi: "wifi",
      bluetooth: "bluetooth",
      ethernet: "ethernet",
      wimax: "wimax",
      vpn: "vpn",
      other: "other",
    },
  };
});

describe("Native Connectivity Service & Abstraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCachedConnectivityState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("State Mapping & Normalization (mapNetInfoStateToConnectivity)", () => {
    it("reports usable network connectivity when connected and reachable on Wi-Fi", () => {
      const state: NetInfoState = {
        type: NetInfoStateType.wifi,
        isConnected: true,
        isInternetReachable: true,
        details: {
          isConnectionExpensive: false,
          ssid: "Groveveil-Mesh",
          bssid: "00:11:22:33:44:55",
          strength: 95,
          ipAddress: "192.168.1.100",
          subnet: "255.255.255.0",
          frequency: 5000,
          linkSpeed: 300,
          rxLinkSpeed: 300,
          txLinkSpeed: 300,
        },
      };

      const result = mapNetInfoStateToConnectivity(state);

      expect(result).toEqual({
        status: "connected",
        isConnected: true,
        isInternetReachable: true,
        connectionType: "wifi",
        isOffline: false,
      });
    });

    it("reports usable network connectivity on Cellular", () => {
      const state: NetInfoState = {
        type: NetInfoStateType.cellular,
        isConnected: true,
        isInternetReachable: true,
        details: {
          isConnectionExpensive: true,
          cellularGeneration: null,
          carrier: "GroveTel",
        },
      };

      const result = mapNetInfoStateToConnectivity(state);

      expect(result.status).toBe("connected");
      expect(result.isOffline).toBe(false);
      expect(result.connectionType).toBe("cellular");
    });

    it("treats connected state as usable if isInternetReachable is pending/null to avoid false offline alerts", () => {
      const state: NetInfoState = {
        type: NetInfoStateType.wifi,
        isConnected: true,
        isInternetReachable: null,
        details: {
          isConnectionExpensive: false,
          ssid: null,
          bssid: null,
          strength: null,
          ipAddress: null,
          subnet: null,
          frequency: null,
          linkSpeed: null,
          rxLinkSpeed: null,
          txLinkSpeed: null,
        },
      };

      const result = mapNetInfoStateToConnectivity(state);

      expect(result.status).toBe("connected");
      expect(result.isOffline).toBe(false);
    });

    it("reports disconnected when physical connection is down (e.g. Airplane mode or no signal)", () => {
      const state: NetInfoState = {
        type: NetInfoStateType.none,
        isConnected: false,
        isInternetReachable: false,
        details: null,
      };

      const result = mapNetInfoStateToConnectivity(state);

      expect(result).toEqual({
        status: "disconnected",
        isConnected: false,
        isInternetReachable: false,
        connectionType: "none",
        isOffline: true,
      });
    });

    it("distinguishes connected local link without internet access (captive portal) as no_internet", () => {
      const state: NetInfoState = {
        type: NetInfoStateType.wifi,
        isConnected: true,
        isInternetReachable: false,
        details: {
          isConnectionExpensive: false,
          ssid: "Hotel-WiFi",
          bssid: null,
          strength: 80,
          ipAddress: "10.0.0.5",
          subnet: "255.0.0.0",
          frequency: 2400,
          linkSpeed: 54,
          rxLinkSpeed: 54,
          txLinkSpeed: 54,
        },
      };

      const result = mapNetInfoStateToConnectivity(state);

      expect(result).toEqual({
        status: "no_internet",
        isConnected: true,
        isInternetReachable: false,
        connectionType: "wifi",
        isOffline: true,
      });
    });

    it("handles initial/unknown state without triggering a false offline state", () => {
      const unknownState: NetInfoState = {
        type: NetInfoStateType.unknown,
        isConnected: null,
        isInternetReachable: null,
        details: null,
      };

      const result = mapNetInfoStateToConnectivity(unknownState);

      expect(result).toEqual({
        status: "unknown",
        isConnected: null,
        isInternetReachable: null,
        connectionType: "unknown",
        isOffline: false,
      });
      // Crucial: isOffline must be false so the OfflineBanner does not flash on initial launch!
      expect(result.isOffline).toBe(false);
    });
  });

  describe("On-Demand Query (getConnectivityState)", () => {
    it("fetches native network state and updates cache", async () => {
      vi.mocked(NetInfo.fetch).mockResolvedValue({
        type: NetInfoStateType.wifi,
        isConnected: true,
        isInternetReachable: true,
        details: { isConnectionExpensive: false } as any,
      });

      const state = await getConnectivityState();

      expect(NetInfo.fetch).toHaveBeenCalledTimes(1);
      expect(state.status).toBe("connected");
      expect(state.isOffline).toBe(false);
      expect(getCachedConnectivityState()).toEqual(state);
    });

    it("returns cached fallback safely if NetInfo.fetch fails", async () => {
      vi.mocked(NetInfo.fetch).mockRejectedValue(new Error("Native NetInfo module unavailable"));

      const state = await getConnectivityState();

      expect(state).toEqual({
        status: "unknown",
        isConnected: null,
        isInternetReachable: null,
        connectionType: "unknown",
        isOffline: false,
      });
    });
  });

  describe("Listener Lifecycle & Subscriptions", () => {
    it("attaches native event listener and cleans up on unsubscribe", () => {
      const mockUnsubscribe = vi.fn();
      let registeredCallback: ((state: NetInfoState) => void) | undefined;

      vi.mocked(NetInfo.addEventListener).mockImplementation((callback) => {
        registeredCallback = callback;
        return mockUnsubscribe;
      });

      const subscriber = vi.fn();
      const unsubscribe = subscribeToConnectivity(subscriber);

      expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
      expect(registeredCallback).toBeDefined();

      // Simulate native event: connection lost
      registeredCallback!({
        type: NetInfoStateType.none,
        isConnected: false,
        isInternetReachable: false,
        details: null,
      });

      expect(subscriber).toHaveBeenCalledWith({
        status: "disconnected",
        isConnected: false,
        isInternetReachable: false,
        connectionType: "none",
        isOffline: true,
      });

      // Cleanup
      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it("updates cached state upon receiving real-time event updates", () => {
      let registeredCallback: ((state: NetInfoState) => void) | undefined;
      vi.mocked(NetInfo.addEventListener).mockImplementation((cb) => {
        registeredCallback = cb;
        return vi.fn();
      });

      subscribeToConnectivity(vi.fn());

      registeredCallback!({
        type: NetInfoStateType.cellular,
        isConnected: true,
        isInternetReachable: true,
        details: null as any,
      });

      expect(getCachedConnectivityState()).toEqual({
        status: "connected",
        isConnected: true,
        isInternetReachable: true,
        connectionType: "cellular",
        isOffline: false,
      });
    });
  });

  describe("OfflineBanner UI Component Behavior", () => {
    it("renders null when explicitly provided isOffline=false", () => {
      const element = OfflineBanner({ isOffline: false });
      expect(element).toBeNull();
    });

    it("renders warning banner alert when explicitly provided isOffline=true", () => {
      const element = OfflineBanner({ isOffline: true });
      expect(element).not.toBeNull();
      expect(React.isValidElement(element)).toBe(true);
    });

    it("renders connected container when no isOffline prop is provided", () => {
      const element = OfflineBanner({});
      expect(element).not.toBeNull();
      expect(React.isValidElement(element)).toBe(true);
    });
  });
});
