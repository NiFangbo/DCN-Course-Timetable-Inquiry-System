# DCN-Course-Timetable-Inquiry-System

***Data Communication and Networking***

## 功能
- 学生端查询：按课程代码 / 教师 / 学期查询
- 管理员端维护：新增、修改、删除课程
- 多客户端并发：每个连接独立线程
- CSV 数据存储：即时写回文件并对所有连接生效
- 简单日志：记录连接与管理员操作

## 目录
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

## 运行
1. 安装 VSCode + C/C++ extension

2. 安装 CMake 与 MSVC Build Tools（或 MinGW）

3. 编译
```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build --config Debug
```

4. 服务端
```bash
build\timetable_server.exe --port 54000
```

5. 客户端（命令行，需先启动服务端）
```bash
build\timetable_client.exe --host 127.0.0.1 --port 54000
```

6. 网页端（GUI，需先启动服务端）
```bash
python web/web_server.py --host 127.0.0.1 --port 54000 --http-port 8080
```
浏览器访问 `http://127.0.0.1:8080`。

## 通信协议
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

## 返回
```
RESULT <count>
COURSE <code>|<title>|<section>|<instructor>|<time>|<classroom>|<semester>
END
```
`OK` / `ERROR <message>` / `SUCCESS` / `FAILURE` / `BYE`

## 数据文件
- `data/timetable.csv`：CSV 格式，字段顺序为
  `code,title,section,instructor,time,classroom,semester`

## 管理员账号
- 默认账号位于 `config/admins.txt`, 初始账号：`admin / admin123`
