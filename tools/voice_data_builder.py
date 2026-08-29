import csv
import io
import json
import threading
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from tkinter.scrolledtext import ScrolledText

import requests

# 이 프로그램이 반드시 필요로 하는 CSV 헤더입니다.
REQUIRED_HEADERS = ("파일명", "한국어", "일본어", "캐릭터명")

# 이 확장자만 오디오 파일로 인정합니다.
AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"}

# 생성될 JS 파일 이름입니다.
OUTPUT_FILENAME = "voice_data.js"

def clean_text(value):
    """None 방지 + 앞뒤 공백 제거용 공통 함수."""
    return str(value or "").strip()

def normalize_filename(filename):
    """
    파일명 비교용 정규화 함수.
    - 경로가 섞여 들어와도 파일명만 비교
    - 윈도우는 대소문자를 거의 구분하지 않으므로 소문자로 통일
    """
    return Path(clean_text(filename)).name.lower()

def download_csv_rows(csv_url):
    """
    URL에서 CSV를 내려받아 행 목록으로 변환합니다.
    Google Sheets CSV는 보통 UTF-8 BOM이 있을 수 있어서 utf-8-sig로 디코딩합니다.
    """
    response = requests.get(csv_url, timeout=30)
    response.raise_for_status()

    csv_text = response.content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(csv_text))

    original_headers = reader.fieldnames or []
    cleaned_headers = [clean_text(header) for header in original_headers]

    if not cleaned_headers:
        raise ValueError("CSV 헤더를 읽지 못했습니다. 링크가 올바른 CSV 주소인지 확인해 주세요.")

    missing_headers = [header for header in REQUIRED_HEADERS if header not in cleaned_headers]
    if missing_headers:
        raise ValueError(
            "CSV에 필요한 헤더가 없습니다: "
            + ", ".join(missing_headers)
            + "\n필수 헤더: "
            + ", ".join(REQUIRED_HEADERS)
        )

    rows = []

    for raw_row in reader:
        row = {}

        # 헤더 이름의 공백/BOM 영향을 없애기 위해 우리가 정리한 cleaned_headers 기준으로 다시 조립합니다.
        for index, cleaned_header in enumerate(cleaned_headers):
            original_header = original_headers[index]
            row[cleaned_header] = clean_text(raw_row.get(original_header, ""))

        # 완전히 빈 줄은 무시합니다.
        if any(row.values()):
            rows.append(row)

    return rows

def collect_audio_files(folder_path):
    """
    선택한 폴더 '바로 아래'에 있는 오디오 파일만 수집합니다.
    하위 폴더까지 재귀적으로 뒤지지는 않습니다.
    """
    audio_map = {}
    duplicate_names = []

    for item in sorted(folder_path.iterdir(), key=lambda path: path.name.lower()):
        if not item.is_file():
            continue

        if item.suffix.lower() not in AUDIO_EXTENSIONS:
            continue

        normalized_name = item.name.lower()

        if normalized_name in audio_map:
            duplicate_names.append(item.name)
            continue

        audio_map[normalized_name] = item.name

    return audio_map, duplicate_names

def build_output_entry(row, actual_filename):
    """
    JS에 들어갈 한 개의 대사 정보를 만듭니다.
    기본 필드는 깔끔한 영어 key로 고정하고,
    그 외 추가 컬럼은 extraFields에 보존합니다.
    """
    entry = {
        "fileName": actual_filename,
        "audio": actual_filename,
        "korean": clean_text(row.get("한국어")),
        "japanese": clean_text(row.get("일본어")),
        "characterName": clean_text(row.get("캐릭터명")),
    }

    extra_fields = {}

    for key, value in row.items():
        if key in REQUIRED_HEADERS:
            continue

        value = clean_text(value)
        if value:
            extra_fields[key] = value

    if extra_fields:
        entry["extraFields"] = extra_fields

    return entry

def validate_and_build(rows, audio_map):
    """
    CSV와 로컬 오디오 파일을 비교한 뒤,
    실제로 일치하는 데이터만 골라 JS 객체용 dict를 만듭니다.
    """
    logs = []
    csv_seen_names = set()
    duplicate_csv_names = []
    blank_filename_rows = []
    missing_in_folder = []
    matched_data = {}

    for row_number, row in enumerate(rows, start=2):  # 헤더가 1행이므로 실제 데이터는 2행부터
        raw_filename = clean_text(row.get("파일명"))

        if not raw_filename:
            blank_filename_rows.append(row_number)
            continue

        normalized_name = normalize_filename(raw_filename)

        if normalized_name in csv_seen_names:
            duplicate_csv_names.append(raw_filename)
            continue

        csv_seen_names.add(normalized_name)

        actual_filename = audio_map.get(normalized_name)

        if actual_filename is None:
            missing_in_folder.append(raw_filename)
            continue

        matched_data[actual_filename] = build_output_entry(row, actual_filename)

    extra_in_folder = [
        actual_filename
        for normalized_name, actual_filename in sorted(audio_map.items(), key=lambda item: item[1].lower())
        if normalized_name not in csv_seen_names
    ]

    ordered_data = {
        filename: matched_data[filename]
        for filename in sorted(matched_data.keys(), key=lambda name: name.lower())
    }

    if blank_filename_rows:
        logs.append("[경고] '파일명'이 비어 있는 CSV 행: " + ", ".join(map(str, blank_filename_rows)))

    if duplicate_csv_names:
        unique_duplicates = list(dict.fromkeys(duplicate_csv_names))
        logs.append("[경고] CSV 안에 중복된 파일명: " + ", ".join(unique_duplicates))

    if missing_in_folder:
        logs.append("[경고] 시트에는 있지만 폴더에는 없는 파일:")
        for filename in missing_in_folder:
            logs.append(f"  - {filename}")
    else:
        logs.append("[확인] 시트 기준 누락 파일은 없습니다.")

    if extra_in_folder:
        logs.append("[경고] 폴더에는 있지만 시트에는 없는 파일:")
        for filename in extra_in_folder:
            logs.append(f"  - {filename}")
    else:
        logs.append("[확인] 폴더 기준 추가 파일은 없습니다.")

    logs.append(
        f"[요약] CSV 행 {len(rows)}개 / 로컬 오디오 {len(audio_map)}개 / 일치하여 JS에 저장된 항목 {len(ordered_data)}개"
    )

    if not ordered_data:
        raise ValueError("일치하는 파일이 하나도 없습니다. CSV 파일명과 로컬 오디오 파일명을 다시 확인해 주세요.")

    return ordered_data, logs

def write_js_file(output_path, voice_data):
    """
    웹에서 import 가능한 ES Module 형태로 JS 파일을 저장합니다.
    """
    js_object_text = json.dumps(voice_data, ensure_ascii=False, indent=4)

    file_text = (
        "// 이 파일은 voice_data_builder.py가 자동 생성했습니다.\n"
        "// 필요 시 다시 생성해 덮어쓰면 됩니다.\n\n"
        f"export const VOICE_DATA = {js_object_text};\n\n"
        "export default VOICE_DATA;\n"
    )

    output_path.write_text(file_text, encoding="utf-8")
    return output_path

class VoiceDataBuilderApp(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("LOH Voice Data Builder")
        self.geometry("900x680")
        self.minsize(760, 560)

        self.csv_url_var = tk.StringVar()
        self.folder_var = tk.StringVar()
        self.status_var = tk.StringVar(value="대기 중")

        self._build_ui()

    def _build_ui(self):
        root_frame = ttk.Frame(self, padding=16)
        root_frame.pack(fill="both", expand=True)

        root_frame.columnconfigure(1, weight=1)
        root_frame.rowconfigure(4, weight=1)

        title_label = ttk.Label(
            root_frame,
            text="구글 스프레드시트 CSV → voice_data.js 변환기",
            font=("맑은 고딕", 14, "bold"),
        )
        title_label.grid(row=0, column=0, columnspan=3, sticky="w", pady=(0, 12))

        guide_text = (
            "1. CSV 링크를 붙여넣고\n"
            "2. 오디오 파일 폴더를 고른 뒤\n"
            "3. '검증 후 JS 생성' 버튼을 누르면\n"
            "   다운로드 → 대조 → 경고 로그 출력 → voice_data.js 저장까지 한 번에 진행됩니다."
        )
        guide_label = ttk.Label(root_frame, text=guide_text, justify="left")
        guide_label.grid(row=1, column=0, columnspan=3, sticky="w", pady=(0, 16))

        ttk.Label(root_frame, text="CSV 링크").grid(row=2, column=0, sticky="w", pady=(0, 8))
        self.csv_entry = ttk.Entry(root_frame, textvariable=self.csv_url_var)
        self.csv_entry.grid(row=2, column=1, columnspan=2, sticky="ew", pady=(0, 8))

        ttk.Label(root_frame, text="오디오 폴더").grid(row=3, column=0, sticky="w", pady=(0, 8))
        self.folder_entry = ttk.Entry(root_frame, textvariable=self.folder_var)
        self.folder_entry.grid(row=3, column=1, sticky="ew", pady=(0, 8))

        self.browse_button = ttk.Button(root_frame, text="폴더 선택", command=self.browse_folder)
        self.browse_button.grid(row=3, column=2, sticky="ew", padx=(8, 0), pady=(0, 8))

        log_frame = ttk.LabelFrame(root_frame, text="실행 로그", padding=8)
        log_frame.grid(row=4, column=0, columnspan=3, sticky="nsew", pady=(8, 12))
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)

        self.log_text = ScrolledText(log_frame, wrap="word", font=("Consolas", 10))
        self.log_text.grid(row=0, column=0, sticky="nsew")

        bottom_frame = ttk.Frame(root_frame)
        bottom_frame.grid(row=5, column=0, columnspan=3, sticky="ew")
        bottom_frame.columnconfigure(0, weight=1)

        self.status_label = ttk.Label(bottom_frame, textvariable=self.status_var)
        self.status_label.grid(row=0, column=0, sticky="w")

        self.run_button = ttk.Button(bottom_frame, text="검증 후 JS 생성", command=self.run_pipeline)
        self.run_button.grid(row=0, column=1, sticky="e")

    def browse_folder(self):
        selected_folder = filedialog.askdirectory(title="오디오 파일 폴더를 선택하세요")
        if selected_folder:
            self.folder_var.set(selected_folder)

    def set_busy(self, busy):
        state = "disabled" if busy else "normal"
        self.csv_entry.configure(state=state)
        self.folder_entry.configure(state=state)
        self.browse_button.configure(state=state)
        self.run_button.configure(state=state)
        self.status_var.set("작업 중..." if busy else "대기 중")

    def append_log(self, message):
        self.log_text.insert("end", message + "\n")
        self.log_text.see("end")

    def log(self, message):
        # 백그라운드 스레드에서도 안전하게 로그를 찍기 위해 after 사용
        self.after(0, lambda: self.append_log(message))

    def run_pipeline(self):
        csv_url = clean_text(self.csv_url_var.get())
        folder_text = clean_text(self.folder_var.get())

        if not csv_url:
            messagebox.showwarning("입력 확인", "CSV 링크를 먼저 입력해 주세요.")
            return

        if not csv_url.startswith(("http://", "https://")):
            messagebox.showwarning("입력 확인", "CSV 링크는 http:// 또는 https:// 로 시작해야 합니다.")
            return

        if not folder_text:
            messagebox.showwarning("입력 확인", "오디오 파일이 들어 있는 폴더를 먼저 선택해 주세요.")
            return

        folder_path = Path(folder_text)
        if not folder_path.exists() or not folder_path.is_dir():
            messagebox.showwarning("입력 확인", "선택한 폴더가 존재하지 않습니다.")
            return

        self.log("=" * 72)
        self.log("새 작업 시작")
        self.log(f"CSV 링크: {csv_url}")
        self.log(f"오디오 폴더: {folder_path}")

        self.set_busy(True)

        worker = threading.Thread(
            target=self._run_pipeline_worker,
            args=(csv_url, folder_path),
            daemon=True,
        )
        worker.start()

    def _run_pipeline_worker(self, csv_url, folder_path):
        try:
            self.log("[1/4] CSV 다운로드 및 읽기 시작")
            rows = download_csv_rows(csv_url)
            self.log(f"[완료] CSV 데이터 {len(rows)}개 행을 읽었습니다.")

            self.log("[2/4] 로컬 오디오 파일 검사 시작")
            audio_map, duplicate_audio_names = collect_audio_files(folder_path)

            if not audio_map:
                raise ValueError(
                    "선택한 폴더에서 지원 오디오 파일을 찾지 못했습니다.\n"
                    "지원 확장자: " + ", ".join(sorted(AUDIO_EXTENSIONS))
                )

            self.log(f"[완료] 로컬 오디오 파일 {len(audio_map)}개를 찾았습니다.")

            if duplicate_audio_names:
                self.log("[경고] 로컬 폴더 안에 중복 이름으로 해석되는 파일이 있습니다:")
                for filename in duplicate_audio_names:
                    self.log(f"  - {filename}")

            self.log("[3/4] CSV와 로컬 파일 무결성 검증 시작")
            voice_data, logs = validate_and_build(rows, audio_map)

            for line in logs:
                self.log(line)

            self.log("[4/4] JS 파일 생성 시작")
            output_path = folder_path / OUTPUT_FILENAME
            write_js_file(output_path, voice_data)

            self.log(f"[완료] JS 파일 저장: {output_path}")
            self.log("모든 작업이 끝났습니다.")

            self.after(
                0,
                lambda: messagebox.showinfo(
                    "완료",
                    "변환이 끝났습니다.\n\n"
                    f"저장 위치:\n{output_path}"
                ),
            )

        except requests.RequestException as error:
            error_message = f"CSV 다운로드에 실패했습니다.\n{error}"
            self.log(f"[오류] {error_message}")
            self.after(0, lambda: messagebox.showerror("실행 실패", error_message))

        except Exception as error:
            error_message = str(error)
            self.log(f"[오류] {error_message}")
            self.after(0, lambda: messagebox.showerror("실행 실패", error_message))

        finally:
            self.after(0, lambda: self.set_busy(False))

if __name__ == "__main__":
    app = VoiceDataBuilderApp()
    app.mainloop()