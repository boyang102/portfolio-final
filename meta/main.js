import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// ---------- Step 1.1 读取 CSV 并进行类型转换 ----------
async function loadData() {
  const data = await d3.csv("loc.csv", (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    date: new Date(row.date + "T00:00" + row.timezone),
    datetime: new Date(row.datetime),
  }));
  return data;
}

// ---------- Step 1.2 处理 commit 信息 ----------
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;

      const ret = {
        id: commit,
        url: "https://github.com/YOUR_USERNAME/YOUR_REPO/commit/" + commit, // ← 改成你自己仓库路径
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      // 隐藏 lines 属性（不显示在 console 中）
      Object.defineProperty(ret, "lines", {
        value: lines,
        enumerable: false,
        configurable: true,
        writable: false,
      });

      return ret;
    });
}

// ---------- Step 1.3 显示统计信息 ----------
function renderCommitInfo(data, commits) {
    // === 计算汇总指标 ===
    const totalLOC = data.length;
    const totalCommits = commits.length;
    const numFiles = d3.group(data, (d) => d.file).size;
    const maxDepth = d3.max(data, (d) => d.depth);
    const longestLine = d3.max(data, (d) => d.length);
    const maxLines = d3.max(data, (d) => d.line);
  
    // === 创建 Summary 卡片容器 ===
    const container = d3.select("#stats").append("div").attr("class", "summary-card");
  
    container.append("h2").text("Summary");
  
    const grid = container.append("div").attr("class", "summary-grid");
  
    const stats = [
      { label: "COMMITS", value: totalCommits },
      { label: "FILES", value: numFiles },
      { label: "TOTAL LOC", value: totalLOC },
      { label: "MAX DEPTH", value: maxDepth },
      { label: "LONGEST LINE", value: longestLine },
      { label: "MAX LINES", value: maxLines },
    ];
  
    // === 使用 D3 渲染每个指标 ===
    grid
      .selectAll("div.stat")
      .data(stats)
      .enter()
      .append("div")
      .attr("class", "stat")
      .html(
        (d) => `
          <div class="stat-label">${d.label}</div>
          <div class="stat-value">${d.value ?? "—"}</div>
        `
      );
  
    // （可选）添加图注
    d3.select("#stats")
      .append("figcaption")
      .attr("class", "figure-caption")
      .text("Figure 1: Summary statistics of this codebase");
  }
  
  // ---------- 主程序执行 ----------
  const data = await loadData();
  console.log("✅ Loaded data sample:", data.slice(0, 3));
  
  const commits = processCommits(data);
  console.log("✅ Commits processed:", commits.slice(0, 3));
  
  renderCommitInfo(data, commits);