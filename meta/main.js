import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// ---------- Step 1: Global vars ----------
let commitProgress = 100;
let timeScale;
let commitMaxTime;
let filteredCommits;

// ===============================================
// 🔥 LOAD DATA
// ===============================================
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

// ===============================================
// 🔥 FORMAT COMMITS
// ===============================================
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

// ===============================================
// 🔥 SUMMARY
// ===============================================
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

// ===============================================
// 🔥 TOOLTIP
// ===============================================
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

// ===============================================
// 🔥 INIT TIME SCALE
// ===============================================
function initTimeFilter(commits) {
  timeScale = d3.scaleTime()
    .domain([
      d3.min(commits, d => d.datetime),
      d3.max(commits, d => d.datetime)
    ])
    .range([0, 100]);

  filteredCommits = commits;
  commitMaxTime = timeScale.invert(commitProgress);
}

// ===============================================
// 🔥 SLIDER EVENT
// ===============================================
function onTimeSliderChange() {
  const slider = document.getElementById("commit-progress");
  commitProgress = +slider.value;
  commitMaxTime = timeScale.invert(commitProgress);

  document.getElementById("commit-time").textContent =
    commitMaxTime.toLocaleString("en", {
      dateStyle: "long",
      timeStyle: "short",
    });

  filteredCommits = commits.filter(d => d.datetime <= commitMaxTime);

  updateScatterPlot(data, filteredCommits);
}

// ===============================================
// 🔥 SCATTER PLOT
// ===============================================
let xScale, yScale;

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

  xScale = d3.scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);

  svg.append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width));

  const dots = svg.append("g").attr("class", "dots");

  dots.selectAll("circle")
    .data(sortedCommits, d => d.id)
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

  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");

  svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${usableArea.bottom})`)
    .call(xAxis);

  svg.append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${usableArea.left},0)`)
    .call(yAxis);

  // Brush remains unchanged...
}

// ===============================================
// 🔥 UPDATE SCATTER PLOT
// ===============================================
function updateScatterPlot(data, commits) {
  const svg = d3.select("#chart").select("svg");
  const dots = svg.select("g.dots");

  xScale.domain(d3.extent(commits, d => d.datetime));

  const xAxis = d3.axisBottom(xScale);
  const xAxisGroup = svg.select("g.x-axis");
  xAxisGroup.selectAll("*").remove();
  xAxisGroup.call(xAxis);

  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll("circle")
    .data(sortedCommits, d => d.id)
    .join(
      enter => enter
        .append("circle")
        .attr("cx", d => xScale(d.datetime))
        .attr("cy", d => yScale(d.hourFrac))
        .attr("r", 0)
        .transition()
        .attr("r", d => rScale(d.totalLines)),
      update => update
        .transition()
        .attr("cx", d => xScale(d.datetime))
        .attr("cy", d => yScale(d.hourFrac))
        .attr("r", d => rScale(d.totalLines)),
      exit => exit.transition().attr("r", 0).remove()
    )
    .attr("fill", d => (d.hourFrac >= 6 && d.hourFrac < 18 ? "#ffb347" : "#4682b4"))
    .style("fill-opacity", 0.7);
}

// ===============================================
// 🔥 MAIN
// ===============================================
const data = await loadData();
const commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

initTimeFilter(commits);
onTimeSliderChange();

document.getElementById("commit-progress")
  .addEventListener("input", onTimeSliderChange);