chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "GET_VIDEO_ID") {
    const params = new URLSearchParams(window.location.search);
    sendResponse({ videoId: params.get("v") });
  }
});