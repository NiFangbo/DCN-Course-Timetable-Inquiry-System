#include "common.h"

#include <winsock2.h>
#include <ws2tcpip.h>

#include <iostream>
#include <string>

namespace timetable {
namespace {

class SocketReader {
public:
    bool readLine(SOCKET socket, std::string& line) {
        while (true) {
            auto pos = buffer_.find('\n');
            if (pos != std::string::npos) {
                line = buffer_.substr(0, pos);
                buffer_.erase(0, pos + 1);
                return true;
            }
            char temp[kBufferSize];
            int received = recv(socket, temp, static_cast<int>(sizeof(temp)), 0);
            if (received <= 0) {
                return false;
            }
            buffer_.append(temp, received);
        }
    }

private:
    std::string buffer_;
};

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

}  // namespace
}  // namespace timetable

int main(int argc, char* argv[]) {
    using namespace timetable;

    std::string host = "127.0.0.1";
    int port = 54000;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--host" && i + 1 < argc) {
            host = argv[++i];
        } else if (arg == "--port" && i + 1 < argc) {
            port = std::stoi(argv[++i]);
        }
    }

    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        std::cerr << "WSAStartup failed.\n";
        return 1;
    }

    SOCKET clientSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (clientSocket == INVALID_SOCKET) {
        std::cerr << "Failed to create socket.\n";
        WSACleanup();
        return 1;
    }

    sockaddr_in serverAddr{};
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(static_cast<u_short>(port));
    inet_pton(AF_INET, host.c_str(), &serverAddr.sin_addr);

    if (connect(clientSocket, reinterpret_cast<sockaddr*>(&serverAddr), sizeof(serverAddr)) ==
        SOCKET_ERROR) {
        std::cerr << "Failed to connect to server.\n";
        closesocket(clientSocket);
        WSACleanup();
        return 1;
    }

    SocketReader reader;
    std::string line;
    if (reader.readLine(clientSocket, line)) {
        std::cout << line << "\n";
    }

    while (true) {
        std::cout << "> ";
        std::string input;
        if (!std::getline(std::cin, input)) {
            break;
        }
        input = trim(input);
        if (input.empty()) {
            continue;
        }
        if (!sendAll(clientSocket, input + "\n")) {
            std::cerr << "Failed to send request.\n";
            break;
        }
        if (!reader.readLine(clientSocket, line)) {
            std::cerr << "Connection closed by server.\n";
            break;
        }
        std::cout << line << "\n";
        if (startsWith(line, "RESULT")) {
            while (reader.readLine(clientSocket, line)) {
                std::cout << line << "\n";
                if (line == "END") {
                    break;
                }
            }
        }
        if (line == "BYE") {
            break;
        }
    }

    closesocket(clientSocket);
    WSACleanup();
    return 0;
}
