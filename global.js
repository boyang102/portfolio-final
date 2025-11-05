console.log("IT’S ALIVE!");

// ---------- 工具函数 ----------
function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// ---------- 自动导航栏 ----------
let pages = [
  { url: "index.html", title: "Home" },
  { url: "projects/index.html", title: "Projects" },
  { url: "contact/index.html", title: "Contact" },
  { url: "resume/index.html", title: "Resume" },
  { url: "meta/index.html", title: "Meta" }, 
  { url: "https://github.com/boyang102", title: "GitHub" },
];

let nav = document.createElement("nav");
document.body.prepend(nav);

// ---------- 自动识别当前仓库名 ----------
const repo = window.location.pathname.split("/")[1] || "";
const BASE_PATH =
  location.hostname.includes("localhost") || location.hostname.includes("127.0.0.1")
    ? "/"
    : `/${repo}/`;

for (let p of pages) {
  let url = p.url;
  let title = p.title;

  if (!url.startsWith("http")) url = BASE_PATH + p.url;

  let a = document.createElement("a");
  a.href = url;
  a.textContent = title;

  a.classList.toggle(
    "current",
    a.host === location.host && a.pathname === location.pathname
  );

  a.toggleAttribute("target", a.host !== location.host);
  nav.append(a);
}

// ---------- 主题切换 ----------
document.body.insertAdjacentHTML(
  "afterbegin",
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
`
);

let select = document.querySelector(".color-scheme select");

function setColorScheme(scheme) {
  document.documentElement.style.setProperty("color-scheme", scheme);
  select.value = scheme;
}

if ("colorScheme" in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

select.addEventListener("input", (event) => {
  const scheme = event.target.value;
  setColorScheme(scheme);
  localStorage.colorScheme = scheme;
  console.log("Color scheme changed to:", scheme);
});

// ---------- 联系表单 ----------
const form = document.querySelector("form");
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const params = [];
  for (let [name, value] of data) {
    params.push(`${name}=${encodeURIComponent(value)}`);
  }
  const url = `${form.action}?${params.join("&")}`;
  location.href = url;
});

// ---------- Step 1.2: Fetch JSON ----------
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error fetching JSON:", error);
    return [];
  }
}

// ---------- Step 1.4: Render Projects ----------
export function renderProjects(projects, containerElement, headingLevel = "h2") {
  if (!containerElement || !(containerElement instanceof HTMLElement)) return;

  containerElement.innerHTML = "";

  for (const project of projects) {
    const article = document.createElement("article");
    article.innerHTML = `
      <${headingLevel} class="project-title">${project.title ?? "Untitled Project"}</${headingLevel}>
      <img src="${project.image || 'https://via.placeholder.com/300x200?text=No+Image'}"
           alt="${project.title || "No title"}" />

      <div class="project-meta">
        <p class="project-desc">${project.description ?? ""}</p>
        <p class="project-year">${project.year ? String(project.year) : ""}</p>
      </div>
    `;
    containerElement.appendChild(article);
  }
}

// ---------- Step 3.2: Fetch GitHub Data ----------
export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}