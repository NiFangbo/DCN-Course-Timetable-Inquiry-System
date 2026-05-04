cmake_minimum_required(VERSION 3.20)

project(DCN_Course_Timetable_Inquiry_System LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(timetable_server
    src/server.cpp
    src/database.cpp
)

target_include_directories(timetable_server PRIVATE src)
target_link_libraries(timetable_server ws2_32)

add_executable(timetable_client
    src/client.cpp
)

target_include_directories(timetable_client PRIVATE src)
target_link_libraries(timetable_client ws2_32)
