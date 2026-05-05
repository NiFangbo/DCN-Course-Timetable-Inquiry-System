const statusEl = document.getElementById("status");
const adminStatusEl = document.getElementById("admin-status");
const resultsBody = document.querySelector("#results-table tbody");

function setStatus(element, message, type = "") {
  element.textContent = message || "";
  element.classList.remove("error", "success");
  if (type) {
    element.classList.add(type);
  }
}

function getAdminCredentials() {
  const username = document.getElementById("admin-user").value.trim();
  const password = document.getElementById("admin-pass").value.trim();
  if (!username || !password) {
    throw new Error("请输入管理员账号和密码");
  }
  return { username, password };
}

function renderCourses(courses) {
  resultsBody.innerHTML = "";
  courses.forEach((course) => {
    const row = document.createElement("tr");
    [
      course.code,
      course.title,
      course.section,
      course.instructor,
      course.time,
      course.classroom,
      course.semester,
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value || "";
      row.appendChild(cell);
    });
    resultsBody.appendChild(row);
  });
}

async function apiPost(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`响应不是有效的 JSON: ${error.message}`);
  }
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || `请求失败 (${response.status})`);
  }
  return data;
}

document.getElementById("query-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const type = document.getElementById("query-type").value;
  const value = document.getElementById("query-value").value.trim();
  if (!value) {
    setStatus(statusEl, "请输入查询关键字", "error");
    return;
  }
  setStatus(statusEl, "查询中...");
  try {
    const data = await apiPost("/api/query", { type, value });
    renderCourses(data.courses || []);
    setStatus(statusEl, `共 ${data.count || 0} 条结果`, "success");
  } catch (error) {
    renderCourses([]);
    setStatus(statusEl, error.message, "error");
  }
});

document.getElementById("list-all").addEventListener("click", async () => {
  setStatus(statusEl, "查询中...");
  try {
    const data = await apiPost("/api/list");
    renderCourses(data.courses || []);
    setStatus(statusEl, `共 ${data.count || 0} 条结果`, "success");
  } catch (error) {
    renderCourses([]);
    setStatus(statusEl, error.message, "error");
  }
});

document.getElementById("add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const admin = getAdminCredentials();
    const course = {
      code: document.getElementById("add-code").value.trim(),
      title: document.getElementById("add-title").value.trim(),
      section: document.getElementById("add-section").value.trim(),
      instructor: document.getElementById("add-instructor").value.trim(),
      time: document.getElementById("add-time").value.trim(),
      classroom: document.getElementById("add-classroom").value.trim(),
      semester: document.getElementById("add-semester").value.trim(),
    };
    const data = await apiPost("/api/add", { admin, course });
    setStatus(adminStatusEl, data.message || "新增成功", "success");
  } catch (error) {
    setStatus(adminStatusEl, error.message, "error");
  }
});

document.getElementById("update-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const admin = getAdminCredentials();
    const code = document.getElementById("update-code").value.trim();
    const field = document.getElementById("update-field").value;
    const value = document.getElementById("update-value").value.trim();
    const data = await apiPost("/api/update", { admin, code, field, value });
    setStatus(adminStatusEl, data.message || "更新成功", "success");
  } catch (error) {
    setStatus(adminStatusEl, error.message, "error");
  }
});

document.getElementById("delete-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const admin = getAdminCredentials();
    const code = document.getElementById("delete-code").value.trim();
    const data = await apiPost("/api/delete", { admin, code });
    setStatus(adminStatusEl, data.message || "删除成功", "success");
  } catch (error) {
    setStatus(adminStatusEl, error.message, "error");
  }
});
