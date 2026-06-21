from pathlib import Path
import sys

if len(sys.argv) < 2:
    print("사용법: py set-backend-url.py https://내-vercel-주소.vercel.app")
    sys.exit(1)

url = sys.argv[1].strip().rstrip("/")
target = Path("neis-extension.js")

if not target.exists():
    print("neis-extension.js 파일이 있는 폴더에서 실행해주세요.")
    sys.exit(1)

text = target.read_text(encoding="utf-8")
text = text.replace("https://YOUR-VERCEL-PROJECT.vercel.app", url)
target.write_text(text, encoding="utf-8")
print(f"백엔드 주소 반영 완료: {url}")
