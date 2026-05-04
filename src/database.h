#pragma once

#include "common.h"

#include <mutex>
#include <string>
#include <vector>

namespace timetable {

struct Course {
    std::string code;
    std::string title;
    std::string section;
    std::string instructor;
    std::string time;
    std::string classroom;
    std::string semester;
};

class TimetableDatabase {
public:
    explicit TimetableDatabase(std::string path);

    bool load(std::string& error);
    bool save(std::string& error) const;

    std::vector<Course> queryByCode(const std::string& code) const;
    std::vector<Course> queryByInstructor(const std::string& instructor) const;
    std::vector<Course> queryBySemester(const std::string& semester) const;
    std::vector<Course> listAll() const;

    bool addCourse(const Course& course, std::string& error);
    bool updateCourse(const std::string& code, const std::string& field, const std::string& value,
                      std::string& error);
    bool deleteCourse(const std::string& code, std::string& error);

private:
    bool saveUnlocked(std::string& error) const;

    std::string path_;
    mutable std::mutex mutex_;
    std::vector<Course> courses_;
};

}  // namespace timetable
