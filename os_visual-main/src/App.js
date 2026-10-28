// src/App.js
// Main entry point orchestrating all OS simulation modules

import { KernelTerminal } from "./terminal.js";
import { CPUSchedulingSimulator } from "./scheduling.js";
import { MemorySimulator } from "./memory.js";
import { ConcurrencySimulator } from "./concurrency.js";

function initApp() {
  console.log("[OS Visualizer] Initializing simulation modules...");

  // 1. Initialize the system event log.
  const terminal = new KernelTerminal("term-logs");
  terminal.log("SYSTEM", "Initializing operating systems simulations...");

  // 2. Initialize CPU scheduling.
  const cpuSimulator = new CPUSchedulingSimulator(terminal);
  terminal.log("SYSTEM", "CPU scheduling simulator ready.");

  // 3. Initialize memory management.
  const memorySimulator = new MemorySimulator(terminal);
  terminal.log("SYSTEM", "Memory management simulator ready.");

  // 4. Initialize process synchronization.
  const concurrencySimulator = new ConcurrencySimulator(terminal);
  terminal.log("SYSTEM", "Synchronization simulator ready.");

  terminal.log("SYSTEM", "Seeding example processes and page requests...");

  // Seed initial tasks in paused state
  cpuSimulator.addTask("Interactive process", 0, 4, "interactive");
  cpuSimulator.addTask("Background process", 3, 5, "background");
  cpuSimulator.pause();
  cpuSimulator.setExplain("💡 <strong>Scheduler ready (paused):</strong> Step through the queue or start automatic execution to compare process priorities.");

  // Seed initial memory pages
  memorySimulator.requestPage(0);
  memorySimulator.requestPage(1);
  memorySimulator.setExplain("💡 <strong>Memory simulator ready:</strong> Pages 0 and 1 are loaded. Request more pages to observe cache hits and page replacement.");

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
