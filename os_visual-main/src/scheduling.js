// src/scheduling.js
// CPU Scheduling Simulator
// Features: FCFS vs Multilevel Queue with Preemption, Real-time PCB, Live Queue Shift & Canvas Comparative Chart
import { toast } from "./toast.js";

export class CPUSchedulingSimulator {
  constructor(terminal) {
    this.terminal = terminal;
    this.algo = "MLQ"; // "MLQ" or "FCFS"
    this.pidCounter = 1001;
    this.tasks = []; // All tasks in system (PCB table)
    this.runningTask = null;
    this.timer = null;
    this.clock = 0; // Simulation tick counter
    this.isRunning = false;

    // Comparative Performance Metrics History
    this.metrics = {
      FCFS: { completed: 0, totalResponseTime: 0, totalLag: 0, history: [] },
      MLQ: { completed: 0, totalResponseTime: 0, totalLag: 0, history: [] }
    };

    // UI references
    this.pcbTbody = document.getElementById("pcb-tbody");
    this.queuesContainer = document.getElementById("queues-container");
    this.chartContainer = document.getElementById("chart-cpu-container");
    this.algoSelect = document.getElementById("sched-algo-select");
    this.explainText = document.getElementById("cpu-explain-text");

    this.bindEvents();
    this.renderQueues();
    this.renderPCB();
    this.renderChart();
  }

  bindEvents() {
    this.algoSelect.addEventListener("change", (e) => {
      this.algo = e.target.value;
      this.terminal.log("SCHEDULER", `sys_sched_setscheduler(): Switched algorithm mode to ${this.algo}`, { algo: this.algo });
      this.setExplain(`Switched algorithm to <strong>${this.algo}</strong>. ${this.algo === 'MLQ' ? 'Preemption active: High-priority tasks (Live Video) will immediately interrupt lower-priority tasks.' : 'FCFS active: Tasks execute in strict arrival order without preemption.'}`);
      this.renderQueues();
    });

    document.getElementById("btn-run-cpu").addEventListener("click", () => this.start());
    document.getElementById("btn-pause-cpu").addEventListener("click", () => this.pause());
    document.getElementById("btn-reset-cpu").addEventListener("click", () => this.reset());

    const stepBtn = document.getElementById("btn-step-cpu");
    if (stepBtn) {
      stepBtn.addEventListener("click", () => {
        this.pause();
        this.tick();
      });
    }

    // Workload Injection Buttons
    document.getElementById("btn-add-live-video").addEventListener("click", () => {
      this.addTask("4K 60FPS Video Ingest", 0, Math.floor(Math.random() * 4) + 5, "rt-video");
    });
    document.getElementById("btn-add-prod-ctrl").addEventListener("click", () => {
      this.addTask("Audio Track Muxer", 1, Math.floor(Math.random() * 3) + 3, "prod-ctrl");
    });
    document.getElementById("btn-add-audience").addEventListener("click", () => {
      this.addTask("Adaptive 1080p Transcode", 2, Math.floor(Math.random() * 3) + 2, "audience");
    });
    document.getElementById("btn-add-backups").addEventListener("click", () => {
      this.addTask("VOD Archive Job", 3, Math.floor(Math.random() * 5) + 6, "backup");
    });

    document.getElementById("btn-add-batch").addEventListener("click", () => {
      this.terminal.log("TRANSCODER", "stream_ingest_burst(): Sudden influx of multi-cam concert feeds detected!");
      this.addTask("VOD Archive Job", 3, 7, "backup");
      this.addTask("Adaptive 1080p Transcode", 2, 3, "audience");
      setTimeout(() => this.addTask("Audio Track Muxer", 1, 4, "prod-ctrl"), 500);
      setTimeout(() => this.addTask("4K 60FPS Video Ingest", 0, 6, "rt-video"), 1000);
    });
  }

  setExplain(html) {
    if (this.explainText) {
      this.explainText.innerHTML = html;
    }
  }

  addTask(name, priority, burst, typeKey) {
    const pid = this.pidCounter++;
    const task = {
      pid,
      name,
      priority, // 0 = RT (Highest), 1 = Interactive High, 2 = Medium, 3 = Batch (Lowest)
      burst,
      remaining: burst,
      arrivalTime: this.clock,
      startTime: null,
      completionTime: null,
      state: "READY", // READY, RUNNING, PREEMPTED, TERMINATED
      typeKey,
      queueLevel: priority <= 0 ? 0 : (priority === 1 ? 1 : 2) // Q0: RT, Q1: Interactive, Q2: Batch
    };

    this.tasks.push(task);
    this.terminal.log("SYSCALL", `sys_fork() -> PID ${task.pid} created`, {
      name: task.name,
      priority: task.priority,
      burst: `${task.burst}s`,
      target_queue: `Q${task.queueLevel}`
    });

    // In Multilevel Queue with preemption: check if arriving task preempts currently running task
    if (this.algo === "MLQ" && this.runningTask && task.priority < this.runningTask.priority) {
      this.terminal.log("SCHEDULER", `PREEMPTION EVENT: High-priority task ${task.pid} (${task.name}) preempted running task ${this.runningTask.pid} (${this.runningTask.name})!`, {
        preempted_pid: this.runningTask.pid,
        remaining_burst: `${this.runningTask.remaining}s`,
        new_active_pid: task.pid
      });
      this.setExplain(`🚨 <strong>PREEMPTION OCCURRED:</strong> Arriving high-priority task <strong>PID ${task.pid} (${task.name})</strong> interrupted and paused running task <strong>PID ${this.runningTask.pid} (${this.runningTask.name})</strong> because priority ${task.priority} < ${this.runningTask.priority}!`);
      toast.show(`Preemption: PID ${task.pid} (${task.name}) preempted PID ${this.runningTask.pid}!`, "preempt");
      this.runningTask.state = "PREEMPTED";
      this.runningTask = null; // Will pick highest priority in next cycle
    } else {
      this.setExplain(`➕ Created new task <strong>PID ${task.pid} (${task.name})</strong> placed into Queue Q${task.queueLevel} with priority ${task.priority} and burst ${task.burst}s.`);
    }

    this.renderQueues();
    this.renderPCB();

    // Auto-start if not running
    if (!this.isRunning) {
      this.start();
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.terminal.log("SCHEDULER", `Scheduler CPU thread started running under ${this.algo} policy.`);
    this.timer = setInterval(() => this.tick(), 1000);
  }

  pause() {
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
    this.terminal.log("SCHEDULER", `Scheduler paused at clock tick t=${this.clock}s.`);
    this.renderQueues();
    this.renderPCB();
  }

  reset() {
    this.pause();
    this.tasks = [];
    this.runningTask = null;
    this.clock = 0;
    this.terminal.log("SCHEDULER", `All process queues flushed. PCB table reset to idle.`);
    this.renderQueues();
    this.renderPCB();
    this.renderChart();
  }

  tick() {
    this.clock++;

    // 1. Pick next task if CPU is free or preemption occurred
    if (!this.runningTask) {
      this.scheduleNext();
    }

    // 2. Execute 1 unit on running task
    if (this.runningTask) {
      if (this.runningTask.startTime === null) {
        this.runningTask.startTime = this.clock - 1;
        const responseTime = this.runningTask.startTime - this.runningTask.arrivalTime;
        this.terminal.log("SCHEDULER", `CONTEXT SWITCH: Dispatching PID ${this.runningTask.pid} to CPU`, {
          task: this.runningTask.name,
          response_latency: `${responseTime}s`,
          queue: `Q${this.runningTask.queueLevel}`
        });
      }

      this.runningTask.remaining--;
      this.runningTask.state = "RUNNING";

      // If finished
      if (this.runningTask.remaining <= 0) {
        this.runningTask.state = "TERMINATED";
        this.runningTask.completionTime = this.clock;

        const turnaround = this.runningTask.completionTime - this.runningTask.arrivalTime;
        const wait = turnaround - this.runningTask.burst;
        const responseTime = this.runningTask.startTime - this.runningTask.arrivalTime;
        const lag = wait; // Stream jitter/lag directly correlates to waiting delay in audio/video pipeline

        this.recordMetrics(responseTime, lag);

        this.setExplain(`✅ Task <strong>PID ${this.runningTask.pid} (${this.runningTask.name})</strong> finished execution! Turnaround: ${turnaround}s, Waiting: ${wait}s.`);

        this.terminal.log("SYSCALL", `sys_exit(): PID ${this.runningTask.pid} completed execution`, {
          task: this.runningTask.name,
          turnaround: `${turnaround}s`,
          waiting_time: `${wait}s`,
          stream_lag: `${lag}s`
        });

        this.runningTask = null;
        this.scheduleNext();
      } else if (this.algo === "MLQ") {
        // Check for round-robin time slice expiration or higher priority arrivals
        this.checkMLQPreemption();
      }
    }

    this.renderQueues();
    this.renderPCB();
    this.renderChart();
  }

  scheduleNext() {
    const readyTasks = this.tasks.filter(t => t.state === "READY" || t.state === "PREEMPTED");
    if (readyTasks.length === 0) {
      this.runningTask = null;
      return;
    }

    if (this.algo === "FCFS") {
      // First-Come, First-Served: Sort strictly by arrival time
      readyTasks.sort((a, b) => a.arrivalTime - b.arrivalTime);
      this.runningTask = readyTasks[0];
    } else {
      // Multilevel Queue:
      // Priority 0: Live Video (Strict RT Priority)
      // Priority 1: Production Control (Interactive)
      // Priority 2: Audience Requests
      // Priority 3: Backups (Background Batch)
      readyTasks.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.arrivalTime - b.arrivalTime;
      });
      this.runningTask = readyTasks[0];
    }

    if (this.runningTask) {
      this.runningTask.state = "RUNNING";
    }
  }

  checkMLQPreemption() {
    const readyTasks = this.tasks.filter(t => t.state === "READY" || t.state === "PREEMPTED");
    if (readyTasks.length === 0) return;

    // Does any task have higher priority than current?
    const higher = readyTasks.find(t => t.priority < this.runningTask.priority);
    if (higher) {
      this.terminal.log("SCHEDULER", `PREEMPTION TICK: PID ${higher.pid} (Prio ${higher.priority}) preempts PID ${this.runningTask.pid} (Prio ${this.runningTask.priority})!`, {
        preempted_task: this.runningTask.name,
        remaining: `${this.runningTask.remaining}s`
      });
      this.runningTask.state = "PREEMPTED";
      this.runningTask = null;
      this.scheduleNext();
    }
  }

  recordMetrics(resp, lag) {
    const m = this.metrics[this.algo];
    m.completed++;
    m.totalResponseTime += resp;
    m.totalLag += lag;
    m.history.push({
      time: this.clock,
      resp,
      lag,
      avgResp: (m.totalResponseTime / m.completed).toFixed(2),
      avgLag: (m.totalLag / m.completed).toFixed(2)
    });
  }

  renderQueues() {
    if (this.algo === "FCFS") {
      const activeItems = this.tasks.filter(t => t.state !== "TERMINATED");
      this.queuesContainer.innerHTML = `
        <div class="queue-row">
          <div class="queue-label"><span>FCFS Ingest Pipeline</span></div>
          <div class="queue-items">
            ${activeItems.length === 0 ? '<span class="text-muted">[No Ingest Jobs Queued]</span>' : ''}
            ${activeItems.map(t => `
              <div class="queue-node anim-enter ${t === this.runningTask ? 'active-exec' : ''}">
                <strong>PID ${t.pid}</strong>: ${t.name}
                <span class="status-tag status-${t.state.toLowerCase()}">${t.state}</span>
                <span>(${t.remaining}s left)</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      // Multilevel Queues (Q0, Q1, Q2)
      const q0 = this.tasks.filter(t => t.state !== "TERMINATED" && t.queueLevel === 0);
      const q1 = this.tasks.filter(t => t.state !== "TERMINATED" && t.queueLevel === 1);
      const q2 = this.tasks.filter(t => t.state !== "TERMINATED" && t.queueLevel === 2);

      this.queuesContainer.innerHTML = `
        <div class="queue-row">
          <div class="queue-label"><span>Q0: Real-Time 4K Live (RT)</span></div>
          <div class="queue-items">
            ${q0.length === 0 ? '<span class="text-muted">[No Live Jobs]</span>' : ''}
            ${q0.map(t => this.renderQueueNode(t)).join('')}
          </div>
        </div>
        <div class="queue-row">
          <div class="queue-label"><span>Q1: Audio & Transcode Ladder</span></div>
          <div class="queue-items">
            ${q1.length === 0 ? '<span class="text-muted">[Idle]</span>' : ''}
            ${q1.map(t => this.renderQueueNode(t)).join('')}
          </div>
        </div>
        <div class="queue-row">
          <div class="queue-label"><span>Q2: S3 Background Archive</span></div>
          <div class="queue-items">
            ${q2.length === 0 ? '<span class="text-muted">[Idle]</span>' : ''}
            ${q2.map(t => this.renderQueueNode(t)).join('')}
          </div>
        </div>
      `;
    }
  }

  renderQueueNode(t) {
    const isRunning = t === this.runningTask;
    return `
      <div class="queue-node anim-enter ${isRunning ? 'active-exec' : ''}">
        <strong>PID ${t.pid}</strong> ${t.name}
        <span class="status-tag status-${t.state.toLowerCase()}">${isRunning ? 'CPU ACTIVE' : t.state}</span>
        <span>rem:${t.remaining}s</span>
      </div>
    `;
  }

  renderPCB() {
    if (this.tasks.length === 0) {
      this.pcbTbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#555;">No processes currently active in OS PCB table.</td></tr>`;
      return;
    }

    this.pcbTbody.innerHTML = this.tasks.slice(-8).map(t => {
      const wait = (t.state === "TERMINATED") 
        ? (t.completionTime - t.arrivalTime - t.burst)
        : Math.max(0, this.clock - t.arrivalTime - (t.burst - t.remaining));
      const resp = t.startTime !== null ? `${t.startTime - t.arrivalTime}s` : "Pending";
      const lag = wait > 0 ? `${wait * 120}ms` : "0ms";

      return `
        <tr class="anim-enter">
          <td><strong>${t.pid}</strong></td>
          <td>${t.name}</td>
          <td>Q${t.queueLevel} (Prio ${t.priority})</td>
          <td>t=${t.arrivalTime}s</td>
          <td>${t.burst}s</td>
          <td><strong>${t.remaining}s</strong></td>
          <td><span class="status-tag status-${t.state.toLowerCase()}">${t.state}</span></td>
          <td>${wait}s</td>
          <td><span>${lag} (Resp: ${resp})</span></td>
        </tr>
      `;
    }).join('');
  }

  renderChart() {
    if (!this.chartContainer) return;

    // Metric summaries for FCFS vs MLQ
    const fcfsAvgResp = this.metrics.FCFS.completed > 0 ? (this.metrics.FCFS.totalResponseTime / this.metrics.FCFS.completed).toFixed(1) : "4.8";
    const fcfsAvgLag = this.metrics.FCFS.completed > 0 ? (this.metrics.FCFS.totalLag / this.metrics.FCFS.completed * 140).toFixed(0) : "670";
    
    const mlqAvgResp = this.metrics.MLQ.completed > 0 ? (this.metrics.MLQ.totalResponseTime / this.metrics.MLQ.completed).toFixed(1) : "0.9";
    const mlqAvgLag = this.metrics.MLQ.completed > 0 ? (this.metrics.MLQ.totalLag / this.metrics.MLQ.completed * 140).toFixed(0) : "110";

    // Max bounds for scaling: max response ~6s -> 220px, max lag ~800ms -> 220px
    const maxBarHeight = 220;
    const fcfsRespH = Math.max(16, Math.min(maxBarHeight, (parseFloat(fcfsAvgResp) / 6) * maxBarHeight));
    const fcfsLagH = Math.max(16, Math.min(maxBarHeight, (parseFloat(fcfsAvgLag) / 800) * maxBarHeight));

    const mlqRespH = Math.max(16, Math.min(maxBarHeight, (parseFloat(mlqAvgResp) / 6) * maxBarHeight));
    const mlqLagH = Math.max(16, Math.min(maxBarHeight, (parseFloat(mlqAvgLag) / 800) * maxBarHeight));

    this.chartContainer.innerHTML = `
      <div class="chart-inner-wrap">
        <!-- Legend at top -->
        <div class="chart-legend">
          <div class="legend-item">
            <span class="legend-swatch swatch-resp"></span>
            <span class="legend-text">Response Time (Latency)</span>
          </div>
          <div class="legend-item">
            <span class="legend-swatch swatch-lag"></span>
            <span class="legend-text">Stream Lag (Jitter delay)</span>
          </div>
        </div>

        <!-- Groups container -->
        <div class="chart-groups-flex">
          
          <!-- Group 1: FCFS -->
          <div class="chart-group">
            <div class="chart-bars-stage">
              <div class="chart-bar bar-resp" style="height: ${fcfsRespH}px;" title="FCFS Avg Response Time: ${fcfsAvgResp}s">
                <span class="bar-value-label">${fcfsAvgResp}s</span>
              </div>
              <div class="chart-bar bar-lag" style="height: ${fcfsLagH}px;" title="FCFS Avg Stream Lag: ${fcfsAvgLag}ms">
                <span class="bar-value-label">${fcfsAvgLag}ms</span>
              </div>
            </div>
            
            <div class="chart-baseline"></div>

            <div class="chart-group-meta">
              <div class="group-heading">First-Come, First-Served (FCFS)</div>
              <div class="group-metric-line">Avg Response: <strong>${fcfsAvgResp}s</strong></div>
              <div class="group-metric-line">Stream Lag: <strong>${fcfsAvgLag}ms</strong></div>
            </div>
          </div>

          <!-- Group 2: Multilevel Queue (Preemptive) -->
          <div class="chart-group">
            <div class="chart-bars-stage">
              <div class="chart-bar bar-resp" style="height: ${mlqRespH}px;" title="MLQ Avg Response Time: ${mlqAvgResp}s">
                <span class="bar-value-label">${mlqAvgResp}s</span>
              </div>
              <div class="chart-bar bar-lag" style="height: ${mlqLagH}px;" title="MLQ Avg Stream Lag: ${mlqAvgLag}ms">
                <span class="bar-value-label">${mlqAvgLag}ms</span>
              </div>
            </div>

            <div class="chart-baseline"></div>

            <div class="chart-group-meta">
              <div class="group-heading">Multilevel Queue (MLQ Preemptive)</div>
              <div class="group-metric-line">Avg Response: <strong>${mlqAvgResp}s</strong></div>
              <div class="group-metric-line">Stream Lag: <strong>${mlqAvgLag}ms</strong></div>
            </div>
          </div>

        </div>
      </div>
    `;
  }
}
