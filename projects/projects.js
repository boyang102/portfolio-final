// projects.js
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { renderProjects } from "../global.js";

async function loadProjects() {
  const res = await fetch("../lib/projects.json");
  const projects = await res.json();

  const projectsContainer = document.querySelector(".projects");
  const searchInput = document.querySelector(".searchBar");

  const svg = d3.select("#projects-pie-plot");
  const legend = d3.select(".legend");
  const colors = d3.scaleOrdinal(d3.schemeTableau10);

  // 当前筛选状态
  let query = "";
  let selectedYear = null;

  // 分组：统计每年数量
  function groupData(list) {
    const rolled = d3.rollups(list, v => v.length, d => d.year);
    // 保持年份升序（可按需调整）
    rolled.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    return rolled.map(([year, count]) => ({ label: String(year), value: count }));
  }

  // 过滤：按搜索 + 年份
  function getFilteredProjects() {
    const q = query.trim().toLowerCase();
    return projects.filter(p => {
      const txt =
        `${p.title ?? ""}\n${p.description ?? ""}\n${p.year ?? ""}`
          .toLowerCase();
      const matchQ = !q || txt.includes(q);
      const matchYear = !selectedYear || String(p.year) === String(selectedYear);
      return matchQ && matchYear;
    });
  }

  // 绘制饼图 + 图例（来自给定列表）
  function renderPieChart(list) {
    const data = groupData(list);
    const slice = d3.pie().value(d => d.value)(data);
    const arc = d3.arc().innerRadius(0).outerRadius(50);

    // 清空
    svg.selectAll("*").remove();
    legend.selectAll("*").remove();

    // 画扇区
    const paths = svg
      .selectAll("path")
      .data(slice)
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", (_, i) => colors(i))
      .attr("stroke", "white")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      // ✅ 纯 JS 的 hover 高亮（跨浏览器稳定）
      .on("mouseover", function () {
        svg.selectAll("path").attr("opacity", 0.5);
        d3.select(this).attr("opacity", 1);
      })
      .on("mouseout", function () {
        svg.selectAll("path").attr("opacity", 1);
      })
      .on("click", (_, d) => {
        const y = d.data.label;
        selectedYear = selectedYear === y ? null : y;
        updateAll(); // 重新渲染
      });

    // 画图例
    const items = legend
      .selectAll("li")
      .data(data)
      .enter()
      .append("li")
      .attr("style", (_, i) => `--color:${colors(i)}`)
      .classed("selected", d => String(d.label) === String(selectedYear))
      .html(d => `<span class="swatch"></span> <strong>${d.label}</strong> <em>(${d.value})</em>`)
      .style("cursor", "pointer")
      .on("mouseover", (_, d) => {
        // 图例 hover 同步高亮对应扇区
        paths.attr("opacity", p => (p.data.label === d.label ? 1 : 0.5));
      })
      .on("mouseout", () => paths.attr("opacity", 1))
      .on("click", (_, d) => {
        selectedYear = selectedYear === d.label ? null : d.label;
        updateAll();
      });

    // 根据 selectedYear 高亮扇区
    paths.classed("selected", p => String(p.data.label) === String(selectedYear));
  }

  // 一次性更新所有视图
  function updateAll() {
    const filtered = getFilteredProjects();
    renderProjects(filtered, projectsContainer, "h2");
    renderPieChart(filtered);
  }

  // 搜索：input + change 都监听（更稳）
  const onSearch = e => {
    query = e.target.value || "";
    updateAll();
  };
  searchInput.addEventListener("input", onSearch);
  searchInput.addEventListener("change", onSearch);

  // 初始渲染
  renderProjects(projects, projectsContainer, "h2");
  renderPieChart(projects);
}

loadProjects();