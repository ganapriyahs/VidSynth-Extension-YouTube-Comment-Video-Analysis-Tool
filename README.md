# VidSynth: YouTube Video & Sentiment Analysis Tool (Group 7)

**Watch the Demo Video:**
[![VidSynth Demo](https://img.youtube.com/vi/EaZHgtlxTGY/0.jpg)](https://www.youtube.com/watch?v=EaZHgtlxTGY)

# VidSynth Chrome Extension

This is the client-side browser extension for **VidSynth**, an AI-powered YouTube video and sentiment analysis tool built by **Group 7**.

It lives in the browser side panel and connects to our Google Cloud microservices to securely authenticate users, trigger analysis pipelines, and display results instantly.

## Installation

1.  **Download** or clone this repository to your computer.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Toggle **Developer mode** on in the top right corner.
4.  Click **Load unpacked**.
5.  Select the folder containing these files.

## How to Use

1.  Navigate to any YouTube video you want to analyze.
2.  Click the **VidSynth icon** in your browser toolbar (pin it for easy access).
3.  **Login:** Enter your email to receive a secure verification code via SMTP.
4.  **Analyze:** Click the **"Start Analysis"** button.
5.  **Results:** The extension will poll our backend and display the **Video Summary** and **Viewer Sentiment** once processing is complete.

## Main Architecture

This repository contains only the frontend code. For the complete backend architecture, including the Airflow pipeline, FastAPI microservices, and LLM integration, please verify our main repository:

**[VidSynth Main Repository (Backend & Pipeline)](https://github.com/ganapriyahs/VidSynth-YouTube-Comment-Video-Analysis-Tool)**
