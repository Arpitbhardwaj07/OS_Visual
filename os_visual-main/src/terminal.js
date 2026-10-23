// src/terminal.js
// Prominent dark‑mode terminal logger watermarked with student credentials

export class KernelTerminal {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.logs = [];
    this.init();
  }

  init() {
    this.container.innerHTML = "";
    // Watermark header as strictly requested
    const watermark = document.createElement("div");
    watermark.className = "log-entry log-watermark";
    watermark.innerHTML = `[KERNEL BOOT] Session authenticated: 24BCB0116<br/>Linux 6.8.0-31-generic #31-Ubuntu SMP PREEMPT_DYNAMIC LiveConcert-RT<br/>System telemetry and OS state change hooks initialized.`;
    this.container.appendChild(watermark);

    // Hook up clear & export buttons (they exist in the side terminal panel)
    const clearBtn = document.getElementById("btn-clear-term");
    if (clearBtn) clearBtn.addEventListener("click", () => this.clear());
    const exportBtn = document.getElementById("btn-export-term");
    if (exportBtn) exportBtn.addEventListener("click", () => this.exportLogs());
  }

  log(category, message, details = null) {
    const time = new Date().toISOString().split("T")[1].replace("Z", "");
    const entry = { time, category, message, details };
    this.logs.push(entry);
    const row = document.createElement("div");
    row.className = "log-entry";
    let catClass = "log-tag-SYS";
    if (category === "SCHEDULER") catClass = "log-tag-SCHED";
    if (category === "PAGING") catClass = "log-tag-MEM";
    if (category === "CONCURRENCY") catClass = "log-tag-SYNC";
    const detailStr = details ? ` | ${JSON.stringify(details)}` : "";
    row.innerHTML = `<span class="log-time">[${time}]</span><span class="${catClass}">[${category}]</span> ${message}${detailStr}`;
    this.container.appendChild(row);
    this.container.scrollTop = this.container.scrollHeight;
  }

  clear() {
    this.container.innerHTML = "";
    const watermark = document.createElement("div");
    watermark.className = "log-entry log-watermark";
    watermark.innerHTML = `[KERNEL AUDIT] Session authenticated: 24BCB0116 (Terminal Buffer Cleared)`;
    this.container.appendChild(watermark);
  }

  exportLogs() {
    const raw = this.logs.map(l => `[${l.time}] [${l.category}] ${l.message} ${l.details ? JSON.stringify(l.details) : ""}`).join("\n");
    const blob = new Blob([`Session authenticated: 24BCB0116\n\n${raw}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `os_kernel_telemetry_${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
