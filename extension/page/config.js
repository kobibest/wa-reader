// Runs in the page (MAIN world) BEFORE WA-JS loads.
// Turns off everything in WA-JS that talks to the outside world or changes the account.
window.WPPConfig = {
  deviceName: false,              // don't rename the linked device
  disableGoogleAnalytics: true,   // WA-JS ships with GA on by default – off
  googleAnalyticsId: null,
  googleAnalyticsUserProperty: {},
  // MUST be an empty array: WA-JS does `linkPreviewApiServers || [3 third-party servers]`, so null would enable them
  linkPreviewApiServers: [],
  poweredBy: null,
  sendStatusToDevice: false,
  syncAllStatus: false,
  liveLocationLimit: 0
};
