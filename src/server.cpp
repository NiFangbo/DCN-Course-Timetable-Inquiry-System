#include "common.h"
#include "database.h"

#include <winsock2.h>
#include <ws2tcpip.h>

#include <atomic>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

namespace timetable {
namespace {

class Logger {
public:
    explicit Logger(std::string path) : path_(std::move(path)) {
        std::filesystem::create_directories(std::filesystem::path(path_).parent_path());
    }

    void info(const std::string& message) { log("INFO", message); }
    void warn(const std::string& message) { log("WARN", message); }
    void error(const std::string& message) { log("ERROR", message); }

private:
    void log(const std::string& level, const std::string& message) {
        std::lock_guard<std::mutex> lock(mutex_);
        std::ofstream file(path_, std::ios::app);
        if (!file.is_open()) {
            return;
        }
        auto now = std::chrono::system_clock::now();
        auto time = std::chrono::system_clock::to_time_t(now);
        std::tm localTime{};
        localtime_s(&localTime, &time);
        file << "[" << std::put_time(&localTime, "%Y-%m-%d %H:%M:%S") << "]"
             << "[" << level << "] " << message << "\n";
    }

    std::string path_;
    std::mutex mutex_;
};

struct Session {
    bool isAdmin = false;
    std::string username;
};

std::atomic<int> g_activeConnections{0};

bool sendAll(SOCKET socket, const std::string& data) {
    size_t totalSent = 0;
    while (totalSent < data.size()) {
        int sent = send(socket, data.data() + totalSent,
                        static_cast<int>(data.size() - totalSent), 0);
        if (sent == SOCKET_ERROR) {
            return false;
        }
        totalSent += static_cast<size_t>(sent);
    }
    return true;
}

std::string formatCourse(const Course& course) {
    std::ostringstream out;
    out << course.code << '|' << course.title << '|' << course.section << '|' << course.instructor
        << '|' << course.time << '|' << course.classroom << '|' << course.semester;
    return out.str();
}

std::string formatResults(const std::vector<Course>& courses) {
    std::ostringstream out;
    out << "RESULT " << courses.size() << "\n";
    for (const auto& course : courses) {
        out << "COURSE " << formatCourse(course) << "\n";
    }
    out << "END\n";
    return out.str();
}

std::unordered_map<std::string, std::string> loadAdmins(const std::string& path, Logger& logger) {
    std::unordered_map<std::string, std::string> admins;
    std::ifstream file(path);
    if (!file.is_open()) {
        std::filesystem::create_directories(std::filesystem::path(path).parent_path());
        std::ofstream createFile(path);
        if (createFile.is_open()) {
            createFile << "# username:password\n";
            createFile << "admin:admin123\n";
        }
        admins["admin"] = "admin123";
        logger.warn("Admin file missing, created default admin credentials.");
        return admins;
    }

    std::string line;
    while (std::getline(file, line)) {
        line = trim(line);
        if (line.empty() || startsWith(line, "#")) {
            continue;
        }
        auto parts = split(line, ':');
        if (parts.size() != 2) {
            continue;
        }
        admins[trim(parts[0])] = trim(parts[1]);
    }
    if (admins.empty()) {
        admins["admin"] = "admin123";
    }
    return admins;
}

std::string helpMessage() {
    return "INFO Commands: QUERY <code>, QUERY_INSTRUCTOR <name>, QUERY_SEMESTER <semester>, "
           "LIST, LOGIN <user> <pass>, ADD <code>|<title>|<section>|<instructor>|<time>|<room>|"
           "<semester>, UPDATE <code> <field> <value>, DELETE <code>, LOGOUT, QUIT\n";
}

std::string handleCommand(const std::string& rawLine, Session& session, TimetableDatabase& database,
                          const std::unordered_map<std::string, std::string>& admins,
                          Logger& logger, bool& shouldClose) {
    std::string line = trim(rawLine);
    if (line.empty()) {
        return "ERROR Empty command\n";
    }

    auto spacePos = line.find(' ');
    std::string command = toLower(spacePos == std::string::npos ? line : line.substr(0, spacePos));
    std::string args = spacePos == std::string::npos ? "" : trim(line.substr(spacePos + 1));

    if (command == "help") {
        return helpMessage();
    }

    if (command == "login") {
        std::istringstream input(args);
        std::string user;
        std::string password;
        input >> user >> password;
        if (user.empty() || password.empty()) {
            return "ERROR Usage: LOGIN <user> <pass>\n";
        }
        auto it = admins.find(user);
        if (it != admins.end() && it->second == password) {
            session.isAdmin = true;
            session.username = user;
            logger.info("Admin login: " + user);
            return "SUCCESS\n";
        }
        return "FAILURE\n";
    }

    if (command == "logout") {
        session.isAdmin = false;
        session.username.clear();
        return "OK\n";
    }

    if (command == "query") {
        if (args.empty()) {
            return "ERROR Usage: QUERY <code>\n";
        }
        return formatResults(database.queryByCode(args));
    }

    if (command == "query_instructor") {
        if (args.empty()) {
            return "ERROR Usage: QUERY_INSTRUCTOR <name>\n";
        }
        return formatResults(database.queryByInstructor(args));
    }

    if (command == "query_semester") {
        if (args.empty()) {
            return "ERROR Usage: QUERY_SEMESTER <semester>\n";
        }
        return formatResults(database.queryBySemester(args));
    }

    if (command == "list") {
        return formatResults(database.listAll());
    }

    if (command == "add") {
        if (!session.isAdmin) {
            return "ERROR Admin login required\n";
        }
        auto fields = split(args, '|');
        if (fields.size() != 7) {
            return "ERROR Usage: ADD <code>|<title>|<section>|<instructor>|<time>|<room>|<semester>\n";
        }
        Course course{trim(fields[0]), trim(fields[1]), trim(fields[2]), trim(fields[3]),
                      trim(fields[4]), trim(fields[5]), trim(fields[6])};
        std::string error;
        if (!database.addCourse(course, error)) {
            return "ERROR " + error + "\n";
        }
        logger.info("Course added by " + session.username + ": " + course.code);
        return "OK\n";
    }

    if (command == "update") {
        if (!session.isAdmin) {
            return "ERROR Admin login required\n";
        }
        std::istringstream input(args);
        std::string code;
        std::string field;
        input >> code >> field;
        std::string value;
        std::getline(input, value);
        value = trim(value);
        if (code.empty() || field.empty() || value.empty()) {
            return "ERROR Usage: UPDATE <code> <field> <value>\n";
        }
        std::string error;
        if (!database.updateCourse(code, field, value, error)) {
            return "ERROR " + error + "\n";
        }
        logger.info("Course updated by " + session.username + ": " + code + " field=" + field);
        return "OK\n";
    }

    if (command == "delete") {
        if (!session.isAdmin) {
            return "ERROR Admin login required\n";
        }
        if (args.empty()) {
            return "ERROR Usage: DELETE <code>\n";
        }
        std::string error;
        if (!database.deleteCourse(args, error)) {
            return "ERROR " + error + "\n";
        }
        logger.info("Course deleted by " + session.username + ": " + args);
        return "OK\n";
    }

    if (command == "quit") {
        shouldClose = true;
        return "BYE\n";
    }

    return "ERROR Unknown command. Type HELP for list.\n";
}

void handleClient(SOCKET clientSocket, std::string clientAddress, TimetableDatabase& database,
                  const std::unordered_map<std::string, std::string>& admins, Logger& logger) {
    g_activeConnections.fetch_add(1);
    logger.info("Client connected: " + clientAddress +
                " (active=" + std::to_string(g_activeConnections.load()) + ")");

    sendAll(clientSocket, "WELCOME Timetable Server. Type HELP for commands.\n");

    std::string buffer;
    char temp[kBufferSize];
    Session session;

    while (true) {
        int received = recv(clientSocket, temp, static_cast<int>(sizeof(temp)), 0);
        if (received == 0 || received == SOCKET_ERROR) {
            break;
        }
        buffer.append(temp, received);
        size_t pos = 0;
        while ((pos = buffer.find('\n')) != std::string::npos) {
            std::string line = buffer.substr(0, pos);
            buffer.erase(0, pos + 1);
            bool shouldClose = false;
            auto response = handleCommand(line, session, database, admins, logger, shouldClose);
            if (!sendAll(clientSocket, response)) {
                shouldClose = true;
            }
            if (shouldClose) {
                closesocket(clientSocket);
                g_activeConnections.fetch_sub(1);
                logger.info("Client disconnected: " + clientAddress +
                            " (active=" + std::to_string(g_activeConnections.load()) + ")");
                return;
            }
        }
    }

    closesocket(clientSocket);
    g_activeConnections.fetch_sub(1);
    logger.info("Client disconnected: " + clientAddress +
                " (active=" + std::to_string(g_activeConnections.load()) + ")");
}

}  // namespace
}  // namespace timetable

int main(int argc, char* argv[]) {
    using namespace timetable;

    std::string dataPath = "data/timetable.csv";
    std::string adminPath = "config/admins.txt";
    std::string logPath = "logs/server.log";
    int port = 54000;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--data" && i + 1 < argc) {
            dataPath = argv[++i];
        } else if (arg == "--admins" && i + 1 < argc) {
            adminPath = argv[++i];
        } else if (arg == "--log" && i + 1 < argc) {
            logPath = argv[++i];
        } else if (arg == "--port" && i + 1 < argc) {
            port = std::stoi(argv[++i]);
        }
    }

    Logger logger(logPath);
    std::string dbError;
    TimetableDatabase database(dataPath);
    if (!database.load(dbError)) {
        logger.error(dbError);
        std::cerr << dbError << "\n";
        return 1;
    }

    auto admins = loadAdmins(adminPath, logger);

    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        logger.error("WSAStartup failed.");
        return 1;
    }

    SOCKET listenSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (listenSocket == INVALID_SOCKET) {
        logger.error("Failed to create socket.");
        WSACleanup();
        return 1;
    }

    sockaddr_in service{};
    service.sin_family = AF_INET;
    service.sin_addr.s_addr = htonl(INADDR_ANY);
    service.sin_port = htons(static_cast<u_short>(port));

    if (bind(listenSocket, reinterpret_cast<SOCKADDR*>(&service), sizeof(service)) == SOCKET_ERROR) {
        logger.error("Bind failed.");
        closesocket(listenSocket);
        WSACleanup();
        return 1;
    }

    if (listen(listenSocket, SOMAXCONN) == SOCKET_ERROR) {
        logger.error("Listen failed.");
        closesocket(listenSocket);
        WSACleanup();
        return 1;
    }

    logger.info("Server started on port " + std::to_string(port));
    std::cout << "Server running on port " << port << ". Press Ctrl+C to stop.\n";

    while (true) {
        sockaddr_in clientInfo{};
        int clientInfoSize = sizeof(clientInfo);
        SOCKET clientSocket =
            accept(listenSocket, reinterpret_cast<sockaddr*>(&clientInfo), &clientInfoSize);
        if (clientSocket == INVALID_SOCKET) {
            logger.warn("Accept failed.");
            continue;
        }

        char addressBuffer[INET_ADDRSTRLEN] = {0};
        inet_ntop(AF_INET, &clientInfo.sin_addr, addressBuffer, INET_ADDRSTRLEN);
        std::string clientAddress = std::string(addressBuffer) + ":" +
                                    std::to_string(ntohs(clientInfo.sin_port));

        std::thread(handleClient, clientSocket, clientAddress, std::ref(database),
                    std::cref(admins), std::ref(logger))
            .detach();
    }

    closesocket(listenSocket);
    WSACleanup();
    return 0;
}
