<div align="center">

<img src="assets/icon.png" alt="Logo" width="100">

# Snap Decode

> **Chrome Extension:** Đọc mã QR siêu tốc, Trích xuất chữ (OCR) & Tải tài liệu học tập sạch đẹp (Scribd, StuDocu, SlideShare, SlideServe)

[![Version](https://img.shields.io/badge/version-2.3.0-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)

[Tính năng](#-tính-năng-nổi-bật) • [Cài đặt](#-cài-đặt-nhanh-1-phút) • [Cách dùng](#-hướng-dẫn-sử-dụng) • [Cấu hình in](#-cấu-hình-in-pdf-chuẩn) • [Ủng hộ](#-ủng-hộ-tác-giả)

</div>

---

## 🚀 Tính năng nổi bật

1. **Quét & Giải mã QR Code siêu tốc:**
   - Kéo chọn vùng màn hình bất kỳ để quét QR và Barcode tức thì với phím tắt `Alt + X`.
   - Engine xử lý trực tiếp trên trình duyệt (100% Client-side), nhận diện tốt cả mã mờ, nghiêng, nhỏ hoặc chế độ nền tối (Dark mode).

2. **Trích xuất chữ (OCR) trực tiếp trên Frontend:**
   - Tích hợp OCR ngay trong tiện ích, quét và nhận diện chữ tiếng Việt & tiếng Anh trực tiếp từ hình ảnh, bài giảng hay video mà không cần tải ảnh về máy.
   - Sao chép văn bản chỉ với 1-click.

3. **Mở khóa & Tải tài liệu học tập (SnapDoc Unlocker):**
   - Hỗ trợ tải PDF chất lượng cao từ **Scribd**, **StuDocu**, **SlideShare** và **SlideServe**.
   - Tự động nhận diện tài liệu và hiển thị nút nổi **`⚡ Tải PDF`** tiện lợi.
   - Tự động chuẩn hóa khổ giấy in A4 (Dọc cho tài liệu đọc, Ngang cho Slide), chống tràn trang, loại bỏ trang trắng thừa.

4. **Bảo mật & Tiện ích:**
   - Lưu trữ lịch sử quét nội bộ trên máy, tìm kiếm và xuất dữ liệu dễ dàng.
   - Hoạt động độc lập, tôn trọng quyền riêng tư (không gửi dữ liệu ra máy chủ bên ngoài).

---

## 📦 Cài đặt nhanh (1 phút)

> Tiện ích hoạt động hoàn toàn trực tiếp trên trình duyệt (Client-side), không yêu cầu cài đặt môi trường phức tạp.

1. **Tải mã nguồn:**
   - Nhấp vào nút xanh **`Code`** ▾ ở đầu trang GitHub này $\rightarrow$ Chọn **`Download ZIP`**.
   - Giải nén file ZIP vào một thư mục cố định trên máy (ví dụ: `Documents` hoặc ổ `D:\`).

2. **Cài đặt vào Chrome (hoặc Edge / Cốc Cốc / Brave):**
   - Mở trình duyệt và truy cập: `chrome://extensions/`
   - Bật công tắc **`Developer mode`** *(Chế độ cho nhà phát triển)* ở góc trên bên phải.
   - Bấm nút **`Load unpacked`** *(Tải tiện ích đã giải nén)* ở góc trên bên trái $\rightarrow$ Chọn thư mục **`Snap-Decode`**.

3. **Ghim tiện ích:** Bấm vào biểu tượng Mảnh ghép (🧩) trên thanh công cụ $\rightarrow$ Nhấp biểu tượng Ghim (📌) cạnh **Snap Decode** để tiện dùng bất kỳ lúc nào.

---

## 📖 Hướng dẫn sử dụng

### 1. Quét mã QR & Trích xuất chữ (OCR)
- Nhấn phím tắt **`Alt + X`** (hoặc nhấp vào biểu tượng Extension $\rightarrow$ Chọn **Quét mã QR màn hình**).
- Nhấn giữ chuột trái và kéo chọn vùng chứa mã QR hoặc đoạn chữ cần lấy.
- Cửa sổ kết quả sẽ hiện ra ngay lập tức: bạn có thể bấm **Sao chép** nội dung hoặc **Mở liên kết**.

> *Mẹo tùy chỉnh phím tắt:* Bạn có thể đổi sang phím tắt khác tại `chrome://extensions/shortcuts`.

### 2. Tải tài liệu Scribd, StuDocu, SlideShare, SlideServe
- Mở trang tài liệu cần tải, Extension sẽ tự động xuất hiện nút nổi **`⚡ Tải PDF`** ở góc dưới màn hình (hoặc bấm mở Popup $\rightarrow$ **Mở khóa & Tải tài liệu**).
- Nhấp vào nút tải và đợi thanh tiến trình nạp dữ liệu hoàn tất.
- Hộp thoại in của trình duyệt sẽ tự động mở lên, bạn chỉ cần chọn **Save as PDF** để lưu file.

---

## ⚙️ Cấu hình in PDF chuẩn

Để bản in tài liệu đạt chất lượng cao nhất và không bị viền trắng thừa, hãy chọn thông số trong hộp thoại in của Chrome:

<div align="center">
  <img src="assets/print_config_guide.png" alt="Cấu hình Chrome Print" width="560">
</div>

<br>

| Mục | Cấu hình khuyên dùng | Mục đích |
|---|---|---|
| **Destination** | **Save as PDF** | Xuất tài liệu ra định dạng `.pdf` |
| **Pages** | **All** | In toàn bộ các trang |
| **Layout** | **Portrait** *(hoặc Landscape)* | Dọc cho văn bản (Scribd, StuDocu), Ngang cho Slide (SlideShare, SlideServe) |
| **Paper size** | **A4** | Khổ giấy tiêu chuẩn |
| **Margins** | **None** | Căn sát viền, loại bỏ lề thừa |
| **Options** | ✅ **Background graphics** | **Bắt buộc tích** để giữ nguyên màu sắc, ảnh nền và hình vẽ |

---

## ☕ Ủng hộ tác giả

<div align="center">

Nếu **Snap Decode** giúp ích cho công việc và học tập của bạn, bạn có thể mời tác giả một ly cà phê nhé!

<br>

<img src="assets/QR_stknh.jpg" alt="Ủng hộ tác giả" width="160" style="border-radius: 8px;">

<br>
<p>Made with ❤️ by <b>Nguyễn Thịnh - Kyle</b></p>

</div>
