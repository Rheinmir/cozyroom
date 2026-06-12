import os
import sys
import time
from pathlib import Path

# Force stdout/stderr to use UTF-8 to prevent encoding crashes on Windows terminal
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

try:
    from faster_whisper import WhisperModel
except ImportError:
    print("Error: 'faster-whisper' package is not installed.")
    print("Please install it using: pip install faster-whisper")
    sys.exit(1)

# Path to the music directory on Windows
MUSIC_DIR = r"F:\250930music"

# Supported audio extensions
AUDIO_EXTENSIONS = {".mp3", ".opus", ".m4a", ".webm", ".flac", ".wav"}

def format_timestamp(seconds):
    minutes = int(seconds // 60)
    seconds_rem = seconds % 60
    return f"[{minutes:02d}:{seconds_rem:05.2f}]"

def transcribe_file(model, audio_path):
    print(f"Transcribing: {audio_path.name}")
    try:
        # Transcribe with language='vi' (Vietnamese)
        segments, info = model.transcribe(
            str(audio_path),
            language="vi",
            beam_size=5,
            vad_filter=True  # filters out music/silence to prevent hallucinations
        )
        
        lrc_lines = []
        for segment in segments:
            timestamp = format_timestamp(segment.start)
            lrc_lines.append(f"{timestamp} {segment.text.strip()}")
            # Print progress to console
            print(f"  {timestamp} {segment.text.strip()}")
            
        lrc_path = audio_path.with_suffix(".lrc")
        with open(lrc_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lrc_lines))
            
        print(f"[OK] Saved lyrics to: {lrc_path.name}\n")
    except Exception as e:
        print(f"[ERR] Failed to transcribe {audio_path.name}: {e}\n")

def main():
    if not os.path.exists(MUSIC_DIR):
        print(f"Error: Music directory not found at {MUSIC_DIR}")
        sys.exit(1)

    # Set process priority to Low (IDLE) on Windows to ensure 0% impact on work/games
    try:
        import win32process
        import win32api
        import win32con
        pid = win32api.GetCurrentProcessId()
        handle = win32api.OpenProcess(win32con.PROCESS_ALL_ACCESS, True, pid)
        win32process.SetPriorityClass(handle, win32process.IDLE_PRIORITY_CLASS)
        print("[OK] Process priority set to IDLE (Lowest) to prevent any system lag.")
    except ImportError:
        try:
            import psutil
            p = psutil.Process(os.getpid())
            p.nice(psutil.IDLE_PRIORITY_CLASS)
            print("[OK] Process priority set to IDLE (Lowest) via psutil.")
        except ImportError:
            print("[!] Could not set process priority to IDLE automatically (pywin32 or psutil not found).")
            print("  This is fine, but installing them will help prevent any gaming lag.")

    print("Scanning library for missing lyrics...")
    missing_files = []
    for root, _, files in os.walk(MUSIC_DIR):
        for file in files:
            path = Path(root) / file
            if path.suffix.lower() in AUDIO_EXTENSIONS:
                lrc_path = path.with_suffix(".lrc")
                if not lrc_path.exists():
                    missing_files.append(path)

    if not missing_files:
        print("[OK] All music files already have lyrics (.lrc)!")
        return

    print(f"Found {len(missing_files)} files without lyrics.")
    
    model = None
    # Try GPU (CUDA) first since RTX 4070 is idle
    try:
        print("Attempting to load Whisper model 'medium' on GPU (CUDA)...")
        # On GPU, float16 or int8_float16 is fastest
        model = WhisperModel("medium", device="cuda", compute_type="float16")
        print("[OK] Loaded successfully on GPU (CUDA)! Transcribing at maximum speed.")
    except Exception as gpu_err:
        print(f"[!] GPU load failed: {gpu_err}")
        print("Falling back to CPU with 4 threads and int8 quantization...")
        try:
            model = WhisperModel("medium", device="cpu", compute_type="int8", cpu_threads=4)
            print("[OK] Loaded successfully on CPU.")
        except Exception as cpu_err:
            print(f"Error loading model: {cpu_err}")
            sys.exit(1)

    print("Model loaded successfully.\n")

    for idx, path in enumerate(missing_files, 1):
        print(f"[{idx}/{len(missing_files)}] starting...")
        transcribe_file(model, path)

if __name__ == "__main__":
    main()
