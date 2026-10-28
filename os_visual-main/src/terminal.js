// src/terminal.js
// Runtime event log for the operating systems simulations.

export class KernelTerminal {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.logs = [];
    this.init();
  }

  init() {
    this.container.innerHTML = "";
    this.log("SYSTEM", "Operating systems visualizer initialized.");

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
    const timeLabel = document.createElement("span");
    timeLabel.className = "log-time";
    timeLabel.textContent = `[${time}]`;
    const categoryLabel = document.createElement("span");
    categoryLabel.className = catClass;
    categoryLabel.textContent = `[${category}]`;
    row.append(timeLabel, categoryLabel, document.createTextNode(` ${message}`));
    if (details) row.append(document.createTextNode(` | ${JSON.stringify(details)}`));
    this.container.appendChild(row);
    this.container.scrollTop = this.container.scrollHeight;
  }

  clear() {
    this.container.innerHTML = "";
    this.logs = [];
    this.log("SYSTEM", "Event log cleared.");
  }

  exportLogs() {
    const raw = this.logs.map(l => `[${l.time}] [${l.category}] ${l.message} ${l.details ? JSON.stringify(l.details) : ""}`).join("\n");
    const blob = new Blob([raw], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `os_kernel_telemetry_${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
