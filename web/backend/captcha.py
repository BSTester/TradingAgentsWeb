import base64
import time
import uuid
from typing import Dict, Tuple

# In-memory captcha store: { id: { "seed": str, "expires": float } }
_CAPTCHAS: Dict[str, Dict[str, float | str]] = {}

# Expiry in seconds
CAPTCHA_TTL_SECONDS = 120

def _escape_svg_text(text: str) -> str:
    return text.replace("&", "&").replace("<", "<").replace(">", ">")

def generate_captcha_code(length: int = 5) -> str:
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(chars[int(uuid.uuid4().int % len(chars))] for _ in range(length))

def derive_code_from_seed(seed: str, length: int = 5) -> str:
    """
    从 seed 派生 code：使用 SHA256(seed) 映射到字符集，长度为 length
    前后端需保持完全相同的算法以便校验
    """
    import hashlib
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    # 展开足够长度的索引
    idxs = []
    # 将 digest 循环使用，生成 length 个索引
    for i in range(length):
        b = digest[i % len(digest)]
        idxs.append(b % len(chars))
    return "".join(chars[i] for i in idxs)

def svg_captcha_image(code: str, width: int = 160, height: int = 60) -> str:
    # Simple SVG with noise lines and random colors
    import random
    def rand_color():
        return f"rgb({random.randint(50,160)},{random.randint(50,160)},{random.randint(50,160)})"
    lines = []
    for _ in range(6):
        x1, y1, x2, y2 = random.randint(0, width), random.randint(0, height), random.randint(0, width), random.randint(0, height)
        lines.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{rand_color()}" stroke-width="2" />')
    text_elems = []
    spacing = width // (len(code) + 1)
    for i, ch in enumerate(code):
        x = spacing * (i + 1)
        y = height // 2 + random.randint(-8, 8)
        rotation = random.randint(-15, 15)
        text_elems.append(f'<text x="{x}" y="{y}" fill="{rand_color()}" font-size="28" font-weight="bold" transform="rotate({rotation},{x},{y})">{_escape_svg_text(ch)}</text>')
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">
  <rect width="100%" height="100%" fill="rgb(240,240,240)" />
  {"".join(lines)}
  {"".join(text_elems)}
</svg>'''
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode("utf-8")).decode("utf-8")

def create_captcha() -> Tuple[str, str]:
    # 生成 seed 并保存，前端据此派生并绘制验证码
    seed = uuid.uuid4().hex  # 16字节hex即可
    captcha_id = uuid.uuid4().hex
    _CAPTCHAS[captcha_id] = {"seed": seed, "expires": time.time() + CAPTCHA_TTL_SECONDS}
    return captcha_id, seed

def verify_captcha(captcha_id: str, answer: str) -> bool:
    entry = _CAPTCHAS.get(captcha_id)
    if not entry:
        return False
    if time.time() > float(entry["expires"]):
        # expired; delete and fail
        _CAPTCHAS.pop(captcha_id, None)
        return False
    seed = str(entry.get("seed", ""))
    expected = derive_code_from_seed(seed).upper() if seed else ""
    ok = str(answer or "").strip().upper() == expected
    # one-time use: remove after attempt regardless of pass/fail to prevent brute-force
    _CAPTCHAS.pop(captcha_id, None)
    return ok