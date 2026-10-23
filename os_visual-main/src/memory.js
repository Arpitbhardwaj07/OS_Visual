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

    // Stream sequence for 4K video encoding simulation
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
      this.terminal.log("EDGE_CACHE", `Playback Sequence Loaded: [Segments ${this.pendingSequence.join(", ")}]`);
      this.decisionBanner.innerText = `Loaded Multi-Cam playback chunk sequence: [${this.pendingSequence.join(", ")}]. Click 'Fetch Next Chunk' or 'Auto Playback Stream'.`;
    });

    document.getElementById("btn-step-mem").addEventListener("click", () => {
      if (this.pendingSequence.length > 0) {
        const next = this.pendingSequence.shift();
        this.requestPage(next);
      } else {
        // Random video chunk request
        const randPage = Math.floor(Math.random() * this.numVirtualPages);
        this.requestPage(randPage);
      }
    });

    const streamBtn = document.getElementById("btn-stream-mem");
    streamBtn.addEventListener("click", () => {
      if (this.autoStreamTimer) {
        clearInterval(this.autoStreamTimer);
        this.autoStreamTimer = null;
        streamBtn.innerText = "Auto Playback Stream";
        this.terminal.log("EDGE_CACHE", `Playback chunk stream paused.`);
      } else {
        streamBtn.innerText = "⏸ Pause Playback";
        this.terminal.log("EDGE_CACHE", `Continuous viewer playback stream active.`);
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
      const reason = `CACHE HIT: Segment ${page} is resident in L1 Edge RAM Frame ${frameIndex}. Sub-millisecond stream response.`;
      this.setExplain(`🟢 <strong>CACHE HIT:</strong> Requested <strong>Segment ${page}</strong> is already in high-speed Edge RAM Frame ${frameIndex}. Zero disk latency incurred!`);
      
      this.terminal.log("EDGE_CACHE", `[CACHE HIT] Video Segment ${page} served from RAM Frame ${frameIndex}`, {
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
    this.terminal.log("STORAGE", `cache_miss_handler(): Segment ${page} not in RAM! Fetching from S3/NVMe...`);

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

      const reason = `CACHE MISS: Fetched Segment ${page} from S3/NVMe into Free Edge Frame ${emptyIndex}.`;
      this.setExplain(`🟡 <strong>CACHE MISS:</strong> Segment ${page} was in cold storage. Loaded into free RAM Frame ${emptyIndex}.`);
      this.terminal.log("EDGE_CACHE", reason, { page, frame: emptyIndex, action: "LOAD_FREE_FRAME" });
      this.decisionBanner.innerText = reason;
      toast.show(`Cache Miss: Loaded Segment ${page} into Edge Frame ${emptyIndex}`, "fault");
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

      const reason = `CACHE MISS & EVICTION (${this.policy}): Evicted cold Segment ${victimPage} from Frame ${victimFrameIndex}; Cached Segment ${page}.`;
      this.setExplain(`🔴 <strong>CACHE EVICTION (${this.policy}):</strong> All 4 RAM slots full! Evicted least requested Segment ${victimPage} back to NVMe to make room for Segment ${page}.`);
      this.terminal.log("EDGE_CACHE", reason, {
        policy: this.policy,
        evicted_segment: victimPage,
        cached_segment: page,
        frame: victimFrameIndex,
        action: "EVICT_AND_REPLACE"
      });

      this.decisionBanner.innerText = reason;
      toast.show(`Cache Eviction (${this.policy}): Evicted Segment ${victimPage} -> Loaded ${page}`, "fault");
    }

    this.render();
  }

  reset() {
    if (this.autoStreamTimer) {
      clearInterval(this.autoStreamTimer);
      this.autoStreamTimer = null;
      document.getElementById("btn-stream-mem").innerText = "Auto Request Stream";
    }
    this.frames = Array(this.numFrames).fill(null);
    this.fifoQueue = [];
    this.lruTimestamps = Array(this.numFrames).fill(0);
    this.timeCounter = 0;
    this.totalRequests = 0;
    this.pageFaults = 0;
    this.pendingSequence = [];

    this.terminal.log("PAGING", "sys_vm_flush(): Page frames deallocated. MMU table reset.");
    this.decisionBanner.innerText = "System initialized. Awaiting video encoding memory references.";
    this.render();
  }

  render() {
    // 1. Virtual Memory page grid (Concert catalog chunks)
    const descriptions = [
      "Keyframe 0 (Main Stage)", "Audio Stem 1 (Vocals)", "P-Frame 2 (Main Stage)", "Crowd Cam 1 (1080p)",
      "Keyframe 1 (Drum Cam)", "Audio Stem 2 (Bass)", "P-Frame 3 (Drone Cam)", "Crowd Cam 2 (720p)",
      "Keyframe 2 (Guitar Solo)", "Audio Stem 3 (Guitars)", "P-Frame 4 (4K Stage)", "HLS VOD Segment 0"
    ];

    this.vmList.innerHTML = Array.from({ length: this.numVirtualPages }).map((_, i) => {
      const isLoaded = this.frames.some(f => f !== null && f.page === i);
      return `
        <div class="vm-page-card ${isLoaded ? 'loaded' : ''}">
          <div class="vm-page-header">
            <span>Page ${i}</span>
            <span>${isLoaded ? 'RAM [VALID]' : '[SWAP]'}</span>
          </div>
          <div class="vm-page-desc">${descriptions[i] || 'Video Chunk'}</div>
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
    this.faultCounter.innerText = `Cache Miss Rate: ${this.pageFaults} / ${this.totalRequests} (${faultRate}%)`;
  }
}
