document.getElementById("summarizeBtn").addEventListener("click", () => {
  const resultDiv = document.getElementById("result");
  resultDiv.textContent = "⏳ Getting video ID...";

  // Get current active tab (YouTube video)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      resultDiv.textContent = "❌ No active tab found.";
      return;
    }

    const tabId = tabs[0].id;

    // Ask content script for the video ID
    chrome.tabs.sendMessage(tabId, { action: "GET_VIDEO_ID" }, async (response) => {
      // Handle case where content script is not loaded
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        resultDiv.textContent =
          "❌ Could not talk to the YouTube page.\n\n" +
          "Make sure:\n" +
          "• You are on a YouTube video page (with ?v=...)\n" +
          "• Then click the extension again.";
        return;
      }

      const videoId = response && response.videoId;

      if (!videoId) {
        resultDiv.textContent = "❌ No YouTube video detected (missing ?v= parameter).";
        return;
      }

      resultDiv.textContent = "⏳ Summarizing via pipeline...";

      try {
        const res = await fetch("http://127.0.0.1:8000/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_id: videoId })
        });

        if (!res.ok) {
          console.error("Backend returned status:", res.status);
          throw new Error("Backend error: " + res.status);
        }

        const data = await res.json();

        const videoSummary = data.video_summary || "No video summary returned.";
        const commentsSummary = data.comments_summary || "No comments summary returned.";

        resultDiv.innerHTML =
          "<b>Video Summary:</b><br>" +
          videoSummary +
          "<br><br><b>Comments Summary:</b><br>" +
          commentsSummary;
      } catch (err) {
        console.error(err);
        resultDiv.textContent = "❌ Pipeline API not running or unreachable.";
      }
    });
  });
});
