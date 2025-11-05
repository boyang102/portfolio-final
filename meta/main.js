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
  const dl = d3.select("#stats").append("dl").attr("class", "stats");

  // 总行数
  dl.append("dt").html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append("dd").text(data.length);

  // 总 commits
  dl.append("dt").text("Total commits");
  dl.append("dd").text(commits.length);

  // 文件数（去重）
  const numFiles = d3.group(data, (d) => d.file).size;
  dl.append("dt").text("Number of files");
  dl.append("dd").text(numFiles);

  // 最大 depth 和平均 depth
  const maxDepth = d3.max(data, (d) => d.depth);
  const avgDepth = d3.mean(data, (d) => d.depth);
  dl.append("dt").text("Max depth");
  dl.append("dd").text(maxDepth);
  dl.append("dt").text("Average depth");
  dl.append("dd").text(avgDepth.toFixed(2));

  // 平均行长（字符数）
  const avgLineLength = d3.mean(data, (d) => d.length);
  dl.append("dt").text("Average line length");
  dl.append("dd").text(avgLineLength.toFixed(1));
}

// ---------- 主程序执行 ----------
const data = await loadData();
console.log("✅ Loaded data sample:", data.slice(0, 3));

const commits = processCommits(data);
console.log("✅ Commits processed:", commits.slice(0, 3));

renderCommitInfo(data, commits);