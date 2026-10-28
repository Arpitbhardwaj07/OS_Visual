// src/memory.js
// Memory & Data Storage Simulator
// Demand Paging, Virtual Memory vs RAM Frames, Page Fault & Replacement (FIFO & LRU)
import { toast } from "./toast.js";

export class MemorySimulator {
  constructor(terminal) {
    this.terminal = terminal;
    this.numFrames = 4;
    this.numVirtualPages = 12; // Pages 0 to 11
    this.frames = Array(this.numFrames).fill(null); // Physical RAM frames
    this.policy = "FIFO"; // "FIFO" or "LRU"
    
    // Page access history for LRU and FIFO
    this.fifoQueue = []; // array of frame indices in order loaded
    this.lruTimestamps = Array(this.numFrames).fill(0);
    this.timeCounter = 0;

    // Statistics
    this.totalRequests = 0;
    this.pageFaults = 0;

    // Optional deterministic page-reference sequence.
    this.pendingSequence = [];
    this.autoStreamTimer = null;

    // DOM References
    this.vmList = document.getElementById("vm-page-list");
    this.ramList = document.getElementById("ram-frames-list");
    this.decisionBanner = document.getElementById("mem-decision-banner");
    this.faultCounter = document.getElementById("mem-fault-counter");
    this.policySelect = document.getElementById("mem-policy-select");
    this.pageInput = document.getElementById("input-page-num");
    this.explainText = document.getElementById("mem-explain-text");

    this.bindEvents();
    this.render();
  }

  setExplain(html) {
    if (this.explainText) this.explainText.innerHTML = html;
  }

  bindEvents() {
    this.policySelect.addEventListener("change", (e) => {
      this.policy = e.target.value;
      this.terminal.log("PAGING", `sys_vm_setpolicy(): Switched replacement algorithm to ${this.policy}`);
      this.decisionBanner.innerText = `Switched paging replacement algorithm to ${this.policy}.`;
    });

    document.getElementById("btn-req-page").addEventListener("click", () => {
      const page = parseInt(this.pageInput.value, 10);
      if (!isNaN(page) && page >= 0 && page < this.numVirtualPages) {
        this.requestPage(page);
      }
    });

    document.getElementById("btn-preset-4k").addEventListener("click", () => {
      this.pendingSequence = [1, 2, 3, 1, 4, 5, 2, 1, 6, 7, 3, 2];
      this.terminal.log("PAGING", `Reference page sequence loaded: [${this.pendingSequence.join(", ")}]`);
      this.decisionBanner.innerText = `Loaded page sequence: [${this.pendingSequence.join(", ")}]. Request pages manually or start automatic requests.`;
    });

    document.getElementById("btn-step-mem").addEventListener("click", () => {
      if (this.pendingSequence.length > 0) {
        const next = this.pendingSequence.shift();
        this.requestPage(next);
      } else {
        // Request a random virtual page when the sequence is empty.
        const randPage = Math.floor(Math.random() * this.numVirtualPages);
        this.requestPage(randPage);
      }
    });

    const streamBtn = document.getElementById("btn-stream-mem");
    streamBtn.addEventListener("click", () => {
      if (this.autoStreamTimer) {
        clearInterval(this.autoStreamTimer);
        this.autoStreamTimer = null;
        streamBtn.innerText = "Auto request pages";
        this.terminal.log("PAGING", "Automatic page requests paused.");
      } else {
        streamBtn.innerText = "⏸ Pause requests";
        this.terminal.log("PAGING", "Automatic page requests started.");
        this.autoStreamTimer = setInterval(() => {
          if (this.pendingSequence.length > 0) {
            this.requestPage(this.pendingSequence.shift());
          } else {
            this.requestPage(Math.floor(Math.random() * this.numVirtualPages));
          }
        }, 1200);
      }
    });

    document.getElementById("btn-reset-mem").addEventListener("click", () => this.reset());
  }

  requestPage(page) {
    this.timeCounter++;
    this.totalRequests++;

    // 1. Check if page is already resident in Physical RAM
    const frameIndex = this.frames.findIndex(f => f !== null && f.page === page);

    if (frameIndex !== -1) {
      // PAGE HIT / CACHE HIT
      this.lruTimestamps[frameIndex] = this.timeCounter;
      this.frames[frameIndex].accessCount++;
      const reason = `PAGE HIT: Page ${page} is resident in physical frame ${frameIndex}.`;
      this.setExplain(`🟢 <strong>CACHE HIT:</strong> Requested <strong>Segment ${page}</strong> is already in high-speed Edge RAM Frame ${frameIndex}. Zero disk latency incurred!`);
      
      this.terminal.log("PAGING", `[PAGE HIT] Page ${page} found in frame ${frameIndex}`, {
        status: "HIT",
        frame: frameIndex,
        total_requests: this.totalRequests,
        miss_rate: `${((this.pageFaults / this.totalRequests) * 100).toFixed(1)}%`
      });

      this.decisionBanner.innerText = reason;
      this.render();
      return;
    }

    // 2. PAGE FAULT / CACHE MISS
    this.pageFaults++;
    this.terminal.log("PAGING", `Page fault: page ${page} is not resident in physical memory.`);

    // Check if there is an empty frame
    const emptyIndex = this.frames.findIndex(f => f === null);

    if (emptyIndex !== -1) {
      // Allocate into empty frame
      this.frames[emptyIndex] = {
        page,
        allocatedAt: this.timeCounter,
        accessCount: 1,
        faulted: true
      };
      this.fifoQueue.push(emptyIndex);
      this.lruTimestamps[emptyIndex] = this.timeCounter;

      const reason = `PAGE FAULT: Loaded page ${page} into free frame ${emptyIndex}.`;
      this.setExplain(`🟡 <strong>CACHE MISS:</strong> Segment ${page} was in cold storage. Loaded into free RAM Frame ${emptyIndex}.`);
      this.terminal.log("PAGING", reason, { page, frame: emptyIndex, action: "LOAD_FREE_FRAME" });
      this.decisionBanner.innerText = reason;
      toast.show(`Page fault: loaded page ${page} into frame ${emptyIndex}`, "fault");
    } else {
      // Frame replacement required
      let victimFrameIndex = -1;
      let victimPage = null;

      if (this.policy === "FIFO") {
        victimFrameIndex = this.fifoQueue.shift();
        this.fifoQueue.push(victimFrameIndex);
      } else {
        // LRU
        let minTime = Infinity;
        for (let i = 0; i < this.numFrames; i++) {
          if (this.lruTimestamps[i] < minTime) {
            minTime = this.lruTimestamps[i];
            victimFrameIndex = i;
          }
        }
      }

      victimPage = this.frames[victimFrameIndex].page;

      // Swap out victim and swap in new page
      this.frames[victimFrameIndex] = {
        page,
        allocatedAt: this.timeCounter,
        accessCount: 1,
        faulted: true
      };
      this.lruTimestamps[victimFrameIndex] = this.timeCounter;

      const reason = `PAGE FAULT (${this.policy}): Replaced page ${victimPage} in frame ${victimFrameIndex} with page ${page}.`;
      this.setExplain(`🔴 <strong>CACHE EVICTION (${this.policy}):</strong> All 4 RAM slots full! Evicted least requested Segment ${victimPage} back to NVMe to make room for Segment ${page}.`);
      this.terminal.log("PAGING", reason, {
        policy: this.policy,
        evicted_segment: victimPage,
        cached_segment: page,
        frame: victimFrameIndex,
        action: "EVICT_AND_REPLACE"
      });

      this.decisionBanner.innerText = reason;
      toast.show(`${this.policy}: replaced page ${victimPage} with page ${page}`, "fault");
    }

    this.render();
  }

  reset() {
    if (this.autoStreamTimer) {
      clearInterval(this.autoStreamTimer);
      this.autoStreamTimer = null;
      document.getElementById("btn-stream-mem").innerText = "Auto request pages";
    }
    this.frames = Array(this.numFrames).fill(null);
    this.fifoQueue = [];
    this.lruTimestamps = Array(this.numFrames).fill(0);
    this.timeCounter = 0;
    this.totalRequests = 0;
    this.pageFaults = 0;
    this.pendingSequence = [];

    this.terminal.log("PAGING", "sys_vm_flush(): Page frames deallocated. MMU table reset.");
    this.decisionBanner.innerText = "Memory initialized. Awaiting page requests.";
    this.render();
  }

  render() {
    // 1. Virtual memory page grid.
    const descriptions = [
      "Code segment", "Stack data", "Heap allocation", "Shared library",
      "Process data", "File cache", "Shared memory", "Page table",
      "Code segment", "Stack data", "Heap allocation", "Mapped file"
    ];

    this.vmList.innerHTML = Array.from({ length: this.numVirtualPages }).map((_, i) => {
      const isLoaded = this.frames.some(f => f !== null && f.page === i);
      return `
        <div class="vm-page-card ${isLoaded ? 'loaded' : ''}">
          <div class="vm-page-header">
            <span>Page ${i}</span>
            <span>${isLoaded ? 'RAM [VALID]' : '[SWAP]'}</span>
          </div>
          <div class="vm-page-desc">${descriptions[i] || 'Virtual page'}</div>
        </div>
      `;
    }).join('');

    // 2. Physical RAM Frames
    this.ramList.innerHTML = this.frames.map((frame, i) => {
      if (frame === null) {
        return `
          <div class="frame-box">
            <div><strong>FRAME ${i}</strong>: <span class="text-muted">[EMPTY / UNALLOCATED]</span></div>
            <div class="text-muted">Valid Bit: 0</div>
          </div>
        `;
      }
      return `
        <div class="frame-box anim-enter occupied ${frame.faulted ? 'faulted' : ''}">
          <div>
            <strong>FRAME ${i}</strong>: <span class="frame-page-id">Page ${frame.page}</span>
            <span class="frame-page-desc">(${descriptions[frame.page] || 'Chunk'})</span>
          </div>
          <div>
            <span class="frame-valid-badge">Valid: 1</span>
            <span class="text-muted">Refs: ${frame.accessCount}</span>
          </div>
        </div>
      `;
    }).join('');

    // Clear fault animation flag after render
    this.frames.forEach(f => { if (f) f.faulted = false; });

    // Update fault counter
    const faultRate = this.totalRequests > 0 ? ((this.pageFaults / this.totalRequests) * 100).toFixed(1) : "0.0";
    this.faultCounter.innerText = `Page faults: ${this.pageFaults} / ${this.totalRequests} (${faultRate}%)`;
  }
}
