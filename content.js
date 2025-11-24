function getVideoId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("v");
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "GET_VIDEO_ID") {
    const videoId = getVideoId();
    sendResponse({ videoId: videoId });
  }
});
