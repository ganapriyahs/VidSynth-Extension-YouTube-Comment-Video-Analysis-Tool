// REPLACE WITH YOUR GATEWAY URL
const GATEWAY_BASE = "YOUR_GATEWAY_URL"; 

// 1. Open Side Panel
chrome.action.onClicked.addListener((tab) => {
  if (chrome.sidePanel && chrome.sidePanel.open) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// 2. Handle Messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // --- AUTHENTICATION ACTIONS ---
  if (request.action === "SEND_AUTH_CODE") {
    sendAuthCode(request.email).then(sendResponse);
    return true; 
  }
  if (request.action === "VERIFY_AUTH_CODE") {
    verifyAuthCode(request.email, request.code).then(sendResponse);
    return true; 
  }

  // --- PIPELINE ACTIONS ---
  if (request.action === "START_PIPELINE") {
    startPipeline(request.videoId, request.userEmail); 
    sendResponse({ status: "started" });
  }
  if (request.action === "CHECK_STATUS") {
    checkResult(request.videoId);
    sendResponse({ status: "checking" });
  }
  if (request.action === "RESET") {
    chrome.storage.local.get("userEmail", (data) => {
      const email = data.userEmail;
      chrome.storage.local.clear(() => {
        if (email) chrome.storage.local.set({ userEmail: email }); 
        chrome.alarms.clearAll();
        sendResponse({ status: "cleared" });
      });
    });
    return true;
  }

  // --- NEW: HISTORY ACTION ---
  if (request.action === "GET_HISTORY") {
    fetch(`${GATEWAY_BASE}/history?email=${request.email}`)
      .then(res => res.json())
      .then(data => sendResponse(data))
      .catch(() => sendResponse({ history: [] }));
    return true;
  }

  return true;
});

// 3. Auto-Refresh Alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("poll_")) {
    const videoId = alarm.name.split("_")[1];
    checkResult(videoId);
  }
});

// --- AUTHENTICATION IMPLEMENTATION ---
async function sendAuthCode(email) {
    try {
        const response = await fetch(`${GATEWAY_BASE}/auth/send`, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        return { success: response.ok, message: data.message };
    } catch (err) {
        return { success: false, message: "Network error. Check Gateway URL." };
    }
}

async function verifyAuthCode(email, code) {
    try {
        const response = await fetch(`${GATEWAY_BASE}/auth/verify`, {
            method: "POST", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code })
        });
        const data = await response.json();
        return { success: response.ok && data.verified, message: data.message };
    } catch (err) {
        return { success: false, message: "Network error. Check Gateway URL." };
    }
}

// --- PIPELINE IMPLEMENTATION ---
async function startPipeline(videoId, userEmail) {
  try {
    await updateStatus("loading", "⏳ Connecting to Pipeline...", videoId);
    
    const response = await fetch(`${GATEWAY_BASE}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId, user_email: userEmail }) 
    });

    if (!response.ok) throw new Error(`Gateway Error: ${response.status}`);
    
    await updateStatus("loading", "🚀 Analyzing Video Content...", videoId);
    
    chrome.alarms.create(`poll_${videoId}`, { periodInMinutes: 0.1 });

  } catch (err) {
    console.error(err);
    await updateStatus("error", "❌ Connection Failed: " + err.message, videoId);
  }
}

async function checkResult(videoId) {
  try {
    const response = await fetch(`${GATEWAY_BASE}/result/${videoId}`);
    const json = await response.json();

    // Check if the job is done
    if (json.status === "ready" || json.video_summary || (json.data && json.data.video_summary)) {
      
      chrome.alarms.clear(`poll_${videoId}`);
      
      let v_sum = "Summary unavailable.";
      let c_sum = "Sentiment unavailable.";

      // Robust Parsing Logic
      if (json.data && json.data.video_summary) {
        v_sum = json.data.video_summary;
        c_sum = json.data.comment_summary;
      } 
      else if (json.video_summary) {
        v_sum = json.video_summary;
        c_sum = json.comment_summary;
      }

      await chrome.storage.local.set({
        status: "results",
        video_summary: v_sum,
        comment_summary: c_sum,
        videoId: videoId
      });
    }
  } catch (e) {
    console.error("Polling error", e);
  }
}

async function updateStatus(status, message, videoId) {
  await chrome.storage.local.set({ status, message, videoId });
}