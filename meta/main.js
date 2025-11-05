// ---------- 引入 D3 ----------
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// ---------- Step 1.1: 读取 CSV ----------
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

// ---------- Step 1.2: 处理 commit ----------
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      const ret = {
        id: commit,
        url: "https://github.com/YOUR_USERNAME/YOUR_REPO/commit/" + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };
      Object.defineProperty(ret, "lines", {
        value: lines,
        enumerable: false,
      });
      return ret;
    });
}

// ---------- Step 1.3: Summary ----------
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
    .html((d) => `
      <div class="stat-label">${d.label}</div>
      <div class="stat-value">${d.value ?? "—"}</div>
    `);
}

// ---------- Tooltip ----------
function renderTooltipContent(commit) {
  const link = document.getElementById("commit-link");
  const date = document.getElementById("commit-date");
  const time = document.getElementById("commit-time");
  const author = document.getElementById("commit-author");
  const lines = document.getElementById("commit-lines");

  if (!commit) return;
  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleDateString("en", { dateStyle: "full" });
  time.textContent = commit.datetime?.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
  author.textContent = commit.author ?? "Unknown";
  lines.textContent = commit.totalLines ?? "—";
}

function updateTooltipVisibility(isVisible) {
  document.getElementById("commit-tooltip").hidden = !isVisible;
}
function updateTooltipPosition(event) {
  const tooltip = document.getElementById("commit-tooltip");
  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top = `${event.clientY + 12}px`;
}

// ---------- Step 4 + 5: 散点图 + Brushing ----------
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
    .style("overflow", "visible");

  // 半径比例尺（按行数）
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  // 排序（大点先画）
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  // 比例尺
  const xScale = d3.scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();
  const yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);

  // 网格线
  svg.append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width));

  // 散点
  const dots = svg.append("g").attr("class", "dots");
  dots.selectAll("circle")
    .data(sortedCommits)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", (d) => (d.hourFrac >= 6 && d.hourFrac < 18 ? "#ffb347" : "#4682b4"))
    .style("fill-opacity", 0.7)
    .on("mouseenter", (event, commit) => {
      d3.select(event.currentTarget).style("fill-opacity", 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mousemove", (event) => updateTooltipPosition(event))
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
      updateTooltipVisibility(false);
    });

  // 坐标轴
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");
  svg.append("g").attr("transform", `translate(0,${usableArea.bottom})`).call(xAxis);
  svg.append("g").attr("transform", `translate(${usableArea.left},0)`).call(yAxis);

  // 标题
  svg.append("text")
    .attr("x", usableArea.left + usableArea.width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .text("Commit Date");
  svg.append("text")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Time of Day (HH:00)");

  // ---------- Step 5.1: Brush ----------
  const brush = d3.brush()
    .on("start brush end", brushed);

  svg.call(brush);
  svg.selectAll(".dots, .overlay ~ *").raise();

  // ---------- Step 5.4: Brush事件 ----------
  function brushed(event) {
    const selection = event.selection;
    d3.selectAll("circle").classed("selected", (d) => isCommitSelected(selection, d));
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
  }

  function isCommitSelected(selection, commit) {
    if (!selection) return false;
    const [[x0, y0], [x1, y1]] = selection;
    const cx = xScale(commit.datetime);
    const cy = yScale(commit.hourFrac);
    return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
  }

  // ---------- Step 5.5: Count ----------
  function renderSelectionCount(selection) {
    const selected = selection ? commits.filter((d) => isCommitSelected(selection, d)) : [];
    const countEl = document.querySelector("#selection-count");
    countEl.textContent = `${selected.length || "No"} commits selected`;
    return selected;
  }

  // ---------- Step 5.6: Language breakdown ----------
  function renderLanguageBreakdown(selection) {
    const selected = selection ? commits.filter((d) => isCommitSelected(selection, d)) : [];
    const container = document.getElementById("language-breakdown");
    if (selected.length === 0) {
      container.innerHTML = "";
      return;
    }
    const lines = selected.flatMap((d) => d.lines);
    const breakdown = d3.rollup(lines, (v) => v.length, (d) => d.type);
    container.innerHTML = "";
    for (const [lang, count] of breakdown) {
      const prop = count / lines.length;
      const pct = d3.format(".1~%")(prop);
      container.innerHTML += `<dt>${lang}</dt><dd>${count} lines (${pct})</dd>`;
    }
  }
}

// ---------- 主程序 ----------
const data = await loadData();
const commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);