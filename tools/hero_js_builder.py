import csv
import io
import json
import re
import threading
import zlib
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from tkinter.scrolledtext import ScrolledText

import requests

# 최소 필수 헤더만 강제하고, 나머지는 별칭을 넓게 허용합니다.
REQUIRED_HEADERS = ("파일명", "한국어")
HEADER_ALIASES = {
    "파일명": ("파일명",),
    "한국어": ("한국어", "한국어 대사", "대사"),
    "일본어": ("일본어", "일본어 대사"),
    "캐릭터명": ("캐릭터명", "영웅명"),
    "상황": ("상황", "상황명", "라벨", "label"),
}


def canonicalize_header_name(header):
    for canonical_name, aliases in HEADER_ALIASES.items():
        if header in aliases:
            return canonical_name
    return header

# 오디오 파일로 인정할 확장자 목록입니다.
AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"}

def clean_text(value):
    """None 방지 + 문자열 양끝 공백 제거."""
    return str(value or "").strip()

def normalize_filename(filename):
    """파일명 비교용 정규화."""
    return Path(clean_text(filename)).name.lower()

def normalize_path_text(path_text):
    """윈도우 경로를 JS 상대경로용 슬래시(/) 형태로 정리."""
    return clean_text(path_text).replace("\\", "/").strip("/")

def slug_to_upper_name(slug):
    """fram -> FRAM / dark-johan -> DARK_JOHAN 형태."""
    return clean_text(slug).replace("-", "_").replace(" ", "_").upper()

def stable_voice_id(text):
    """
    재생성해도 같은 입력이면 같은 id가 나오도록 고정형 id를 만듭니다.
    기존 프로젝트의 v_auto_ 형식과 최대한 비슷하게 맞춥니다.
    """
    checksum = zlib.crc32(text.encode("utf-8")) & 0xFFFFFFFF
    return f"v_auto_{checksum}"

def js_string(value):
    """JS 문자열 안전 출력용."""
    return json.dumps(str(value), ensure_ascii=False)

def download_csv_rows(csv_url):
    """
    구글 시트 CSV URL을 받아 Dict 행 목록으로 변환합니다.
    UTF-8 BOM이 있을 수 있어서 utf-8-sig로 읽습니다.
    """
    response = requests.get(csv_url, timeout=30)
    response.raise_for_status()

    csv_text = response.content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(csv_text))

    original_headers = reader.fieldnames or []
    cleaned_headers = [clean_text(header) for header in original_headers]
    canonical_headers = [canonicalize_header_name(header) for header in cleaned_headers]

    if not cleaned_headers:
        raise ValueError("CSV 헤더를 읽지 못했습니다. CSV 링크가 맞는지 확인해 주세요.")

    missing_headers = [header for header in REQUIRED_HEADERS if header not in canonical_headers]
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

        for index, canonical_header in enumerate(canonical_headers):
            original_header = original_headers[index]
            row[canonical_header] = clean_text(raw_row.get(original_header, ""))

        if any(row.values()):
            rows.append(row)

    return rows

def collect_audio_files(folder_path):
    """
    선택한 폴더 바로 아래의 오디오 파일만 읽습니다.
    현재 프로젝트 구조상 한 폴더 단위로 생성하는 것이 더 안전해서 재귀 탐색은 하지 않습니다.
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

def split_filename_core(filename):
    """
    파일명에서 확장자를 제거하고, 자주 붙는 접두를 정리합니다.
    예:
    - 물-프람_영웅화면01.mp3 -> 영웅화면01
    - jp_영웅화면 11.mp3 -> 영웅화면 11
    """
    stem = Path(filename).stem.strip()

    if stem.lower().startswith("jp_"):
        stem = stem[3:]

    if "_" in stem:
        stem = stem.split("_", 1)[1]

    return stem.strip()

def infer_label_from_text(text, label_language="ko"):
    """상황 열이나 파일명에서 가져온 텍스트를 적당히 정리해 라벨로 만듭니다."""
    core = clean_text(text)
    compact = core.replace(" ", "")

    patterns = [
        (r"^자기소개$", "자기소개", "自己紹介"),
        (r"^타이틀콜$", "타이틀 콜", "タイトルコール"),
        (r"^영웅화면0*(\d+)$", "영웅 화면 {}", "英雄画面 {}"),
        (r"^영웅영입0*(\d+)$", "영웅 영입 {}", "英雄加入 {}"),
        (r"^영웅초월0*(\d+)$", "영웅 초월 {}", "英雄超越 {}"),
        (r"^영웅각성0*(\d+)$", "영웅 각성 {}", "英雄覚醒 {}"),
        (r"^전투준비0*(\d+)$", "전투 준비 {}", "戦闘準備 {}"),
        (r"^전투불능$", "전투 불능", "戦闘不能"),
        (r"^승리0*(\d+)$", "승리 {}", "勝利 {}"),
        (r"^일반스킬0*(\d+)$", "일반 스킬 {}", "通常スキル {}"),
        (r"^액티브스킬0*(\d+)$", "액티브 스킬 {}", "アクティブスキル {}"),
        (r"^버스트스킬0*(\d+)$", "버스트 스킬 {}", "バーストスキル {}"),
        (r"^지원요청0*(\d+)$", "지원 요청 {}", "支援要請 {}"),
        (r"^지원응답0*(\d+)$", "지원 응답 {}", "支援応答 {}"),
        (r"^감정표현-고민(?:0*(\d+))?$", "감정표현-고민 {}", "感情表現・悩み {}"),
        (r"^감정표현-긍정(?:0*(\d+))?$", "감정표현-긍정 {}", "感情表現・肯定 {}"),
        (r"^감정표현-놀람(?:0*(\d+))?$", "감정표현-놀람 {}", "感情表現・驚き {}"),
        (r"^감정표현-부정(?:0*(\d+))?$", "감정표현-부정 {}", "感情表現・否定 {}"),
        (r"^감정표현-웃음(?:0*(\d+))?$", "감정표현-웃음 {}", "感情表現・笑い {}"),
        (r"^감정표현-한숨(?:0*(\d+))?$", "감정표현-한숨 {}", "感情表現・ため息 {}"),
    ]

    for pattern, ko_template, jp_template in patterns:
        match = re.match(pattern, compact)
        if not match:
            continue

        number = ""
        if match.groups():
            number = clean_text(match.group(1))

        template = ko_template if label_language == "ko" else jp_template

        if "{}" in template:
            if number:
                return template.format(int(number))
            return template.replace(" {}", "").strip()

        return template

    # 여기까지 왔으면 규칙표에 없는 파일명입니다.
    # 너무 공격적으로 바꾸지 않고, 원래 이름을 최대한 보존해서 보여 줍니다.
    fallback = re.sub(r"([가-힣A-Za-z]+)(\d+)$", r"\1 \2", core).strip()
    return fallback


def infer_label_from_filename(filename, label_language="ko"):
    return infer_label_from_text(split_filename_core(filename), label_language=label_language)


def get_voice_label(row, actual_filename, label_language="ko"):
    raw_label = clean_text(row.get("상황"))
    if raw_label:
        return infer_label_from_text(raw_label, label_language=label_language)
    return infer_label_from_filename(actual_filename, label_language=label_language)

def guess_audio_relative_dir(repo_root, hero_slug, audio_folder):
    """
    오디오 폴더가 repo_root/asset/<hero_slug>/ 아래에 있으면
    그 기준 상대경로를 자동 추측합니다.
    예:
    - asset/fram/프람 - 물 -> 프람 - 물
    - asset/johan/jp/light -> jp/light
    """
    hero_root = repo_root / "asset" / hero_slug

    try:
        relative_path = audio_folder.resolve().relative_to(hero_root.resolve())
        relative_text = relative_path.as_posix()
        return "" if relative_text == "." else relative_text
    except Exception:
        return audio_folder.name

def join_asset_audio_path(hero_slug, audio_relative_dir, actual_filename):
    """JS에 들어갈 audio 경로를 조립합니다."""
    parts = ["asset", hero_slug]

    audio_relative_dir = normalize_path_text(audio_relative_dir)
    if audio_relative_dir:
        parts.append(audio_relative_dir)

    parts.append(actual_filename)
    return "/".join(parts)

def build_common_validation(rows, audio_map):
    """
    CSV와 오디오 폴더를 대조해서
    - 빈 파일명
    - CSV 중복
    - 시트에만 있는 파일
    - 폴더에만 있는 파일
    을 모두 검사합니다.
    """
    logs = []
    csv_seen_names = set()
    duplicate_csv_names = []
    blank_filename_rows = []
    missing_in_folder = []
    matched_rows = []

    for row_number, row in enumerate(rows, start=2):
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

        matched_rows.append((row, actual_filename))

    extra_in_folder = [
        actual_filename
        for normalized_name, actual_filename in sorted(audio_map.items(), key=lambda item: item[1].lower())
        if normalized_name not in csv_seen_names
    ]

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

    return matched_rows, logs

def build_main_voice_entries(rows, audio_map, hero_slug, audio_relative_dir, hero_id):
    """
    메인 영웅 JS용 voices 배열을 만듭니다.
    """
    matched_rows, logs = build_common_validation(rows, audio_map)

    voices = []

    for row, actual_filename in matched_rows:
        label = get_voice_label(row, actual_filename, label_language="ko")
        audio_path = join_asset_audio_path(hero_slug, audio_relative_dir, actual_filename)
        transcript = clean_text(row.get("한국어"))
        voice_key = f"{hero_id}|{audio_path}|{label}|{transcript}"

        voices.append(
            {
                "id": stable_voice_id(voice_key),
                "label": label,
                "transcript": transcript,
                "audio": audio_path,
            }
        )

    logs.append(
        f"[요약] CSV 행 {len(rows)}개 / 로컬 오디오 {len(audio_map)}개 / 메인 JS에 저장된 항목 {len(voices)}개"
    )

    if not voices:
        raise ValueError("메인 JS로 만들 수 있는 일치 항목이 없습니다.")

    return voices, logs

def build_jp_voice_entries(rows, audio_map, hero_slug, audio_relative_dir, hero_slug_upper):
    """
    JP 보조 JS용 전역 배열 데이터를 만듭니다.
    transcript는 CSV의 '일본어'를 사용합니다.
    """
    matched_rows, logs = build_common_validation(rows, audio_map)

    voices = []

    for row, actual_filename in matched_rows:
        transcript = clean_text(row.get("일본어"))
        if not transcript:
            continue

        label = get_voice_label(row, actual_filename, label_language="jp")
        audio_path = join_asset_audio_path(hero_slug, audio_relative_dir, actual_filename)
        voice_key = f"{hero_slug_upper}_JP|{audio_path}|{label}|{transcript}"

        voices.append(
            {
                "id": stable_voice_id(voice_key),
                "label": label,
                "transcript": transcript,
                "audio": audio_path,
            }
        )

    logs.append(
        f"[요약] CSV 행 {len(rows)}개 / 로컬 오디오 {len(audio_map)}개 / JP JS에 저장된 항목 {len(voices)}개"
    )

    if not voices:
        raise ValueError(
            "JP 보조 JS로 만들 수 있는 항목이 없습니다.\n"
            "CSV의 '일본어' 컬럼이 비어 있지 않은지 확인해 주세요."
        )

    return voices, logs

def render_voice_objects(voices, indent_level=3):
    """voices 배열 안쪽 객체들을 JS 스타일 문자열로 렌더링."""
    indent = "    " * indent_level
    inner_indent = "    " * (indent_level + 1)

    chunks = []

    for voice in voices:
        chunks.append(
            "\n".join(
                [
                    f"{indent}{{",
                    f'{inner_indent}id: {js_string(voice["id"])},',
                    f'{inner_indent}label: {js_string(voice["label"])},',
                    f'{inner_indent}transcript: {js_string(voice["transcript"])},',
                    f'{inner_indent}audio: {js_string(voice["audio"])}',
                    f"{indent}}}",
                ]
            )
        )

    return ",\n".join(chunks)

def render_main_js(hero_slug, hero_id, hero_name, element, title, image_path, voices):
    """
    현재 저장소의 영웅별 JS 패턴과 맞춘 메인 파일 렌더링.
    """
    constant_name = f"{slug_to_upper_name(hero_slug)}_DATA"
    voice_text = render_voice_objects(voices, indent_level=3)

    return "\n".join(
        [
            f"const {constant_name} =[",
            "        {",
            f"        id: {js_string(hero_id)},",
            f"        name: {js_string(hero_name)},",
            f"        element: {js_string(element)},",
            f"        title: {js_string(title)},",
            f"        image: {js_string(normalize_path_text(image_path))},",
            "        voices: [",
            voice_text,
            "        ]",
            "    }",
            "];",
            "",
            'if (typeof window !== "undefined") {',
            "    if (!Array.isArray(window.HERO_DATA)) {",
            "        window.HERO_DATA = [];",
            "    }",
            f"    window.HERO_DATA.push(...{constant_name});",
            "}",
            "",
        ]
    )

def render_jp_js(hero_slug, voices):
    """
    현재 johan의 jp-johan.js 패턴과 맞춘 JP 보조 파일 렌더링.
    """
    variable_name = f"{slug_to_upper_name(hero_slug)}_JP_DATA"
    voice_text = render_voice_objects(voices, indent_level=1)

    return "\n".join(
        [
            f"window.{variable_name} = [",
            voice_text,
            "];",
            "",
        ]
    )


def choose_safe_output_path(target_path):
    """기존 파일이 있으면 덮어쓰지 않고 .generated.js 새 파일로 저장합니다."""
    if not target_path.exists():
        return target_path

    candidate = target_path.with_name(f"{target_path.stem}.generated{target_path.suffix}")
    index = 2

    while candidate.exists():
        candidate = target_path.with_name(f"{target_path.stem}.generated.{index}{target_path.suffix}")
        index += 1

    return candidate

class HeroJsBuilderApp(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("LOH Hero JS Builder")
        self.geometry("980x860")
        self.minsize(900, 760)

        detected_repo_root = Path(__file__).resolve().parent.parent

        self.mode_var = tk.StringVar(value="메인 영웅 JS")
        self.csv_url_var = tk.StringVar()
        self.audio_folder_var = tk.StringVar()
        self.repo_root_var = tk.StringVar(value=str(detected_repo_root))
        self.hero_slug_var = tk.StringVar()
        self.hero_id_var = tk.StringVar()
        self.hero_name_var = tk.StringVar()
        self.element_var = tk.StringVar()
        self.title_var = tk.StringVar()
        self.image_path_var = tk.StringVar()
        self.audio_relative_dir_var = tk.StringVar()
        self.status_var = tk.StringVar(value="대기 중")

        self._build_ui()
        self._update_mode_ui()

    def _build_ui(self):
        root = ttk.Frame(self, padding=16)
        root.pack(fill="both", expand=True)

        root.columnconfigure(1, weight=1)
        root.rowconfigure(9, weight=1)

        ttk.Label(
            root,
            text="영웅별 JS / JP 보조 JS 생성기",
            font=("맑은 고딕", 14, "bold"),
        ).grid(row=0, column=0, columnspan=3, sticky="w", pady=(0, 12))

        guide_text = (
            "현재 #loh-voice 구조 기준 생성기입니다.\n"
            "메인 모드는 asset/영웅폴더/영웅폴더.js 를 만들고,\n"
            "JP 모드는 asset/영웅폴더/jp/jp-영웅폴더.js 를 만듭니다.\n"
            "버튼 한 번으로 CSV 다운로드 → 파일 대조 → 경고 로그 → JS 저장까지 진행합니다."
        )
        ttk.Label(root, text=guide_text, justify="left").grid(
            row=1, column=0, columnspan=3, sticky="w", pady=(0, 16)
        )

        ttk.Label(root, text="생성 모드").grid(row=2, column=0, sticky="w", pady=4)
        mode_combo = ttk.Combobox(
            root,
            textvariable=self.mode_var,
            values=["메인 영웅 JS", "JP 보조 JS"],
            state="readonly",
        )
        mode_combo.grid(row=2, column=1, columnspan=2, sticky="ew", pady=4)
        mode_combo.bind("<<ComboboxSelected>>", lambda _event: self._update_mode_ui())

        ttk.Label(root, text="CSV 링크").grid(row=3, column=0, sticky="w", pady=4)
        self.csv_entry = ttk.Entry(root, textvariable=self.csv_url_var)
        self.csv_entry.grid(row=3, column=1, columnspan=2, sticky="ew", pady=4)

        ttk.Label(root, text="오디오 폴더").grid(row=4, column=0, sticky="w", pady=4)
        self.audio_folder_entry = ttk.Entry(root, textvariable=self.audio_folder_var)
        self.audio_folder_entry.grid(row=4, column=1, sticky="ew", pady=4)

        self.audio_folder_button = ttk.Button(root, text="폴더 선택", command=self.browse_audio_folder)
        self.audio_folder_button.grid(row=4, column=2, sticky="ew", padx=(8, 0), pady=4)

        ttk.Label(root, text="저장소 루트").grid(row=5, column=0, sticky="w", pady=4)
        self.repo_root_entry = ttk.Entry(root, textvariable=self.repo_root_var)
        self.repo_root_entry.grid(row=5, column=1, sticky="ew", pady=4)

        self.repo_root_button = ttk.Button(root, text="루트 선택", command=self.browse_repo_root)
        self.repo_root_button.grid(row=5, column=2, sticky="ew", padx=(8, 0), pady=4)

        meta_frame = ttk.LabelFrame(root, text="생성 정보", padding=10)
        meta_frame.grid(row=6, column=0, columnspan=3, sticky="ew", pady=(10, 8))
        meta_frame.columnconfigure(1, weight=1)
        meta_frame.columnconfigure(3, weight=1)

        ttk.Label(meta_frame, text="영웅 폴더명").grid(row=0, column=0, sticky="w", pady=4)
        self.hero_slug_entry = ttk.Entry(meta_frame, textvariable=self.hero_slug_var)
        self.hero_slug_entry.grid(row=0, column=1, sticky="ew", pady=4, padx=(0, 8))

        ttk.Label(meta_frame, text="오디오 상대폴더").grid(row=0, column=2, sticky="w", pady=4)
        self.audio_relative_dir_entry = ttk.Entry(meta_frame, textvariable=self.audio_relative_dir_var)
        self.audio_relative_dir_entry.grid(row=0, column=3, sticky="ew", pady=4)

        ttk.Label(meta_frame, text="영웅 ID").grid(row=1, column=0, sticky="w", pady=4)
        self.hero_id_entry = ttk.Entry(meta_frame, textvariable=self.hero_id_var)
        self.hero_id_entry.grid(row=1, column=1, sticky="ew", pady=4, padx=(0, 8))

        ttk.Label(meta_frame, text="영웅 이름").grid(row=1, column=2, sticky="w", pady=4)
        self.hero_name_entry = ttk.Entry(meta_frame, textvariable=self.hero_name_var)
        self.hero_name_entry.grid(row=1, column=3, sticky="ew", pady=4)

        ttk.Label(meta_frame, text="속성").grid(row=2, column=0, sticky="w", pady=4)
        self.element_entry = ttk.Entry(meta_frame, textvariable=self.element_var)
        self.element_entry.grid(row=2, column=1, sticky="ew", pady=4, padx=(0, 8))

        ttk.Label(meta_frame, text="칭호").grid(row=2, column=2, sticky="w", pady=4)
        self.title_entry = ttk.Entry(meta_frame, textvariable=self.title_var)
        self.title_entry.grid(row=2, column=3, sticky="ew", pady=4)

        ttk.Label(meta_frame, text="이미지 경로").grid(row=3, column=0, sticky="w", pady=4)
        self.image_path_entry = ttk.Entry(meta_frame, textvariable=self.image_path_var)
        self.image_path_entry.grid(row=3, column=1, columnspan=3, sticky="ew", pady=4)

        help_text = (
            "메인 영웅 JS 예시:\n"
            "- 영웅 폴더명: fram\n"
            "- 영웅 ID: water_fram\n"
            "- 영웅 이름: 프람\n"
            "- 속성: water\n"
            "- 칭호: 강철의 수호자\n"
            "- 이미지 경로: asset/fram/water_fram.png\n"
            "- 오디오 상대폴더: 프람 - 물\n\n"
            "JP 보조 JS 예시:\n"
            "- 영웅 폴더명: johan\n"
            "- 오디오 상대폴더: jp/light"
        )
        ttk.Label(root, text=help_text, justify="left").grid(
            row=7, column=0, columnspan=3, sticky="w", pady=(0, 10)
        )

        log_frame = ttk.LabelFrame(root, text="실행 로그", padding=8)
        log_frame.grid(row=9, column=0, columnspan=3, sticky="nsew", pady=(8, 10))
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)

        self.log_text = ScrolledText(log_frame, wrap="word", font=("Consolas", 10))
        self.log_text.grid(row=0, column=0, sticky="nsew")

        bottom = ttk.Frame(root)
        bottom.grid(row=10, column=0, columnspan=3, sticky="ew")
        bottom.columnconfigure(0, weight=1)

        ttk.Label(bottom, textvariable=self.status_var).grid(row=0, column=0, sticky="w")
        self.run_button = ttk.Button(bottom, text="검증 후 JS 생성", command=self.run_pipeline)
        self.run_button.grid(row=0, column=1, sticky="e")

    def _update_mode_ui(self):
        is_main_mode = self.mode_var.get() == "메인 영웅 JS"
        state = "normal" if is_main_mode else "disabled"

        for widget in [
            self.hero_id_entry,
            self.hero_name_entry,
            self.element_entry,
            self.title_entry,
            self.image_path_entry,
        ]:
            widget.configure(state=state)

    def append_log(self, message):
        self.log_text.insert("end", message + "\n")
        self.log_text.see("end")

    def log(self, message):
        self.after(0, lambda: self.append_log(message))

    def browse_audio_folder(self):
        selected_folder = filedialog.askdirectory(title="오디오 폴더를 선택하세요")
        if not selected_folder:
            return

        self.audio_folder_var.set(selected_folder)
        self._try_fill_from_audio_folder(Path(selected_folder))

    def browse_repo_root(self):
        selected_folder = filedialog.askdirectory(title="#loh-voice 루트를 선택하세요")
        if selected_folder:
            self.repo_root_var.set(selected_folder)
            audio_folder = clean_text(self.audio_folder_var.get())
            if audio_folder:
                self._try_fill_from_audio_folder(Path(audio_folder))

    def _try_fill_from_audio_folder(self, audio_folder):
        """
        선택한 오디오 폴더가 asset/<hero_slug>/... 아래라면
        영웅 폴더명과 오디오 상대폴더를 자동으로 채웁니다.
        """
        repo_root = Path(clean_text(self.repo_root_var.get()))
        parts = [part.lower() for part in audio_folder.parts]

        try:
            asset_index = parts.index("asset")
        except ValueError:
            return

        if len(audio_folder.parts) <= asset_index + 1:
            return

        hero_slug = audio_folder.parts[asset_index + 1]
        if not clean_text(self.hero_slug_var.get()):
            self.hero_slug_var.set(hero_slug)

        guessed_relative = guess_audio_relative_dir(repo_root, hero_slug, audio_folder)
        if guessed_relative:
            self.audio_relative_dir_var.set(guessed_relative)

    def set_busy(self, busy):
        state = "disabled" if busy else "normal"

        self.csv_entry.configure(state=state)
        self.audio_folder_entry.configure(state=state)
        self.audio_folder_button.configure(state=state)
        self.repo_root_entry.configure(state=state)
        self.repo_root_button.configure(state=state)
        self.hero_slug_entry.configure(state=state)
        self.audio_relative_dir_entry.configure(state=state)
        self.run_button.configure(state=state)

        self._update_mode_ui()
        self.status_var.set("작업 중..." if busy else "대기 중")

    def run_pipeline(self):
        csv_url = clean_text(self.csv_url_var.get())
        audio_folder_text = clean_text(self.audio_folder_var.get())
        repo_root_text = clean_text(self.repo_root_var.get())
        hero_slug = clean_text(self.hero_slug_var.get())
        audio_relative_dir = clean_text(self.audio_relative_dir_var.get())
        mode = self.mode_var.get()

        if not csv_url:
            messagebox.showwarning("입력 확인", "CSV 링크를 입력해 주세요.")
            return

        if not csv_url.startswith(("http://", "https://")):
            messagebox.showwarning("입력 확인", "CSV 링크는 http:// 또는 https:// 로 시작해야 합니다.")
            return

        if not audio_folder_text:
            messagebox.showwarning("입력 확인", "오디오 폴더를 선택해 주세요.")
            return

        if not repo_root_text:
            messagebox.showwarning("입력 확인", "저장소 루트를 입력해 주세요.")
            return

        if not hero_slug:
            messagebox.showwarning("입력 확인", "영웅 폴더명을 입력해 주세요.")
            return

        audio_folder = Path(audio_folder_text)
        repo_root = Path(repo_root_text)

        if not audio_folder.exists() or not audio_folder.is_dir():
            messagebox.showwarning("입력 확인", "선택한 오디오 폴더가 존재하지 않습니다.")
            return

        if not repo_root.exists() or not repo_root.is_dir():
            messagebox.showwarning("입력 확인", "저장소 루트가 존재하지 않습니다.")
            return

        if mode == "메인 영웅 JS":
            required_main_fields = {
                "영웅 ID": clean_text(self.hero_id_var.get()),
                "영웅 이름": clean_text(self.hero_name_var.get()),
                "속성": clean_text(self.element_var.get()),
                "칭호": clean_text(self.title_var.get()),
                "이미지 경로": clean_text(self.image_path_var.get()),
            }

            missing = [label for label, value in required_main_fields.items() if not value]
            if missing:
                messagebox.showwarning("입력 확인", "메인 영웅 JS에 필요한 항목이 비어 있습니다: " + ", ".join(missing))
                return

        self.log("=" * 78)
        self.log(f"새 작업 시작 - {mode}")
        self.log(f"CSV 링크: {csv_url}")
        self.log(f"오디오 폴더: {audio_folder}")
        self.log(f"저장소 루트: {repo_root}")
        self.log(f"영웅 폴더명: {hero_slug}")
        self.log(f"오디오 상대폴더: {audio_relative_dir or '(없음)'}")

        self.set_busy(True)

        worker = threading.Thread(
            target=self._run_pipeline_worker,
            args=(mode, csv_url, audio_folder, repo_root, hero_slug, audio_relative_dir),
            daemon=True,
        )
        worker.start()

    def _run_pipeline_worker(self, mode, csv_url, audio_folder, repo_root, hero_slug, audio_relative_dir):
        try:
            self.log("[1/4] CSV 다운로드 및 읽기 시작")
            rows = download_csv_rows(csv_url)
            self.log(f"[완료] CSV 데이터 {len(rows)}개 행을 읽었습니다.")

            self.log("[2/4] 로컬 오디오 파일 검사 시작")
            audio_map, duplicate_audio_names = collect_audio_files(audio_folder)

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

            if mode == "메인 영웅 JS":
                hero_id = clean_text(self.hero_id_var.get())
                hero_name = clean_text(self.hero_name_var.get())
                element = clean_text(self.element_var.get())
                title = clean_text(self.title_var.get())
                image_path = clean_text(self.image_path_var.get())

                voices, logs = build_main_voice_entries(
                    rows=rows,
                    audio_map=audio_map,
                    hero_slug=hero_slug,
                    audio_relative_dir=audio_relative_dir,
                    hero_id=hero_id,
                )

                for line in logs:
                    self.log(line)

                self.log("[4/4] 메인 영웅 JS 생성 시작")
                target_path = repo_root / "asset" / hero_slug / f"{hero_slug}.js"
                target_path.parent.mkdir(parents=True, exist_ok=True)

                file_text = render_main_js(
                    hero_slug=hero_slug,
                    hero_id=hero_id,
                    hero_name=hero_name,
                    element=element,
                    title=title,
                    image_path=image_path,
                    voices=voices,
                )
            else:
                hero_slug_upper = slug_to_upper_name(hero_slug)

                voices, logs = build_jp_voice_entries(
                    rows=rows,
                    audio_map=audio_map,
                    hero_slug=hero_slug,
                    audio_relative_dir=audio_relative_dir,
                    hero_slug_upper=hero_slug_upper,
                )

                for line in logs:
                    self.log(line)

                self.log("[4/4] JP 보조 JS 생성 시작")
                target_path = repo_root / "asset" / hero_slug / "jp" / f"jp-{hero_slug}.js"
                target_path.parent.mkdir(parents=True, exist_ok=True)

                file_text = render_jp_js(hero_slug=hero_slug, voices=voices)

            output_path = choose_safe_output_path(target_path)
            if output_path != target_path:
                self.log(f"[경고] 기존 JS가 이미 있어서 원본은 유지했습니다: {target_path}")
                self.log(f"[안내] 새 생성본은 다른 이름으로 저장합니다: {output_path}")

            output_path.write_text(file_text, encoding="utf-8")

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
    app = HeroJsBuilderApp()
    app.mainloop()