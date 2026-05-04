#pragma once

#include <algorithm>
#include <cctype>
#include <sstream>
#include <string>
#include <vector>

namespace timetable {

constexpr size_t kBufferSize = 4096;

inline std::string trim(const std::string& input) {
    size_t start = 0;
    while (start < input.size() && std::isspace(static_cast<unsigned char>(input[start]))) {
        ++start;
    }
    size_t end = input.size();
    while (end > start && std::isspace(static_cast<unsigned char>(input[end - 1]))) {
        --end;
    }
    return input.substr(start, end - start);
}

inline std::string toLower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return value;
}

inline std::vector<std::string> split(const std::string& input, char delimiter) {
    std::vector<std::string> parts;
    std::string token;
    std::istringstream stream(input);
    while (std::getline(stream, token, delimiter)) {
        parts.push_back(token);
    }
    return parts;
}

inline bool startsWith(const std::string& value, const std::string& prefix) {
    return value.size() >= prefix.size() && value.compare(0, prefix.size(), prefix) == 0;
}

inline bool icontains(const std::string& text, const std::string& pattern) {
    auto lowerText = toLower(text);
    auto lowerPattern = toLower(pattern);
    return lowerText.find(lowerPattern) != std::string::npos;
}

}  // namespace timetable
