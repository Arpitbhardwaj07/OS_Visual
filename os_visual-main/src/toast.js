// src/toast.js
// System Event Toasts for Critical OS Hazards (Race conditions, MMU Page Faults, Preemption)

class ToastManager {
  constructor() {
    this.container = document.getElementById("toast-root");
  }

  show(message, type = "info", duration = 3000) {
    if (!this.container) {
      this.container = document.getElementById("toast-root");
      if (!this.container) return;
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    // Icon mapping
    let icon = "ℹ️";
    if (type === "hazard" || type === "collision") icon = "💥";
    else if (type === "fault") icon = "⚠️";
    else if (type === "preempt") icon = "🚨";
    else if (type === "success") icon = "✅";

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div class="toast-msg">${message}</div>
    `;

    this.container.appendChild(toast);

    // Trigger GPU-accelerated entrance animation
    requestAnimationFrame(() => {
      toast.classList.add("toast-show");
    });

    // Auto dismiss
    setTimeout(() => {
      toast.classList.remove("toast-show");
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 420);
    }, duration);
  }
}

export const toast = new ToastManager();
