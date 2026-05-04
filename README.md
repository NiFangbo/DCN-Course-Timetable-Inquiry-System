# DCN-Course-Timetable-Inquiry-System

基于 Winsock 的课程表查询系统，实现客户端查询与管理员维护功能，满足作业要求并提供 VSCode 本地调试配置。

## 功能概览
- 学生端查询：按课程代码 / 教师 / 学期查询
- 管理员端维护：新增、修改、删除课程
- 多客户端并发：每个连接独立线程
- CSV 数据存储：即时写回文件并对所有连接生效
- 简单日志：记录连接与管理员操作

## 目录结构
```
.
├─ CMakeLists.txt
├─ src/
│  ├─ server.cpp
│  ├─ client.cpp
│  ├─ database.cpp
│  ├─ database.h
│  └─ common.h
├─ data/timetable.csv
├─ config/admins.txt
└─ .vscode/
```

## VSCode 本地调试（Windows）
1. 安装 VSCode + C/C++ 扩展（ms-vscode.cpptools）
2. 安装 CMake 与 MSVC Build Tools（或 MinGW）
3. 打开本仓库文件夹
4. 运行任务 **CMake: build** 编译
5. 在运行和调试中选择：
   - **Debug Server**
   - **Debug Client**

> 说明：`.vscode/launch.json` 默认使用 `cppvsdbg`（MSVC）。如使用 MinGW，请改为 `cppdbg` 并配置 `MIMode`。

## 运行方式（命令行）
```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build --config Debug

build/Debug/timetable_server.exe --port 54000
build/Debug/timetable_client.exe --host 127.0.0.1 --port 54000
```

## 通信协议（示例）
```
HELP
QUERY COMP3003
QUERY_INSTRUCTOR Dr. Chen
QUERY_SEMESTER 2026S
LIST

LOGIN admin admin123
ADD COMP3999|Network Lab|A|Dr. Sun|Fri-09:00-11:00|Room 505|2026S
UPDATE COMP3003 TIME Mon-10:00-12:00
DELETE COMP3101
LOGOUT
QUIT
```

### 返回格式
```
RESULT <count>
COURSE <code>|<title>|<section>|<instructor>|<time>|<classroom>|<semester>
END
```
或单行返回：`OK` / `ERROR <message>` / `SUCCESS` / `FAILURE` / `BYE`

## 数据文件
- `data/timetable.csv`：CSV 格式，字段顺序为
  `code,title,section,instructor,time,classroom,semester`
- 避免字段中包含逗号

## 管理员账号
- 默认账号位于 `config/admins.txt`
- 初始账号：`admin / admin123`
