// REPLACE WITH YOUR GATEWAY URL
const GATEWAY_BASE = "YOUR_GATEWAY_URL"
// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_PIPELINE") {
    startPipeline(request.videoId);
    sendResponse({ status: "started" });
  }
  if (request.action === "CHECK_STATUS") {
    checkResult(request.videoId); // Manual check
    sendResponse({ status: "checking" });
  }
  if (request.action === "RESET") {
    chrome.storage.local.clear();
    sendResponse({ status: "cleared" });
  }
  return true;
});

async function startPipeline(videoId) {
  try {
    // 1. Trigger Gateway
    await updateStatus("loading", "Connecting to Cloud...", videoId);
    
    const response = await fetch(`${GATEWAY_BASE}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId })
    });

    if (!response.ok) throw new Error(`Gateway Error: ${response.status}`);
    
    await updateStatus("loading", "Pipeline Started! Checking for results...", videoId);

    // 2. Start Polling
    startPolling(videoId);

  } catch (err) {
    console.error(err);
    await updateStatus("error", "Failed to start: " + err.message, videoId);
  }
}

function startPolling(videoId) {
  const startTime = Date.now();
  
  // Poll every 10 seconds
  const intervalId = setInterval(async () => {
    // Stop after 15 mins
    if (Date.now() - startTime > 900000) {
      clearInterval(intervalId);
      await updateStatus("error", "Timed out. Click 'Refresh' to try again.", videoId);
      return;
    }
    
    await checkResult(videoId, intervalId);
  }, 10000);
}

async function checkResult(videoId, intervalId = null) {
  try {
    const response = await fetch(`${GATEWAY_BASE}/result/${videoId}`);
    const json = await response.json();

    if (json.status === "ready") {
      if (intervalId) clearInterval(intervalId); // Stop polling
      
      // SAVE RESULT TO STORAGE
      await chrome.storage.local.set({
        status: "success",
        video_summary: json.data.video_summary,
        comment_summary: json.data.comment_summary,
        videoId: videoId
      });
    }
  } catch (e) {
    console.error("Check failed:", e);
  }
}

async function updateStatus(status, message, videoId) {
  await chrome.storage.local.set({ status, message, videoId });
}