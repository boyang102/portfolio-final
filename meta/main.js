// ---------- 引入 D3 ----------
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// ---------- 全局变量 ----------
let commitProgress = 100;
let timeScale;
let commitMaxTime;
let filteredCommits;

let xScale;
let yScale;

// ---------- 读取 CSV ----------
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

// ---------- 处理 commit ----------
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, datetime } = first;
      const ret = {
        id: commit,
        url: "https://github.com/YOUR_USERNAME/YOUR_REPO/commit/" + commit,
        author,
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

// ---------- Summary：支持任意 filtered 数据 ----------
function renderCommitInfo(dataLines, commits) {
  // 每次重建，避免叠加
  d3.select("#stats").html("");

  const totalLOC = dataLines.length;
  const totalCommits = commits.length;
  const numFiles = d3.group(dataLines, (d) => d.file).size;
  const maxDepth = d3.max(dataLines, (d) => d.depth);
  const longestLine = d3.max(dataLines, (d) => d.length);
  const maxLines = d3.max(dataLines, (d) => d.line);

  const container = d3
    .select("#stats")
    .append("div")
    .attr("class", "summary-card");
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
  date.textContent = commit.datetime?.toLocaleDateString("en", {
    dateStyle: "full",
  });
  time.textContent = commit.datetime?.toLocaleTimeString("en", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

// ---------- 初始化 timeScale ----------
function initTimeFilter(commits) {
  timeScale = d3
    .scaleTime()
    .domain([
      d3.min(commits, (d) => d.datetime),
      d3.max(commits, (d) => d.datetime),
    ])
    .range([0, 100]);

  filteredCommits = commits;
  commitMaxTime = timeScale.invert(commitProgress);
}

// ---------- Slider 事件 ----------
function onTimeSliderChange() {
  const slider = document.getElementById("commit-progress");
  commitProgress = +slider.value;
  commitMaxTime = timeScale.invert(commitProgress);

  // 更新 slider 右侧的时间（注意这里用的是 commit-slider-time）
  document.getElementById("commit-slider-time").textContent =
    commitMaxTime.toLocaleString("en", {
      dateStyle: "long",
      timeStyle: "short",
    });

  // 过滤 commits
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  // 过滤对应的行
  const filteredLines = filteredCommits.flatMap((d) => d.lines);

  // 更新 summary + 散点图 + 文件可视化
  renderCommitInfo(filteredLines, filteredCommits);
  updateScatterPlot(data, filteredCommits);
  updateFileDisplay(filteredCommits);
}

// ---------- 散点图 + Brush ----------
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

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  // 全局 scale，方便 update 使用
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();
  yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);

  // 网格线
  svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width));

  // 点
  const dots = svg.append("g").attr("class", "dots");
  dots
    .selectAll("circle")
    .data(sortedCommits, (d) => d.id) // 🔑 用 id 作为 key，保证动画稳定
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .attr("fill", (d) =>
      d.hourFrac >= 6 && d.hourFrac < 18 ? "#ffb347" : "#4682b4"
    )
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
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");

  svg
    .append("g")
    .attr("transform", `translate(0,${usableArea.bottom})`)
    .attr("class", "x-axis")
    .call(xAxis);

  svg
    .append("g")
    .attr("transform", `translate(${usableArea.left},0)`)
    .attr("class", "y-axis")
    .call(yAxis);

  // 标题
  svg
    .append("text")
    .attr("x", usableArea.left + usableArea.width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .text("Commit Date");

  svg
    .append("text")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Time of Day (HH:00)");

  // Brush（保持你原来的逻辑）
  const brush = d3.brush().on("start brush end", brushed);

  svg.call(brush);
  svg.selectAll(".dots, .overlay ~ *").raise();

  function isCommitSelected(selection, commit) {
    if (!selection) return false;
    const [[x0, y0], [x1, y1]] = selection;
    const cx = xScale(commit.datetime);
    const cy = yScale(commit.hourFrac);
    return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
  }

  function renderSelectionCount(selection) {
    const selected = selection
      ? commits.filter((d) => isCommitSelected(selection, d))
      : [];
    const countEl = document.querySelector("#selection-count");
    if (countEl) {
      countEl.textContent = `${selected.length || "No"} commits selected`;
    }
    return selected;
  }

  function renderLanguageBreakdown(selection) {
    const selected = selection
      ? commits.filter((d) => isCommitSelected(selection, d))
      : [];
    const container = document.getElementById("language-breakdown");
    if (!container) return;

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

  function brushed(event) {
    const selection = event.selection;
    d3.selectAll("circle").classed("selected", (d) =>
      isCommitSelected(selection, d)
    );
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
  }
}

// ---------- 更新散点图（只改 x + 点） ----------
function updateScatterPlot(data, commits) {
  const svg = d3.select("#chart").select("svg");
  const dots = svg.select("g.dots");

  // 更新 xScale domain
  xScale.domain(d3.extent(commits, (d) => d.datetime));

  // 更新 x 轴
  const xAxisGroup = svg.select("g.x-axis");
  xAxisGroup.selectAll("*").remove();
  xAxisGroup.call(d3.axisBottom(xScale));

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll("circle")
    .data(sortedCommits, (d) => d.id)
    .join(
      (enter) =>
        enter
          .append("circle")
          .attr("cx", (d) => xScale(d.datetime))
          .attr("cy", (d) => yScale(d.hourFrac))
          .attr("r", 0)
          .attr("fill", (d) =>
            d.hourFrac >= 6 && d.hourFrac < 18 ? "#ffb347" : "#4682b4"
          )
          .style("fill-opacity", 0.7)
          .transition()
          .attr("r", (d) => rScale(d.totalLines)),
      (update) =>
        update
          .transition()
          .attr("cx", (d) => xScale(d.datetime))
          .attr("cy", (d) => yScale(d.hourFrac))
          .attr("r", (d) => rScale(d.totalLines)),
      (exit) => exit.transition().attr("r", 0).remove()
    );
}

// ---------- Step 2: File Unit Visualization ----------
function updateFileDisplay(filteredCommits) {
  const lines = filteredCommits.flatMap((d) => d.lines);

  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  let filesContainer = d3
    .select("#files")
    .selectAll("div")
    .data(files, (d) => d.name)
    .join((enter) =>
      enter.append("div").call((div) => {
        div.append("dt").append("code");
        div.append("dd");
      })
    );

  filesContainer
    .select("dt > code")
    .html((d) => `${d.name} <br><small>${d.lines.length} lines</small>`);

  const colors = d3.scaleOrdinal(d3.schemeTableau10);

  filesContainer
    .select("dd")
    .selectAll("div")
    .data((d) => d.lines)
    .join("div")
    .attr("class", "loc")
    .style("background", (d) => colors(d.type));
}

// ---------- 主程序 ----------
const data = await loadData();
const commits = processCommits(data);

// 初始状态：用全部数据
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

initTimeFilter(commits);

// 初始时用 full data 更新 slider 右侧时间 + 文件 unit vis
document.getElementById("commit-slider-time").textContent =
  commitMaxTime.toLocaleString("en", {
    dateStyle: "long",
    timeStyle: "short",
  });

updateFileDisplay(commits);

// 绑定 slider 事件
document
  .getElementById("commit-progress")
  .addEventListener("input", onTimeSliderChange);