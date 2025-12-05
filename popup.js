document.addEventListener("DOMContentLoaded", () => {
  const elements = {
    resultDiv: document.getElementById("result"),
    startBtn: document.getElementById("startBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    resetBtn: document.getElementById("resetBtn"),
    controls: document.getElementById("controls")
  };

  // 1. Load saved state immediately
  chrome.storage.local.get(null, (data) => render(data));

  // 2. Listen for updates from background script
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      chrome.storage.local.get(null, (data) => render(data));
    }
  });

  // --- BUTTON ACTIONS ---

  // Start Analysis
  elements.startBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "GET_VIDEO_ID" }, (res) => {
        if (res && res.videoId) {
          chrome.runtime.sendMessage({ action: "START_PIPELINE", videoId: res.videoId });
        } else {
          elements.resultDiv.innerHTML = "<div class='error'>❌ No YouTube video found.</div>";
        }
      });
    });
  });

  // Manual Refresh (Force Check)
  elements.refreshBtn.addEventListener("click", () => {
    chrome.storage.local.get("videoId", (data) => {
      if (data.videoId) {
        elements.refreshBtn.innerText = "Checking...";
        chrome.runtime.sendMessage({ action: "CHECK_STATUS", videoId: data.videoId });
        setTimeout(() => elements.refreshBtn.innerText = "🔄 Refresh Status", 1000);
      }
    });
  });

  // Reset / Clear
  elements.resetBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "RESET" });
  });

  // --- RENDER UI ---
  function render(data) {
    // 1. Idle State
    if (!data.status) {
      elements.startBtn.style.display = "block";
      elements.controls.style.display = "none";
      elements.resultDiv.innerHTML = "";
      return;
    }

    // 2. Active State
    elements.startBtn.style.display = "none";
    elements.controls.style.display = "flex";

    if (data.status === "loading") {
      elements.resultDiv.innerHTML = `
        <div class="loader"></div>
        <div class="status-text">${data.message}</div>
      `;
    } else if (data.status === "error") {
      elements.resultDiv.innerHTML = `<div class="error">${data.message}</div>`;
    } else if (data.status === "success") {
      elements.resultDiv.innerHTML = `
        <div class="card">
          <h4>🎥 Video Summary</h4>
          <div class="content">${formatText(data.video_summary)}</div>
        </div>
        <div class="card">
          <h4>💬 User Comments</h4>
          <div class="content">${formatText(data.comment_summary)}</div>
        </div>
      `;
    }
  }

  function formatText(text) {
    return text ? text.replace(/\n/g, "<br>") : "No data available.";
  }
});