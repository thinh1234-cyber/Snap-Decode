"""
Generate Test Cases for Snap-Decode Client-side QR Decoder
Generates pixel data for:
1. Normal QR (Pass 1)
2. Transparent PNG QR (ensureWhiteBackground)
3. Dark Mode Inverted QR (Pass 4)
4. Low Contrast QR (Pass 2/3)
5. Gradient Shadow QR (Pass 3: Adaptive Binarization)
6. Small Resolution QR (Pass 5)
7. Rotated QRs (90, 180, 270 deg) (Pass 6)
"""

import json
import os
import cv2
import numpy as np
import qrcode
from PIL import Image

OUT_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
os.makedirs(OUT_DIR, exist_ok=True)

test_cases = [
    {
        "id": "normal_qr",
        "name": "QR Bình thường (Pass 1: Raw Decode)",
        "expected": "https://snap-decode.ai/normal",
        "type": "normal"
    },
    {
        "id": "transparent_qr",
        "name": "QR Nền trong suốt PNG (Auto White Composite)",
        "expected": "https://snap-decode.ai/transparent",
        "type": "transparent"
    },
    {
        "id": "dark_mode_qr",
        "name": "QR Đảo màu Dark Mode (Pass 4: Color Inversion)",
        "expected": "https://snap-decode.ai/dark-mode",
        "type": "dark_mode"
    },
    {
        "id": "low_contrast_qr",
        "name": "QR Tương phản thấp (Pass 2: Contrast Stretching)",
        "expected": "https://snap-decode.ai/low-contrast",
        "type": "low_contrast"
    },
    {
        "id": "shadow_gradient_qr",
        "name": "QR Bóng mờ nghiêng (Pass 3: Adaptive Thresholding)",
        "expected": "https://snap-decode.ai/shadow-adaptive",
        "type": "shadow_gradient"
    },
    {
        "id": "small_qr",
        "name": "QR Kích thước nhỏ (Pass 5: Upscale 2x)",
        "expected": "https://snap-decode.ai/small-qr",
        "type": "small"
    },
    {
        "id": "rotated_90_qr",
        "name": "QR Xoay 90 độ (Pass 6: Rotation 90)",
        "expected": "https://snap-decode.ai/rot-90",
        "type": "rot90"
    },
    {
        "id": "rotated_180_qr",
        "name": "QR Xoay 180 độ (Pass 6: Rotation 180)",
        "expected": "https://snap-decode.ai/rot-180",
        "type": "rot180"
    },
    {
        "id": "rotated_270_qr",
        "name": "QR Xoay 270 độ (Pass 6: Rotation 270)",
        "expected": "https://snap-decode.ai/rot-270",
        "type": "rot270"
    }
]

fixtures_data = []

for tc in test_cases:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10 if tc["type"] != "small" else 2,
        border=4 if tc["type"] != "small" else 2
    )
    qr.add_data(tc["expected"])
    qr.make(fit=True)
    img_pil = qr.make_image(fill_color="black", back_color="white").convert("RGBA")
    arr = np.array(img_pil)

    if tc["type"] == "transparent":
        # Make white background transparent (A = 0)
        mask_white = (arr[:, :, 0] > 200) & (arr[:, :, 1] > 200) & (arr[:, :, 2] > 200)
        arr[mask_white, 3] = 0
        # Also simulate dark/empty RGB on transparent pixels
        arr[mask_white, 0:3] = 0

    elif tc["type"] == "dark_mode":
        # Invert colors: black background (0,0,0,255), white modules (255,255,255,255)
        mask_bg = (arr[:, :, 0] > 200)
        mask_fg = (arr[:, :, 0] <= 200)
        arr[mask_bg, 0:3] = 0    # dark bg
        arr[mask_fg, 0:3] = 255  # white fg

    elif tc["type"] == "low_contrast":
        # Compress dynamic range: background 145, module 115
        mask_bg = (arr[:, :, 0] > 200)
        mask_fg = (arr[:, :, 0] <= 200)
        arr[mask_bg, 0:3] = 145
        arr[mask_fg, 0:3] = 115

    elif tc["type"] == "shadow_gradient":
        # Apply smooth lighting shadow from top-left (1.0) to bottom-right (0.35)
        h, w = arr.shape[:2]
        y_grid, x_grid = np.ogrid[:h, :w]
        grad = 0.35 + 0.65 * (1.0 - (x_grid + y_grid) / float(w + h))
        for c in range(3):
            arr[:, :, c] = np.clip(arr[:, :, c] * grad, 0, 255).astype(np.uint8)

    elif tc["type"] == "rot90":
        arr = np.rot90(arr, k=-1)

    elif tc["type"] == "rot180":
        arr = np.rot90(arr, k=2)

    elif tc["type"] == "rot270":
        arr = np.rot90(arr, k=1)

    h, w = arr.shape[:2]
    flat_data = arr.reshape(-1).tolist()

    fixtures_data.append({
        "id": tc["id"],
        "name": tc["name"],
        "expected": tc["expected"],
        "width": w,
        "height": h,
        "data": flat_data
    })

fixtures_path = os.path.join(OUT_DIR, "test_cases.json")
with open(fixtures_path, "w", encoding="utf-8") as f:
    json.dump(fixtures_data, f)

print(f"Generated {len(fixtures_data)} test cases successfully into: {fixtures_path}")
