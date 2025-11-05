// ---------- 引入 D3 ----------
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// ---------- Step 1.1: 读取 CSV 并进行类型转换 ----------
async function loadData() {
  const data = await d3.csv("loc.csv", (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    date: new Date(row.date + "T00:00" + (row.timezone || "")),
    datetime: new Date(row.datetime || row.date),
  }));
  return data;
}

// ---------- Step 1.2: 处理 commit 信息 ----------
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;

      const ret = {
        id: commit,
        url: "https://github.com/YOUR_USERNAME/YOUR_REPO/commit/" + commit, // ← 改成你的仓库链接
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      // 隐藏原始 lines（可访问，不打印）
      Object.defineProperty(ret, "lines", {
        value: lines,
        enumerable: false,
        configurable: true,
        writable: false,
      });

      return ret;
    });
}

// ---------- Step 1.3: 显示统计信息 ----------
function renderCommitInfo(data, commits) {
  const totalLOC = data.length;
  const totalCommits = commits.length;
  const numFiles = d3.group(data, (d) => d.file).size;
  const maxDepth = d3.max(data, (d) => d.depth);
  const longestLine = d3.max(data, (d) => d.length);
  const maxLines = d3.max(data, (d) => d.line);

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

  d3.select("#stats")
    .append("figcaption")
    .attr("class", "figure-caption")
    .text("Figure 1: Summary statistics of this codebase");
}

// ---------- Step 2: 可视化 Commits 时间散点图 ----------
function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible")
    .style("border", "1px solid #eee"); // 可选：调试时显示边框

  // 检查数据范围
  console.log("📅 Date range:", d3.extent(commits, (d) => d.datetime));

  // 比例尺
  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  const yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // 网格线
  const gridlines = svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width));

  // 散点
  const dots = svg.append("g").attr("class", "dots");

  dots
    .selectAll("circle")
    .data(commits)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", 5)
    .attr("fill", (d) => {
      const hour = d.hourFrac;
      return hour >= 6 && hour < 18 ? "#ffb347" : "#4682b4"; // 白天橙色，夜晚蓝色
    })
    .attr("opacity", 0.8);

  // 坐标轴
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");

  svg
    .append("g")
    .attr("transform", `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg
    .append("g")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  // 轴标题
  svg
    .append("text")
    .attr("x", usableArea.left + usableArea.width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .attr("font-size", "14px")
    .text("Commit Date");

  svg
    .append("text")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .attr("font-size", "14px")
    .text("Time of Day (HH:00)");
}

// ---------- 主程序执行 ----------
const data = await loadData();
console.log("✅ Loaded data sample:", data.slice(0, 3));

const commits = processCommits(data);
console.log("✅ Commits processed:", commits.slice(0, 3));

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);