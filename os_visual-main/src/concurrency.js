// src/concurrency.js
// Concurrency & Synchronization Simulator
// Bounded Streaming Buffer, Mutex Lock, Counting Semaphores (empty/full), Wait/Signal States & Race Condition Detection
import { toast } from "./toast.js";

export class ConcurrencySimulator {
  constructor(terminal) {
    this.terminal = terminal;
    this.bufferCapacity = 5;
    this.buffer = Array(this.bufferCapacity).fill(null);
    this.inIndex = 0;
    this.outIndex = 0;

    // Synchronization primitives
    this.mutexLocked = false;
    this.mutexOwner = null; // Thread ID currently holding lock
    this.semEmpty = this.bufferCapacity; // Empty slot counting semaphore
    this.semFull = 0; // Full slot counting semaphore
    this.mutexProtectionActive = true; // Toggle for academic demonstration of race conditions

    // Thread management
    this.tidCounter = 501;
    this.threads = [];
    this.waitQueue = []; // Threads waiting for mutex or semaphores
    this.chunkIdCounter = 1;

    // DOM references
    this.bufferContainer = document.getElementById("sync-buffer-slots");
    this.threadsTbody = document.getElementById("threads-tbody");
    this.mutexStateEl = document.getElementById("sync-mutex-state");
    this.semEmptyEl = document.getElementById("sync-sem-empty");
    this.semFullEl = document.getElementById("sync-sem-full");
    this.activeCsEl = document.getElementById("sync-active-cs");
    this.protectionModeEl = document.getElementById("sync-protection-mode");
    this.explainText = document.getElementById("sync-explain-text");

    this.bindEvents();
    this.render();
  }

  setExplain(html) {
    if (this.explainText) this.explainText.innerHTML = html;
  }

  bindEvents() {
    document.getElementById("btn-spawn-producer").addEventListener("click", () => {
      this.spawnThread("PRODUCER", "Camera Ingest Worker");
    });

    document.getElementById("btn-spawn-consumer").addEventListener("click", () => {
      this.spawnThread("CONSUMER", "CDN Edge Broadcaster");
    });

    document.getElementById("btn-toggle-race").addEventListener("click", () => {
      this.mutexProtectionActive = !this.mutexProtectionActive;
      if (this.mutexProtectionActive) {
        this.protectionModeEl.innerText = "ACTIVE (POSIX Mutex)";
        this.protectionModeEl.className = "status-tag status-running";
        this.terminal.log("SYNCHRONIZATION", "ipc_lock_enable(): POSIX Mutex & Semaphore synchronization active. Race hazard shield engaged.");
      } else {
        this.protectionModeEl.innerText = "BYPASSED (Unsafe Race Hazards!)";
        this.protectionModeEl.className = "status-tag status-preempted";
        this.terminal.log("SYNCHRONIZATION", "WARNING: Mutex lock BYPASSED! Ingest and CDN workers accessing shared ring buffer unsynchronized!");
      }
      this.render();
    });

    document.getElementById("btn-reset-sync").addEventListener("click", () => this.reset());
  }

  spawnThread(role, action) {
    const tid = this.tidCounter++;
    const thread = {
      tid,
      role, // PRODUCER or CONSUMER
      action,
      state: "CREATED", // CREATED, WAITING_SEM, WAITING_MUTEX, RUNNING_CS, COMPLETED, RACE_COLLISION
      waitResource: null,
      chunkData: role === "PRODUCER" ? `HLS Segment #${this.chunkIdCounter++}` : null
    };

    this.threads.push(thread);
    this.terminal.log("STREAM_RING", `pthread_create() -> Thread TID ${tid} spawned [${role}]`, { role, pipeline: action });

    // Execute thread lifecycle
    setTimeout(() => this.runThreadLifecycle(thread), 300);
    this.render();
  }

  async runThreadLifecycle(thread) {
    if (thread.role === "PRODUCER") {
      // 1. sem_wait(&empty)
      if (this.mutexProtectionActive) {
        if (this.semEmpty <= 0) {
          thread.state = "WAITING_SEM";
          thread.waitResource = "sem_wait(empty == 0)";
          this.setExplain(`⏸ <strong>RING BUFFER FULL (Ingest Blocked):</strong> Ingest Thread TID ${thread.tid} called <code>sem_wait(&empty;)</code> but empty_slots is 0! Worker sleeps until CDN Broadcaster dequeues a packet.`);
          this.terminal.log("STREAM_RING", `[INGEST BLOCKED] Thread TID ${thread.tid}: Streaming Ring Buffer is FULL (0 empty slots).`);
          this.render();
          await this.waitForCondition(() => this.semEmpty > 0);
        }
        this.semEmpty--;
        this.terminal.log("STREAM_RING", `sem_wait(&empty) -> ${this.semEmpty} free slots in ring (Ingest TID ${thread.tid})`);
      }

      // 2. pthread_mutex_lock(&mutex)
      if (this.mutexProtectionActive) {
        if (this.mutexLocked) {
          thread.state = "WAITING_MUTEX";
          thread.waitResource = `pthread_mutex_lock(Holding: TID ${this.mutexOwner})`;
          this.setExplain(`🔒 <strong>BUFFER CONTENTION:</strong> Ingest TID ${thread.tid} waiting to write, but TID ${this.mutexOwner} is currently holding the buffer Mutex lock!`);
          this.terminal.log("STREAM_RING", `[MUTEX CONTENTION] Ingest TID ${thread.tid} waiting on mutex held by TID ${this.mutexOwner}`);
          this.render();
          await this.waitForCondition(() => !this.mutexLocked);
        }
        this.mutexLocked = true;
        this.mutexOwner = thread.tid;
      }

      // Check for race hazard when protection disabled
      if (!this.mutexProtectionActive && this.mutexOwner !== null) {
        thread.state = "RACE_COLLISION";
        this.setExplain(`💥 <strong>MEDIA PACKET CORRUPTION!</strong> Mutex bypassed! Multiple threads collided writing to Slot ${this.inIndex} concurrently without synchronization!`);
        this.terminal.log("STREAM_CORRUPTION", `CRITICAL RACE HAZARD! Multiple ingest workers modifying ring buffer slot ${this.inIndex} simultaneously!`);
        toast.show(`Stream Packet Corruption: Unsynchronized write at slot [${this.inIndex}]!`, "collision", 4000);
      } else {
        thread.state = "RUNNING_CS";
        this.setExplain(`🟢 <strong>IN CRITICAL SECTION:</strong> Ingest TID ${thread.tid} acquired Mutex. Safely writing "${thread.chunkData}" to Ring Slot ${this.inIndex}...`);
      }

      thread.waitResource = "Writing Ring Slot " + this.inIndex;
      this.render();

      // Simulate writing to buffer
      await new Promise(r => setTimeout(r, 1000));
      this.buffer[this.inIndex] = thread.chunkData;
      this.terminal.log("STREAM_RING", `Ingest Worker TID ${thread.tid} stored "${thread.chunkData}" into Ring Slot [${this.inIndex}]`);
      this.inIndex = (this.inIndex + 1) % this.bufferCapacity;

      // 3. pthread_mutex_unlock(&mutex)
      if (this.mutexProtectionActive) {
        this.mutexLocked = false;
        this.mutexOwner = null;
        this.terminal.log("STREAM_RING", `pthread_mutex_unlock() released by Ingest TID ${thread.tid}`);

        // 4. sem_post(&full)
        this.semFull++;
        this.terminal.log("STREAM_RING", `sem_post(&full) -> ${this.semFull} packets ready for CDN broadcast`);
      }

      thread.state = "COMPLETED";
      thread.waitResource = "Finished";
      this.render();

    } else {
      // CONSUMER THREAD
      // 1. sem_wait(&full)
      if (this.mutexProtectionActive) {
        if (this.semFull <= 0) {
          thread.state = "WAITING_SEM";
          thread.waitResource = "sem_wait(full == 0)";
          this.setExplain(`⏸ <strong>RING BUFFER EMPTY (CDN Broadcaster Blocked):</strong> CDN TID ${thread.tid} called <code>sem_wait(&full)</code> but no packets are ready! Worker sleeps until an Ingest thread writes a frame.`);
          this.terminal.log("STREAM_RING", `[CDN BLOCKED] Broadcaster TID ${thread.tid} blocked: Buffer is EMPTY (0 packets).`);
          this.render();
          await this.waitForCondition(() => this.semFull > 0);
        }
        this.semFull--;
        this.terminal.log("STREAM_RING", `sem_wait(&full) -> ${this.semFull} packets remaining (CDN TID ${thread.tid})`);
      }

      // 2. pthread_mutex_lock(&mutex)
      if (this.mutexProtectionActive) {
        if (this.mutexLocked) {
          thread.state = "WAITING_MUTEX";
          thread.waitResource = `pthread_mutex_lock(Holding: TID ${this.mutexOwner})`;
          this.setExplain(`🔒 <strong>BUFFER CONTENTION:</strong> CDN TID ${thread.tid} wants to dequeue, but Mutex is held by TID ${this.mutexOwner}.`);
          this.terminal.log("STREAM_RING", `[MUTEX CONTENTION] CDN TID ${thread.tid} waiting on mutex held by TID ${this.mutexOwner}`);
          this.render();
          await this.waitForCondition(() => !this.mutexLocked);
        }
        this.mutexLocked = true;
        this.mutexOwner = thread.tid;
      }

      thread.state = "RUNNING_CS";
      thread.waitResource = "Reading Ring Slot " + this.outIndex;
      this.setExplain(`🟢 <strong>IN CRITICAL SECTION:</strong> CDN Broadcaster TID ${thread.tid} acquired Mutex. Safely broadcasting packet from Ring Slot ${this.outIndex}...`);
      this.render();

      // Simulate reading chunk from buffer
      await new Promise(r => setTimeout(r, 1000));
      const chunk = this.buffer[this.outIndex] || "Empty/Garbage";
      this.buffer[this.outIndex] = null;
      this.terminal.log("STREAM_RING", `CDN Broadcaster TID ${thread.tid} broadcasted "${chunk}" to edge viewers from Slot [${this.outIndex}]`);
      this.outIndex = (this.outIndex + 1) % this.bufferCapacity;

      // 3. pthread_mutex_unlock(&mutex)
      if (this.mutexProtectionActive) {
        this.mutexLocked = false;
        this.mutexOwner = null;
        this.terminal.log("STREAM_RING", `pthread_mutex_unlock() released by CDN TID ${thread.tid}`);

        // 4. sem_post(&empty)
        this.semEmpty++;
        this.terminal.log("STREAM_RING", `sem_post(&empty) -> ${this.semEmpty} empty ring slots now available`);
      }

      thread.state = "COMPLETED";
      thread.waitResource = "Finished";
      this.render();
    }
  }

  waitForCondition(conditionFn) {
    return new Promise(resolve => {
      const interval = setInterval(() => {
        if (conditionFn()) {
          clearInterval(interval);
          resolve();
        }
      }, 150);
    });
  }

  reset() {
    this.buffer = Array(this.bufferCapacity).fill(null);
    this.inIndex = 0;
    this.outIndex = 0;
    this.mutexLocked = false;
    this.mutexOwner = null;
    this.semEmpty = this.bufferCapacity;
    this.semFull = 0;
    this.threads = [];
    this.terminal.log("CONCURRENCY", "sys_ipc_reset(): Buffer cleared. Mutex and semaphores re-initialized to initial defaults.");
    this.render();
  }

  render() {
    // 1. Mutex & Semaphores Display
    if (this.mutexLocked) {
      this.mutexStateEl.className = "status-tag status-preempted";
      this.mutexStateEl.innerText = `LOCKED (TID ${this.mutexOwner})`;
    } else {
      this.mutexStateEl.className = "status-tag status-running";
      this.mutexStateEl.innerText = "UNLOCKED (1)";
    }

    this.semEmptyEl.innerText = this.semEmpty;
    this.semFullEl.innerText = this.semFull;

    this.activeCsEl.innerText = this.mutexOwner ? `TID ${this.mutexOwner} inside Critical Section` : "IDLE (No thread in Critical Section)";

    // 2. Buffer Slots Display
    this.bufferContainer.innerHTML = this.buffer.map((slot, i) => {
      const isFilled = slot !== null;
      const isHead = (i === this.inIndex);
      const isTail = (i === this.outIndex);

      return `
        <div class="buffer-slot anim-enter ${isFilled ? 'filled' : ''}">
          <div class="buffer-slot-label">SLOT ${i} ${isHead ? '◄[IN]' : ''} ${isTail ? '►[OUT]' : ''}</div>
          <div class="buffer-slot-val">${isFilled ? slot : '[EMPTY]'}</div>
        </div>
      `;
    }).join('');

    // 3. Threads Table
    if (this.threads.length === 0) {
      this.threadsTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#555;">No concurrent worker threads currently queued.</td></tr>`;
      return;
    }

    this.threadsTbody.innerHTML = this.threads.slice(-6).map(t => {
      let stateBadge = `<span class="status-tag status-${t.state.toLowerCase()}">${t.state}</span>`;
      if (t.state === "RACE_COLLISION") {
        stateBadge = `<span class="status-tag status-preempted" style="animation:pulse 0.5s infinite;">RACE CORRUPTION!</span>`;
      }

      return `
        <tr class="anim-enter">
          <td><strong>TID ${t.tid}</strong></td>
          <td><span class="thread-role-badge role-${t.role.toLowerCase()}">${t.role}</span></td>
          <td>${t.action}</td>
          <td class="font-mono text-xs">${t.waitResource || 'None'}</td>
          <td>${stateBadge}</td>
        </tr>
      `;
    }).join('');
  }
}
