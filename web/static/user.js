const statusEl = document.getElementById("status");
const resultsBody = document.querySelector("#results-table tbody");

function setStatus(message, type) {
    statusEl.textContent = message || "";
    statusEl.className = "status";
    if (type) {
        statusEl.classList.add(type);
    }
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
        throw new Error(`Invalid JSON response: ${error.message}`);
    }
    if (!response.ok || data.ok === false) {
        throw new Error(data.message || `Request failed (${response.status})`);
    }
    return data;
}

async function performQuery(type, value) {
    if (!value) {
        setStatus("Please enter a keyword", "error");
        return;
    }
    setStatus("Searching...");
    try {
        const data = await apiPost("/api/query", { type, value });
        renderCourses(data.courses || []);
        setStatus(`Found ${data.count || 0} result(s)`, "success");
    } catch (error) {
        renderCourses([]);
        setStatus(error.message, "error");
    }
}

async function listAll() {
    setStatus("Loading...");
    try {
        const data = await apiPost("/api/list", {});
        renderCourses(data.courses || []);
        setStatus(`Found ${data.count || 0} course(s)`, "success");
    } catch (error) {
        renderCourses([]);
        setStatus(error.message, "error");
    }
}

function goBack() {
    window.location.href = "/";
}

document.getElementById("query-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const type = document.getElementById("query-type").value;
    const value = document.getElementById("query-value").value.trim();
    await performQuery(type, value);
});

document.getElementById("list-all").addEventListener("click", async () => {
    await listAll();
});

document.getElementById("back-btn").addEventListener("click", goBack);

// Load all courses on page load
listAll();