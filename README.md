# Cloud Resource Allocation Optimizer (GitHub Pages)

A browser-based educational micro-project using HTML, CSS and JavaScript. It simulates dependency-aware task scheduling and virtual-machine allocation.

## Files
- `index.html` — page layout and project explanation
- `style.css` — responsive visual design
- `script.js` — scheduling logic, DAG validation, critical path, metrics and comparison

## Publish with GitHub Pages
1. Create a GitHub repository, e.g. `cloud-resource-optimizer`.
2. Upload all three files (`index.html`, `style.css`, `script.js`) to the repository root.
3. Open repository **Settings → Pages**.
4. Under Build and deployment, choose **Deploy from a branch**.
5. Choose branch `main`, folder `/ (root)`, then Save.
6. Wait for GitHub Pages to publish. Open the URL shown in the Pages section.

## Included
- Editable task and VM tables
- Dependency checks and cycle detection for a DAG
- Topological ordering
- FCFS, duration-based greedy heuristic and dependency-aware time-sliced Round Robin simulations
- Critical path calculation
- Makespan, estimated utilization and throughput
- Comparison chart and CSV export

## Scope and limitations
This is a simulation and does not connect to actual AWS, Azure or Google Cloud resources. The greedy heuristic is not guaranteed to be globally optimal. Utilization is a simplified estimate: total task durations divided by makespan times the sum of VM CPU capacities, capped at 100%. The Round Robin simulation models time slices sequentially with dependencies; it is an educational model, not a full concurrent cloud scheduler. For a formal submission, test with several inputs and clearly describe the model assumptions in the report.
