document.addEventListener("DOMContentLoaded", () => {
  const els = {
    loginSection: document.getElementById("loginSection"),
    codeSection: document.getElementById("codeSection"),
    emailInput: document.getElementById("emailInput"),
    sendCodeBtn: document.getElementById("sendCodeBtn"),
    emailError: document.getElementById("emailError"),
    codeInput: document.getElementById("codeInput"),
    verifyCodeBtn: document.getElementById("verifyCodeBtn"),
    resendCodeBtn: document.getElementById("resendCodeBtn"),
    codeError: document.getElementById("codeError"),
    codeInstruction: document.getElementById("codeInstruction"),

    startSection: document.getElementById("startSection"),
    loadingSection: document.getElementById("loadingSection"),
    resultsSection: document.getElementById("resultsSection"),
    errorSection: document.getElementById("errorSection"),
    
    // History Elements
    historySection: document.getElementById("historySection"),
    historyList: document.getElementById("historyList"),
    historyBtn: document.getElementById("historyBtn"),
    backFromHistoryBtn: document.getElementById("backFromHistoryBtn"),

    controls: document.getElementById("controls"),
    
    startBtn: document.getElementById("startBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    resetBtn: document.getElementById("resetBtn"),
    logoutBtn: document.getElementById("logoutBtn"),

    videoBody: document.getElementById("videoBody"),
    commentBody: document.getElementById("commentBody"),
    loadingText: document.getElementById("loadingText"),
    errorText: document.getElementById("errorText")
  };

  let userEmail = null;
  let pendingEmail = null;
  let isViewingHistory = false; // NEW FLAG: Pauses auto-refresh when true

  // 1. Initial Check
  chrome.storage.local.get("userEmail", (data) => {
      if (data.userEmail) {
          userEmail = data.userEmail;
          // Load whatever state was last active (results, loading, or start)
          chrome.storage.local.get(null, (fullData) => render(fullData));
      } else {
          render({ status: "login" });
      }
  });

  // 2. Poll storage for UI updates
  setInterval(() => {
    // STOP polling if we are entering code OR viewing history
    if (!pendingEmail && !isViewingHistory) {
        chrome.storage.local.get(null, (data) => render(data));
    }
  }, 1000);

  // --- LISTENERS ---
  els.sendCodeBtn.addEventListener("click", () => sendVerificationCode(els, userEmail));
  els.verifyCodeBtn.addEventListener("click", () => verifyCode(els));
  els.resendCodeBtn.addEventListener("click", () => sendVerificationCode(els, pendingEmail, true));
  
  els.startBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id || !userEmail) {
          render({ status: "error", message: "Login required." });
          return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "GET_VIDEO_ID" }, (res) => {
        if (res && res.videoId) {
          render({ status: "loading", message: "Connecting to Pipeline..." });
          chrome.runtime.sendMessage({ 
              action: "START_PIPELINE", 
              videoId: res.videoId, 
              userEmail: userEmail 
          });
        } else {
          render({ status: "error", message: "No YouTube video found." });
        }
      });
    });
  });

  els.refreshBtn.addEventListener("click", () => {
    const oldHtml = els.refreshBtn.innerHTML;
    els.refreshBtn.innerHTML = "⏳";
    chrome.storage.local.get("videoId", (data) => {
      if (data.videoId) chrome.runtime.sendMessage({ action: "CHECK_STATUS", videoId: data.videoId });
    });
    setTimeout(() => els.refreshBtn.innerHTML = oldHtml, 1000);
  });

  // --- RESET: Clears Video Data ONLY ---
  els.resetBtn.addEventListener("click", () => {
      isViewingHistory = false;
      chrome.storage.local.remove(["status", "message", "videoId", "video_summary", "comment_summary"], () => {
          render({ status: "start" });
      });
  });

  // --- LOGOUT: Clears User Session ---
  els.logoutBtn.addEventListener("click", () => {
      userEmail = null;
      pendingEmail = null;
      isViewingHistory = false;
      chrome.storage.local.clear(() => {
          chrome.runtime.sendMessage({ action: "RESET" });
          render({ status: "login" });
      });
  });

  // --- HISTORY BUTTON ---
  els.historyBtn.addEventListener("click", () => loadHistory());
  
  // --- BACK BUTTON FIX ---
  els.backFromHistoryBtn.addEventListener("click", () => {
      isViewingHistory = false; // Un-pause the refresher
      
      // Fetch the REAL state from storage (e.g., results, loading, or start)
      chrome.storage.local.get(null, (data) => {
          // If data is empty/missing, default to start, otherwise show the saved state
          if (!data.status) {
              render({ status: "start" });
          } else {
              render(data);
          }
      });
  });
  
  // --- HELPERS ---

  function loadHistory() {
      if (!userEmail) return;
      
      isViewingHistory = true; // Pause the auto-refresher
      
      // Show History UI immediately without touching Storage
      render({ status: "history_custom" }); 
      els.historySection.classList.remove("hidden");
      els.startSection.classList.add("hidden"); 
      els.historyList.innerHTML = '<div style="text-align:center; padding:20px;">Loading...</div>';

      chrome.runtime.sendMessage({ 
          action: "GET_HISTORY", 
          email: userEmail 
      }, (response) => {
          els.historyList.innerHTML = "";
          
          if (response && response.history && response.history.length > 0) {
              response.history.forEach(item => {
                  const div = document.createElement("div");
                  div.className = "history-item";
                  div.innerHTML = `
                      <div class="h-vid">Video ID: ${item.video_id}</div>
                      <div class="h-date">${item.last_accessed || "Recent"}</div>
                  `;
                  div.addEventListener("click", () => {
                      // On click, we ARE changing state, so turn off history mode
                      isViewingHistory = false;
                      
                      chrome.storage.local.set({
                          status: "loading",
                          message: "Retrieving result...",
                          videoId: item.video_id,
                          video_summary: null,
                          comment_summary: null
                      }, () => {
                          chrome.runtime.sendMessage({ action: "CHECK_STATUS", videoId: item.video_id });
                      });
                  });
                  els.historyList.appendChild(div);
              });
          } else {
              els.historyList.innerHTML = '<div style="text-align:center; color:#94a3b8;">No history found.</div>';
          }
      });
  }

  function sendVerificationCode(els, currentEmail, isResend = false) {
      const email = isResend ? (pendingEmail || currentEmail) : els.emailInput.value;
      
      if (!email || !email.includes('@')) {
          els.emailError.innerText = "Please enter a valid email.";
          els.emailError.classList.remove("hidden");
          return;
      }
      els.emailError.classList.add("hidden");
      
      const btn = isResend ? els.resendCodeBtn : els.sendCodeBtn;
      btn.disabled = true;
      btn.innerHTML = isResend ? "Resending..." : "Sending...";
      
      chrome.runtime.sendMessage({ action: "SEND_AUTH_CODE", email: email }, (response) => {
          btn.disabled = false;
          btn.innerHTML = isResend ? "Resend Code" : '<span class="label">Send Verification Code</span>';

          if (response.success) {
              pendingEmail = email; 
              els.codeInstruction.innerText = `Enter the 6-digit code sent to ${email}.`;
              render({ status: "code" });
          } else {
              els.emailError.innerText = response.message || "Failed to send code.";
              els.emailError.classList.remove("hidden");
          }
      });
  }

  function verifyCode(els) {
      const code = els.codeInput.value;
      if (code.length !== 6 || !/^\d+$/.test(code)) {
          els.codeError.innerText = "Code must be 6 digits.";
          els.codeError.classList.remove("hidden");
          return;
      }
      els.codeError.classList.add("hidden");
      els.verifyCodeBtn.disabled = true;
      els.verifyCodeBtn.innerHTML = "Verifying...";

      chrome.runtime.sendMessage({
          action: "VERIFY_AUTH_CODE",
          email: pendingEmail,
          code: code
      }, (response) => {
          els.verifyCodeBtn.disabled = false;
          els.verifyCodeBtn.innerHTML = '<span class="label">Verify & Continue</span>';

          if (response.success) {
              userEmail = pendingEmail;
              pendingEmail = null;
              chrome.storage.local.set({ userEmail: userEmail });
              render({ status: "start" });
          } else {
              els.codeError.innerText = response.message || "Invalid code.";
              els.codeError.classList.remove("hidden");
          }
      });
  }

  function render(data) {
    let currentView = data.status;
    
    // If viewing history locally, don't let data override it unless we explicitly allow it
    if (isViewingHistory) {
        currentView = "history_custom"; 
    }
    else if (currentView === "history_custom") {
        // Fallback if data contains the old tag, but flag is off
        currentView = "start"; 
    }

    if (!currentView) {
        if (userEmail) currentView = "start";
        else if (pendingEmail) currentView = "code"; 
        else currentView = "login";
    }
    
    const allViews = ["login", "code", "start", "loading", "results", "error", "history"];
    
    allViews.forEach(v => {
      const el = document.getElementById(v + "Section");
      if (el) el.classList.add("hidden");
    });

    const targetEl = document.getElementById(currentView === "history_custom" ? "historySection" : currentView + "Section");
    if (targetEl) targetEl.classList.remove("hidden");

    // Controls Logic
    const showControls = ["start", "results", "loading", "error", "history_custom"].includes(currentView);
    els.controls.classList.toggle("hidden", !showControls);
    
    // Fill Data
    if (currentView === "loading") {
      els.loadingText.innerText = data.message || "Working...";
    } 
    else if (currentView === "error") {
      els.errorText.innerText = data.message;
    } 
    else if (currentView === "results") {
      if (data.video_summary && data.video_summary !== els.videoBody.getAttribute('data-raw')) { 
        els.videoBody.innerHTML = formatText(data.video_summary);
        els.videoBody.setAttribute('data-raw', data.video_summary);
        els.commentBody.innerHTML = formatText(data.comment_summary);
      }
    }
  }

  function formatText(text) {
    if (!text) return "No data available.";
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:white;">$1</strong>')
      .replace(/### (.*?)\n/g, '')
      .replace(/\n/g, "<br>");
  }
});