// DOM elements
const statusEl = document.getElementById("status");
const adminStatusEl = document.getElementById("admin-status");
const resultsBody = document.querySelector("#results-table tbody");

// Session check - redirect to login if not authenticated
const isAdminLoggedIn = sessionStorage.getItem('isAdminLoggedIn');
const adminUsername = sessionStorage.getItem('adminUsername');

if (!isAdminLoggedIn || !adminUsername) {
    window.location.href = '/';
}

function setStatus(element, message, type) {
    if (!element) return;
    element.textContent = message || "";
    element.classList.remove("error", "success");
    
    if (!message) {
        element.style.display = 'none';
    } else {
        element.style.display = 'block';
        if (type) {
            element.classList.add(type);
        }
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
        setStatus(statusEl, "Please enter a keyword", "error");
        return;
    }
    setStatus(statusEl, "Searching...");
    try {
        const data = await apiPost("/api/query", { type, value });
        renderCourses(data.courses || []);
        setStatus(statusEl, `Found ${data.count || 0} result(s)`, "success");
        setTimeout(() => {
            if (statusEl.textContent === `Found ${data.count || 0} result(s)`) {
                setStatus(statusEl, "", "");
            }
        }, 3000);
    } catch (error) {
        renderCourses([]);
        setStatus(statusEl, error.message, "error");
    }
}

async function listAll() {
    setStatus(statusEl, "Loading...");
    try {
        const data = await apiPost("/api/list", {});
        renderCourses(data.courses || []);
        setStatus(statusEl, `Found ${data.count || 0} course(s)`, "success");
        setTimeout(() => {
            if (statusEl.textContent === `Found ${data.count || 0} course(s)`) {
                setStatus(statusEl, "", "");
            }
        }, 3000);
    } catch (error) {
        renderCourses([]);
        setStatus(statusEl, error.message, "error");
    }
}

async function addCourse(courseData) {
    const payload = {
        admin: {
            username: adminUsername,
            password: sessionStorage.getItem('adminPassword') || ''
        },
        course: courseData
    };
    
    const response = await fetch('/api/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    return data;
}

async function updateCourse(code, field, value) {
    const payload = {
        admin: {
            username: adminUsername,
            password: sessionStorage.getItem('adminPassword') || ''
        },
        code: code,
        field: field,
        value: value
    };
    
    const response = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    return data;
}

async function deleteCourse(code) {
    const payload = {
        admin: {
            username: adminUsername,
            password: sessionStorage.getItem('adminPassword') || ''
        },
        code: code
    };
    
    const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    return data;
}

function goBack() {
    // Clear admin session and return to selection page
    sessionStorage.removeItem('isAdminLoggedIn');
    sessionStorage.removeItem('adminUsername');
    sessionStorage.removeItem('adminPassword');
    window.location.href = '/';
}

// Query event listeners
const queryForm = document.getElementById("query-form");
const listAllBtn = document.getElementById("list-all");

if (queryForm) {
    queryForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const type = document.getElementById("query-type").value;
        const value = document.getElementById("query-value").value.trim();
        await performQuery(type, value);
    });
}

if (listAllBtn) {
    listAllBtn.addEventListener("click", async () => {
        await listAll();
    });
}

// Admin action event listeners
const addForm = document.getElementById("add-form");
if (addForm) {
    addForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const course = {
            code: document.getElementById("add-code").value.trim(),
            title: document.getElementById("add-title").value.trim(),
            section: document.getElementById("add-section").value.trim(),
            instructor: document.getElementById("add-instructor").value.trim(),
            time: document.getElementById("add-time").value.trim(),
            classroom: document.getElementById("add-classroom").value.trim(),
            semester: document.getElementById("add-semester").value.trim()
        };
        
        setStatus(adminStatusEl, "Adding course...", "");
        try {
            const result = await addCourse(course);
            if (result.ok) {
                setStatus(adminStatusEl, "Course added successfully", "success");
                addForm.reset();
                await listAll();
                setTimeout(() => {
                    if (adminStatusEl.textContent === "Course added successfully") {
                        setStatus(adminStatusEl, "", "");
                    }
                }, 3000);
            } else {
                setStatus(adminStatusEl, result.message || "Failed to add course", "error");
            }
        } catch (error) {
            setStatus(adminStatusEl, error.message, "error");
        }
    });
}

const updateForm = document.getElementById("update-form");
if (updateForm) {
    updateForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const code = document.getElementById("update-code").value.trim();
        const field = document.getElementById("update-field").value;
        const value = document.getElementById("update-value").value.trim();
        
        if (!code || !value) {
            setStatus(adminStatusEl, "Please enter both code and new value", "error");
            return;
        }
        
        setStatus(adminStatusEl, "Updating course...", "");
        try {
            const result = await updateCourse(code, field, value);
            if (result.ok) {
                setStatus(adminStatusEl, "Course updated successfully", "success");
                updateForm.reset();
                await listAll();
                setTimeout(() => {
                    if (adminStatusEl.textContent === "Course updated successfully") {
                        setStatus(adminStatusEl, "", "");
                    }
                }, 3000);
            } else {
                setStatus(adminStatusEl, result.message || "Failed to update course", "error");
            }
        } catch (error) {
            setStatus(adminStatusEl, error.message, "error");
        }
    });
}

const deleteForm = document.getElementById("delete-form");
if (deleteForm) {
    deleteForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const code = document.getElementById("delete-code").value.trim();
        
        if (!code) {
            setStatus(adminStatusEl, "Please enter course code", "error");
            return;
        }
        
        if (!confirm(`Are you sure you want to delete course ${code}?`)) {
            return;
        }
        
        setStatus(adminStatusEl, "Deleting course...", "");
        try {
            const result = await deleteCourse(code);
            if (result.ok) {
                setStatus(adminStatusEl, "Course deleted successfully", "success");
                deleteForm.reset();
                await listAll();
                setTimeout(() => {
                    if (adminStatusEl.textContent === "Course deleted successfully") {
                        setStatus(adminStatusEl, "", "");
                    }
                }, 3000);
            } else {
                setStatus(adminStatusEl, result.message || "Failed to delete course", "error");
            }
        } catch (error) {
            setStatus(adminStatusEl, error.message, "error");
        }
    });
}

// Back button - ensure it exists and works
const backBtn = document.getElementById("back-btn");
if (backBtn) {
    backBtn.addEventListener("click", goBack);
} else {
    console.error("back-btn not found in admin.html");
}

// Initialize: hide status bars on page load
setStatus(statusEl, "", "");
setStatus(adminStatusEl, "", "");

// Load all courses on page load
listAll();