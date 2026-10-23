// src/app.js
// Main entry point orchestrating all OS simulation modules

import { KernelTerminal } from "./terminal.js";
import { CPUSchedulingSimulator } from "./scheduling.js";
import { MemorySimulator } from "./memory.js";
import { ConcurrencySimulator } from "./concurrency.js";

function initApp() {
  console.log("[ConcertCast] Initializing streaming pipeline backend subsystems...");

  // 1. Initialize Streaming Pipeline Audit Logger
  const terminal = new KernelTerminal("term-logs");
  terminal.log("STREAM", "Initializing ConcertCast Real-Time Media Distribution Engine...");
  terminal.log("STREAM", "Media runtime: Linux 6.8 PREEMPT_RT transcode cluster active.");

  // 2. Initialize Feature 1: Real-Time Transcoding & Media Dispatch Engine
  const cpuSimulator = new CPUSchedulingSimulator(terminal);
  terminal.log("STREAM", "Feature 1: Transcoding & Task Dispatch Engine initialized (H.265/AV1).");

  // 3. Initialize Feature 2: Edge VOD Chunk Cache & Tiered Storage Engine
  const memorySimulator = new MemorySimulator(terminal);
  terminal.log("STREAM", "Feature 2: Edge VOD Chunk Cache & S3/NVMe Tiered Storage initialized.");

  // 4. Initialize Feature 3: Ingest-to-CDN Streaming Ring Buffer & Synchronization
  const concurrencySimulator = new ConcurrencySimulator(terminal);
  terminal.log("STREAM", "Feature 3: LL-HLS Ingest-to-CDN Streaming Ring Buffer initialized.");

  terminal.log("STREAM", "All streaming engines active. Seeding initial live concert camera feeds...");

  // Seed initial tasks in paused state
  cpuSimulator.addTask("4K 60FPS Video Ingest", 0, 4, "rt-video");
  cpuSimulator.addTask("VOD Archive Job", 3, 5, "backup");
  cpuSimulator.pause();
  cpuSimulator.setExplain("💡 <strong>Transcoder Ready (Paused):</strong> Click <strong>'⏭ Step 1s'</strong> or <strong>'▶ Auto Dispatch'</strong>. Notice PID 1001 (4K 60FPS Video Ingest) was scheduled first because it's Real-Time Priority 0 to prevent stream freeze!");

  // Seed initial memory pages
  memorySimulator.requestPage(0); // 4K Keyframe Chunk 0
  memorySimulator.requestPage(1); // Audio Stem 1
  memorySimulator.setExplain("💡 <strong>L1 Edge Cache Ready:</strong> Chunks 0 & 1 loaded in resident RAM. Click <strong>'Fetch Next Chunk'</strong> or select a camera segment to watch cache hits and cache miss evictions!");

  // Tab navigation setup for focus view
  const tabButtons = document.querySelectorAll(".tab-btn[data-tab]");
  const moduleCards = document.querySelectorAll(".module-card");
  const tabIndicator = document.querySelector(".tab-indicator");

  function updateTabIndicator(btn) {
    if (!tabIndicator || !btn) return;
    const navRect = btn.parentElement.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    tabIndicator.style.width = `${btnRect.width}px`;
    tabIndicator.style.transform = `translateX(${btnRect.left - navRect.left}px)`;
  }

  // Position indicator at active tab initially
  const initialActive = document.querySelector(".tab-btn.active");
  if (initialActive) {
    setTimeout(() => updateTabIndicator(initialActive), 50);
  }

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      updateTabIndicator(btn);

      const target = btn.getAttribute("data-tab");

      if (target === "tab-all") {
        moduleCards.forEach(card => card.style.display = "flex");
      } else {
        moduleCards.forEach(card => {
          if (card.id === target) {
            card.style.display = "flex";
          } else {
            card.style.display = "none";
          }
        });
      }
    });
  });

  // Guided demo toggle
  const guideBtn = document.getElementById("btn-toggle-guide");
  const guideBanner = document.getElementById("demo-guide-banner");
  const closeGuideBtn = document.getElementById("btn-close-guide");

  if (guideBtn && guideBanner) {
    guideBtn.addEventListener("click", () => {
      const isHidden = guideBanner.style.display === "none";
      guideBanner.style.display = isHidden ? "block" : "none";
    });
  }

  if (closeGuideBtn && guideBanner) {
    closeGuideBtn.addEventListener("click", () => {
      guideBanner.style.display = "none";
    });
  }

  // Expose to window for manual console testing or debugging
  window.OS = {
    terminal,
    cpuSimulator,
    memorySimulator,
    concurrencySimulator
  };
}

// Ensure execution whether DOM is already parsed or still loading
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
