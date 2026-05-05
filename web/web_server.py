#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import socket
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

MAX_BODY_BYTES = 64 * 1024
ALLOWED_UPDATE_FIELDS = {"title", "section", "instructor", "time", "classroom", "semester"}


class SocketLineReader:
    def __init__(self, sock: socket.socket) -> None:
        self._sock = sock
        self._buffer = b""

    def read_line(self) -> Optional[str]:
        while b"\n" not in self._buffer:
            chunk = self._sock.recv(4096)
            if not chunk:
                return None
            self._buffer += chunk
        line, self._buffer = self._buffer.split(b"\n", 1)
        return line.decode("utf-8", errors="replace").rstrip("\r")


class TimetableClient:
    def __init__(self, host: str, port: int, timeout: float) -> None:
        self._host = host
        self._port = port
        self._timeout = timeout

    def run_commands(self, commands: List[str]) -> List[Dict[str, Any]]:
        with socket.create_connection((self._host, self._port), timeout=self._timeout) as sock:
            sock.settimeout(self._timeout)
            reader = SocketLineReader(sock)
            reader.read_line()
            results = []
            for command in commands:
                sock.sendall((command + "\n").encode("utf-8"))
                results.append(self._read_response(reader))
            return results

    def _read_response(self, reader: SocketLineReader) -> Dict[str, Any]:
        line = reader.read_line()
        if line is None:
            return {"ok": False, "message": "连接已关闭"}
        if line.startswith("RESULT"):
            courses = []
            while True:
                next_line = reader.read_line()
                if next_line is None:
                    return {"ok": False, "message": "连接已关闭"}
                if next_line == "END":
                    break
                if next_line.startswith("COURSE "):
                    course = parse_course(next_line[7:])
                    if course:
                        courses.append(course)
            return {"ok": True, "message": "RESULT", "courses": courses, "count": len(courses)}
        if line.startswith("ERROR "):
            return {"ok": False, "message": line[6:].strip()}
        if line == "FAILURE":
            return {"ok": False, "message": "管理员账号或密码错误"}
        ok = line in {"OK", "SUCCESS", "BYE"}
        return {"ok": ok, "message": line}


def parse_course(payload: str) -> Optional[Dict[str, str]]:
    parts = payload.split("|")
    if len(parts) != 7:
        return None
    code, title, section, instructor, time, classroom, semester = [part.strip() for part in parts]
    return {
        "code": code,
        "title": title,
        "section": section,
        "instructor": instructor,
        "time": time,
        "classroom": classroom,
        "semester": semester,
    }


def normalize_text(value: Any, field: str, allow_pipe: bool = True) -> Tuple[Optional[str], Optional[str]]:
    if not isinstance(value, str):
        return None, f"{field} 必须是字符串"
    text = value.strip()
    if not text:
        return None, f"{field} 不能为空"
    if "\n" in text or "\r" in text:
        return None, f"{field} 不能包含换行"
    if not allow_pipe and "|" in text:
        return None, f"{field} 不能包含 |"
    return text, None


class TimetableRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, tcp_host: str, tcp_port: int, **kwargs: Any) -> None:
        self._tcp_host = tcp_host
        self._tcp_port = tcp_port
        super().__init__(*args, **kwargs)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            self.send_error(HTTPStatus.NOT_FOUND, "Not Found")
            return
        payload, error = self._read_json()
        if error:
            self._send_json({"ok": False, "message": error}, HTTPStatus.BAD_REQUEST)
            return

        if parsed.path == "/api/list":
            response = self._run_command("LIST")
        elif parsed.path == "/api/query":
            response = self._handle_query(payload)
        elif parsed.path == "/api/add":
            response = self._handle_add(payload)
        elif parsed.path == "/api/update":
            response = self._handle_update(payload)
        elif parsed.path == "/api/delete":
            response = self._handle_delete(payload)
        else:
            self._send_json({"ok": False, "message": "未知接口"}, HTTPStatus.NOT_FOUND)
            return

        status = HTTPStatus.OK if response.get("ok", False) else HTTPStatus.BAD_REQUEST
        self._send_json(response, status)

    def _read_json(self) -> Tuple[Dict[str, Any], Optional[str]]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length > MAX_BODY_BYTES:
            return {}, "请求体过大"
        if length == 0:
            return {}, None
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8")), None
        except json.JSONDecodeError:
            return {}, "JSON 格式错误"

    def _send_json(self, payload: Dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _run_command(self, command: str) -> Dict[str, Any]:
        client = TimetableClient(self._tcp_host, self._tcp_port, timeout=5.0)
        return client.run_commands([command])[0]

    def _run_admin_command(self, username: str, password: str, command: str) -> Dict[str, Any]:
        client = TimetableClient(self._tcp_host, self._tcp_port, timeout=5.0)
        login_response, action_response = client.run_commands(
            [f"LOGIN {username} {password}", command]
        )
        if not login_response.get("ok", False):
            return {"ok": False, "message": login_response.get("message", "管理员登录失败")}
        return action_response

    def _handle_query(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        query_type, error = normalize_text(payload.get("type"), "查询类型")
        if error:
            return {"ok": False, "message": error}
        value, error = normalize_text(payload.get("value"), "查询关键字")
        if error:
            return {"ok": False, "message": error}
        if query_type == "code":
            return self._run_command(f"QUERY {value}")
        if query_type == "instructor":
            return self._run_command(f"QUERY_INSTRUCTOR {value}")
        if query_type == "semester":
            return self._run_command(f"QUERY_SEMESTER {value}")
        return {"ok": False, "message": "不支持的查询类型"}

    def _handle_add(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        username, password, error = self._read_admin(payload)
        if error:
            return {"ok": False, "message": error}
        course = payload.get("course", {})
        fields = []
        for key in ["code", "title", "section", "instructor", "time", "classroom", "semester"]:
            value, field_error = normalize_text(course.get(key), f"{key}", allow_pipe=False)
            if field_error:
                return {"ok": False, "message": field_error}
            fields.append(value)
        command = "ADD " + "|".join(fields)
        return self._run_admin_command(username, password, command)

    def _handle_update(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        username, password, error = self._read_admin(payload)
        if error:
            return {"ok": False, "message": error}
        code, error = normalize_text(payload.get("code"), "课程代码")
        if error:
            return {"ok": False, "message": error}
        field, error = normalize_text(payload.get("field"), "字段")
        if error:
            return {"ok": False, "message": error}
        if field.lower() not in ALLOWED_UPDATE_FIELDS:
            return {"ok": False, "message": "字段不支持"}
        value, error = normalize_text(payload.get("value"), "新值")
        if error:
            return {"ok": False, "message": error}
        command = f"UPDATE {code} {field} {value}"
        return self._run_admin_command(username, password, command)

    def _handle_delete(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        username, password, error = self._read_admin(payload)
        if error:
            return {"ok": False, "message": error}
        code, error = normalize_text(payload.get("code"), "课程代码")
        if error:
            return {"ok": False, "message": error}
        return self._run_admin_command(username, password, f"DELETE {code}")

    def _read_admin(self, payload: Dict[str, Any]) -> Tuple[str, str, Optional[str]]:
        admin = payload.get("admin", {})
        username, error = normalize_text(admin.get("username"), "管理员账号")
        if error:
            return "", "", error
        password, error = normalize_text(admin.get("password"), "管理员密码")
        if error:
            return "", "", error
        return username, password, None


def main() -> None:
    parser = argparse.ArgumentParser(description="Timetable web GUI server")
    parser.add_argument("--host", default="127.0.0.1", help="TCP timetable server host")
    parser.add_argument("--port", type=int, default=54000, help="TCP timetable server port")
    parser.add_argument("--http-port", type=int, default=8080, help="HTTP server port")
    parser.add_argument("--bind", default="127.0.0.1", help="HTTP bind address")
    args = parser.parse_args()

    static_dir = Path(__file__).parent / "static"
    if not static_dir.exists():
        raise SystemExit(f"Static directory not found: {static_dir}")

    def handler_factory(*handler_args: Any, **handler_kwargs: Any) -> TimetableRequestHandler:
        return TimetableRequestHandler(
            *handler_args,
            tcp_host=args.host,
            tcp_port=args.port,
            directory=str(static_dir),
            **handler_kwargs,
        )

    server = ThreadingHTTPServer((args.bind, args.http_port), handler_factory)
    print(f"Web GUI running at http://{args.bind}:{args.http_port}")
    print(f"Proxying to timetable server {args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
