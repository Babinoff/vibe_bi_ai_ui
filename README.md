<p align="center">
  <img src="ico.png" alt="BIUI Logo" width="200" />
</p>

# BI(AI)UI - Automated Business Intelligence Tool
https://youtu.be/bkBXZeKwJMc - demo
https://babinoff.github.io/vibe_bi_ai_ui/ - demo

**BI(AI)UI** is a modern application for automated business intelligence creation using a visual node-based interface and Artificial Intelligence capabilities (Gemini, Mistral, OpenAI, Claude). 

**Key Architectural Feature (Privacy-First):** All data is processed locally directly in the browser via WASM Python (Pyodide). Neural networks are used exclusively for writing transformation and visualization code, but **the user data itself is never sent to them** (only the dataset schema and small samples are transmitted).

---

## 🚀 Key Features

### 1. Interactive Data Pipeline (Node Canvas)
The main workspace is implemented based on `React Flow`. The analysis process is built by connecting specialized nodes:
- **DataSourceNode**: The entry point of the pipeline. Allows selecting a pre-loaded CSV dataset.
- **TransformNode**: Data transformation node. The user enters a prompt (e.g., "Group by date and calculate the sum"), the selected LLM generates Python code, and Pyodide executes it on the data using `pandas`.
- **WatchNode**: Inspector node. Displays the current state of the data in a convenient table (Data Grid).
- **VisualizationNode**: Chart configuration node. AI generates JavaScript functions to render charts based on popular libraries (ECharts, Chart.js, Plotly).
- **DashboardNode**: Exports the finished pipeline result (chart or table) to the final dashboard.

### 2. Data Source Panel
- Local loading and fast processing of CSV files (via `papaparse`).
- Management of loaded datasets, making them available for use in nodes.
- Storage of source data in a single high-performance application state (Zustand).

### 3. LLM Integration (AI Code Generation)
- **Multi-provider support:** Gemini, Mistral, OpenAI, Claude.
- Convenient prompt editor (`PromptEditor`) right inside the pipeline nodes.
- AI automatically selects the necessary `pandas` transformations or configurations for JS visualization libraries depending on the natural language task provided.

### 4. Presentation Layer (Dashboard)
- A separate panel (`DashboardPanel`) for viewing and arranging final widgets.
- Widgets passed from `DashboardNode` instantly appear on the dashboard.
- Scalable areas, free placement of charts, and convenient layout of the final interactive report.

---

## 🔄 Data Lifecycle

1. **Loading:** The user loads a CSV in the data source panel.
2. **Initialization:** The dataset is selected in the `DataSourceNode` on the canvas.
3. **Transformation:** Data is passed to the `TransformNode`. The user enters a prompt, the LLM writes Python code, and `Pyodide` safely applies it to the data in the browser.
4. **Analysis and Visualization:** Transformed data is inspected in the `WatchNode` or converted into a ready-made chart in the `VisualizationNode`.
5. **Presentation:** The finished widget (table or chart) is sent via the `DashboardNode` to the final dashboard.

---

## 🛠 Tech Stack
- **Frontend:** React 19, TypeScript, TailwindCSS
- **State Management:** Zustand
- **Visual Editor:** React Flow (`@xyflow/react`)
- **Local Data Processing:** Pyodide (WASM Python), Pandas
- **AI / LLM:** `@google/genai`, `@mistralai/mistralai`, direct REST APIs for OpenAI and Claude
