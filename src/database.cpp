#include "database.h"

#include <filesystem>
#include <fstream>
#include <sstream>

namespace timetable {

namespace {

bool matchesCode(const Course& course, const std::string& code) {
    return toLower(course.code) == toLower(code);
}

}  // namespace

TimetableDatabase::TimetableDatabase(std::string path) : path_(std::move(path)) {}

bool TimetableDatabase::load(std::string& error) {
    std::lock_guard<std::mutex> lock(mutex_);
    courses_.clear();

    std::ifstream file(path_);
    if (!file.is_open()) {
        std::filesystem::create_directories(std::filesystem::path(path_).parent_path());
        std::ofstream createFile(path_);
        if (!createFile.is_open()) {
            error = "Failed to create data file: " + path_;
            return false;
        }
        createFile << "code,title,section,instructor,time,classroom,semester\n";
        return true;
    }

    std::string line;
    bool first = true;
    while (std::getline(file, line)) {
        line = trim(line);
        if (line.empty()) {
            continue;
        }
        if (first) {
            first = false;
            if (startsWith(toLower(line), "code,")) {
                continue;
            }
        }
        auto fields = split(line, ',');
        if (fields.size() != 7) {
            continue;
        }
        Course course{trim(fields[0]), trim(fields[1]), trim(fields[2]), trim(fields[3]),
                      trim(fields[4]), trim(fields[5]), trim(fields[6])};
        courses_.push_back(std::move(course));
    }
    return true;
}

bool TimetableDatabase::save(std::string& error) const {
    std::lock_guard<std::mutex> lock(mutex_);
    return saveUnlocked(error);
}

bool TimetableDatabase::saveUnlocked(std::string& error) const {
    std::filesystem::create_directories(std::filesystem::path(path_).parent_path());
    std::ofstream file(path_, std::ios::trunc);
    if (!file.is_open()) {
        error = "Failed to write data file: " + path_;
        return false;
    }
    file << "code,title,section,instructor,time,classroom,semester\n";
    for (const auto& course : courses_) {
        file << course.code << ',' << course.title << ',' << course.section << ',' << course.instructor
             << ',' << course.time << ',' << course.classroom << ',' << course.semester << '\n';
    }
    return true;
}

std::vector<Course> TimetableDatabase::queryByCode(const std::string& code) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<Course> results;
    for (const auto& course : courses_) {
        if (matchesCode(course, code)) {
            results.push_back(course);
        }
    }
    return results;
}

std::vector<Course> TimetableDatabase::queryByInstructor(const std::string& instructor) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<Course> results;
    for (const auto& course : courses_) {
        if (icontains(course.instructor, instructor)) {
            results.push_back(course);
        }
    }
    return results;
}

std::vector<Course> TimetableDatabase::queryBySemester(const std::string& semester) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<Course> results;
    for (const auto& course : courses_) {
        if (toLower(course.semester) == toLower(semester)) {
            results.push_back(course);
        }
    }
    return results;
}

std::vector<Course> TimetableDatabase::listAll() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return courses_;
}

bool TimetableDatabase::addCourse(const Course& course, std::string& error) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto& existing : courses_) {
        if (matchesCode(existing, course.code) &&
            toLower(existing.section) == toLower(course.section) &&
            toLower(existing.semester) == toLower(course.semester)) {
            error = "Course already exists for the same code, section, and semester.";
            return false;
        }
    }
    courses_.push_back(course);
    return saveUnlocked(error);
}

bool TimetableDatabase::updateCourse(const std::string& code, const std::string& field,
                                     const std::string& value, std::string& error) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto lowerField = toLower(field);
    if (lowerField != "title" && lowerField != "section" && lowerField != "instructor" &&
        lowerField != "time" && lowerField != "classroom" && lowerField != "semester") {
        error = "Unsupported field: " + field;
        return false;
    }

    bool updated = false;
    for (auto& course : courses_) {
        if (!matchesCode(course, code)) {
            continue;
        }
        if (lowerField == "title") {
            course.title = value;
        } else if (lowerField == "section") {
            course.section = value;
        } else if (lowerField == "instructor") {
            course.instructor = value;
        } else if (lowerField == "time") {
            course.time = value;
        } else if (lowerField == "classroom") {
            course.classroom = value;
        } else if (lowerField == "semester") {
            course.semester = value;
        }
        updated = true;
    }
    if (!updated) {
        error = "Course not found for code: " + code;
        return false;
    }
    return saveUnlocked(error);
}

bool TimetableDatabase::deleteCourse(const std::string& code, std::string& error) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto oldSize = courses_.size();
    courses_.erase(
        std::remove_if(courses_.begin(), courses_.end(),
                       [&](const Course& course) { return matchesCode(course, code); }),
        courses_.end());
    if (courses_.size() == oldSize) {
        error = "Course not found for code: " + code;
        return false;
    }
    return saveUnlocked(error);
}

}  // namespace timetable
