# Course Timetable Inquiry System
***Data Communication and Networking***

## Features
- **Student Inquiry**: Query by course code / instructor / semester
- **Admin Management**: Add, update, and delete courses
- **Multi-Client Concurrency**: Independent thread for each connection
- **CSV Data Storage**: Instant file write-back with global effect for all connections
- **Simple Logging**: Record connections and admin operations
- **Web GUI Interface**: User-friendly browser-based operation panel

## Directory Structure
```
.
├── CMakeLists.txt          # CMake build configuration
├── README.md               # Project documentation
├── build/                  # Compilation output directory
├── config/
│   └── admins.txt          # Admin account configuration
├── data/
│   └── timetable.csv       # Course data file
├── logs/
│   └── server.log          # Server log file
├── src/
│   ├── server.cpp          # Server main program
│   ├── client.cpp          # Command-line client
│   ├── database.cpp        # Database implementation
│   ├── database.h          # Database header
│   └── common.h            # Common utilities
└── web/
    ├── web_server.py       # Web GUI server
    └── static/
        ├── login.html      # Login selection page
        ├── user.html       # Normal user interface
        ├── admin.html      # Admin interface
        ├── login.js        # Login logic
        ├── user.js         # User logic
        ├── admin.js        # Admin logic
        └── app.css         # Global styling
```

## Requirements

| Component | Minimum Version |
|-----------|-----------------|
| CMake     | 3.20 or higher  |
| C++ Compiler | MinGW-w64 / MSVC |
| Python    | 3.7 or higher   |

## Quick Start
```bash
python launcher.py
```

## Build Steps

### 1. Generate Build Files
```bash
cmake -S . -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Debug
```

### 2. Compile
```bash
cmake --build build
```

After successful compilation, the following files will be generated in the `build/` directory:
- `timetable_server.exe` - Server executable
- `timetable_client.exe` - Command-line client

## Run Guide

### Start Server
Run in MSYS2 terminal or properly configured command prompt:
```bash
./build/timetable_server.exe --port 54000
```

**Optional Arguments**
- `--port ` `<port>` - Service port (default: 54000)
- `--data` `<path>` - Data file path (default: data/timetable.csv)
- `--admins` `<path>` - Admin file path (default: config/admins.txt)
- `--log` `<path>` - Log file path (default: logs/server.log)

**Success Message**
```
Server running on port 54000. Press Ctrl+C to stop.
```

### Start Web GUI
Keep the server running, open a new terminal:
```bash
cd web
python web_server.py --host 127.0.0.1 --port 54000 --http-port 8080
```

**Optional Arguments**
- `--host` - TCP server address (default: 127.0.0.1)
- `--port` - TCP server port (default: 54000)
- `--http-port` - Web GUI port (default: 8080)
- `--bind` - HTTP bind address (default: 127.0.0.1)

Once started, access the GUI at:  
**http://127.0.0.1:8080**

### Use Command-Line Client (Optional)
```bash
./build/timetable_client.exe
```

## Web GUI Usage

### Login Selection Page
After accessing http://127.0.0.1:8080:

| Option | Description |
|--------|-------------|
| Login as Normal User | Enter user query interface |
| Login as Admin | Show admin login form |

### Normal User Interface
No login required:
- Query by course code
- Query by instructor (fuzzy match supported)
- Query by semester
- List all courses

### Admin Interface
Requires login. Additional functions:

| Operation | Description |
|-----------|-------------|
| Add Course | Add new course (code, title, section, instructor, time, classroom, semester) |
| Update Course | Update course fields (title, section, instructor, time, classroom, semester) |
| Delete Course | Delete course by code |
| Back to Selection | Log out and return to selection page |

### Default Admin Account
Stored in `config/admins.txt`:
```
username: admin
password: admin123
```
Add more admins in the same format: `username:password`

## Communication Protocol

### Client Commands

| Command | Format | Description |
|---------|--------|-------------|
| HELP | HELP | Show help |
| QUERY | QUERY ``<code>`` | Query by course code |
| QUERY_INSTRUCTOR | QUERY_INSTRUCTOR ``<name>`` | Query by instructor |
| QUERY_SEMESTER | QUERY_SEMESTER `<sem>` | Query by semester |
| LIST | LIST | List all courses |
| LOGIN | LOGIN `<user>` `<pwd>` | Admin login |
| ADD | ADD `<code>`|`<title>`|...|`<sem>` | Add course (requires login) |
| UPDATE | UPDATE `<code>` `<field>` `<val>` | Update course (requires login) |
| DELETE | DELETE `<code>` | Delete course (requires login) |
| LOGOUT | LOGOUT | Admin logout |
| QUIT | QUIT | Exit client |

### Server Responses

| Response | Description |
|----------|-------------|
| RESULT `<count>` | Start of query result |
| COURSE `<field1>`|`<field2>`... | Course data row |
| END | End of result |
| OK | Operation succeeded |
| SUCCESS | Login succeeded |
| FAILURE | Login failed |
| ERROR `<msg>` | Error message |
| BYE | Connection closed |

## Data Format

### Course Data (data/timetable.csv)
CSV with header:
```csv
code,title,section,instructor,time,classroom,semester
COMP3003,Data Communications,A,Dr. Chen,Mon-10:00-12:00,Room 301,2026S
```

### Admin Config (config/admins.txt)
Lines: `username:password`  
Lines starting with `#` are comments.

## Troubleshooting

### 1. Missing DLL when running server
In MSYS2:
```bash
cd build
cp /ucrt64/bin/libstdc++-6.dll .
cp /ucrt64/bin/libgcc_s_seh-1.dll .
cp /ucrt64/bin/libwinpthread-1.dll .
```

### 2. Web GUI connection failed
Ensure server is running and port matches (default 54000).

### 3. Admin login failed
- Check credentials in `config/admins.txt`
- Restart server after modifying config

### 4. Port occupied
Use custom port:
```bash
./build/timetable_server.exe --port 54001
```
Web GUI:
```bash
python web_server.py --port 54001
```

## Architecture
```
┌─────────────────┐     HTTP      ┌─────────────────┐
│     Browser     │◄─────────────►│                 │
│  (Web GUI)      │                │  web_server.py  │
└─────────────────┘                │  (Python)       │
                                   └────────┬────────┘
                                            │ TCP
                                   ┌────────▼────────┐
┌─────────────────┐     TCP        │                 │
│  C++ Client     │◄──────────────►│  C++ Server     │
│ (命令行)         │                │ (timetable_     │
└─────────────────┘                │  server.exe)    │
                                   └────────┬────────┘
                                            │
                                   ┌────────▼────────┐
                                   │   CSV 数据文件   │
                                   │  timetable.csv  │
                                   └─────────────────┘
```