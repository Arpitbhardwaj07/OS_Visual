# OS Visualizer

An interactive, browser-based learning tool for exploring core operating systems concepts. The visualizer brings CPU scheduling, paging, and process synchronization together in one interface, with controls to step through simulations and inspect their state.

## Features

- **CPU scheduling:** Add interactive, system, batch, and background processes. Compare First-Come, First-Served (FCFS) with preemptive multilevel queue scheduling, and inspect process states and timing metrics.
- **Memory management:** Request virtual pages and observe page hits, page faults, and replacement decisions using FIFO or Least Recently Used (LRU). The simulator models four physical frames.
- **Process synchronization:** Run producer and consumer workers against a bounded buffer. Toggle mutex protection to see how synchronization changes worker behavior; the interface also displays semaphore and mutex state.
- **Kernel-style event terminal:** Follow simulation events as processes run, pages are requested, and workers interact.

These are educational simulations implemented in JavaScript. They illustrate operating systems ideas and do not interact with or modify the host operating system.

## Run locally

You need Python 3 installed. From the repository root, start the local static file server:

```powershell
cd os_visual-main
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser. Stop the server with `Ctrl+C` in the terminal.

No package installation is required. The `npm start` script runs the same Python HTTP server if you prefer:

```powershell
cd os_visual-main
npm start
```

## Project structure

```text
os_visual-main/
├── index.html          # Application page and simulator controls
├── css/style.css       # Layout and visual styling
├── src/App.js          # App initialization and navigation
├── src/scheduling.js   # CPU scheduling simulation
├── src/memory.js       # Paging and page replacement simulation
├── src/concurrency.js  # Producer-consumer and synchronization simulation
├── src/terminal.js     # Event terminal
└── src/toast.js        # Toast notifications
```

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
