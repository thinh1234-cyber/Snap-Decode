<div align="center">

<img src="assets/icon.png" alt="Logo" width="100">

# Snap Decode

> Chrome Extension: Đọc mã QR thông minh & Tải tài liệu (Scribd, StuDocu, SlideShare)

[![Version](https://img.shields.io/badge/version-2.3.0-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)

[Ủng hộ](#-ủng-hộ-tác-giả) • [Tính năng](#-tính-năng-chính) • [Cài đặt](#-cài-đặt) • [Cách dùng](#-hướng-dẫn-sử-dụng) • [Lưu ý](#-lưu-ý-quan-trọng) • [Cấu hình in](#-cấu-hình-in-pdf-chuẩn)

</div>

---

## ☕ Ủng hộ tác giả

<div align="center">

Nếu **Snap Decode** giúp ích cho việc học tập và nghiên cứu của bạn, bạn có thể mời tác giả một ly cà phê để tiếp thêm động lực duy trì và phát triển công cụ nhé!

<br>

<img src="assets/QR_stknh.jpg" alt="Ủng hộ tác giả" width="160" style="border-radius: 8px;">

<br>
<p>Made with ❤️ by <b>Nguyễn Thịnh - Kyle</b></p>

</div>

---

## 🚀 Tính năng chính

1. **Đọc mã QR & Barcode siêu tốc:**
   - Tự động bật/tắt engine nền (Native Messaging), không tốn RAM khi không dùng.
   - Tự động nhận diện và định vị mã QR (ROI Localization) trong ~30ms.
2. **Tải tài liệu PDF chất lượng cao (100% Client-side):**
   - **Scribd:** Tự động chuyển link sạch và căn chuẩn khổ in.
   - **StuDocu:** Tự động quét và tải tài liệu trong trường hợp chưa bị đánh mờ xen kẽ.
   - **SlideShare:** Tải toàn bộ slide độ phân giải gốc, tự động căn khổ ngang.
   - **Nút nổi tiện lợi:** Tự động hiện nút `⚡ Tải PDF` ở góc màn hình khi duyệt tài liệu.

---

## 📦 Cài đặt

> [!NOTE]
> Bạn **không cần biết lập trình hay gõ lệnh phức tạp**. Toàn bộ quá trình cài đặt chỉ mất khoảng 1 phút qua 3 bước cực kỳ đơn giản:

### Bước 1: Tải bộ cài đặt về máy tính
1. Nhìn lên góc trên bên phải của trang GitHub này, bấm vào nút màu xanh lá cây **`Code`** ▾.
2. Chọn **`Download ZIP`** để tải trọn bộ tiện ích về máy.
3. Sau khi tải xong, nhấp chuột phải vào file `.zip` vừa tải $\rightarrow$ Chọn **`Extract All...`** *(Giải nén tất cả)* $\rightarrow$ Bấm **Extract**.
4. 💡 **Mẹo nhỏ:** Hãy chuyển thư mục `Snap-Decode` vừa giải nén đến một nơi lưu trữ cố định (ví dụ: ổ `D:\` hoặc thư mục `Documents`), **tránh để trong thư mục Downloads** rồi vô tình xóa nhầm, vì Extension sẽ chạy trực tiếp từ thư mục này.

---

### Bước 2: Kích hoạt bộ xử lý ngầm (Chỉ cần làm đúng 1 lần)
1. Mở thư mục `Snap-Decode` vừa giải nén.
2. Tìm và **nhấp đúp chuột (double-click)** vào file **`setup_auto_backend.bat`** *(nếu máy tính của bạn ẩn phần mở rộng đuôi file thì file có tên là `setup_auto_backend`)*.
3. Cửa sổ màu đen sẽ hiện lên và tự động thiết lập trong 1-2 giây rồi hoàn tất:
   - *Nếu Windows hiện màn hình xanh "Windows protected your PC":* Bạn chỉ cần bấm vào chữ **`More info`** $\rightarrow$ Chọn **`Run anyway`** *(Chạy bất kể)* là xong.
   - Script này giúp tính năng quét mã QR tự động bật/tắt ngầm khi cần, hoàn toàn không chạy ngầm liên tục làm tốn RAM hay nặng máy.

---

### Bước 3: Thêm Extension vào trình duyệt Chrome (hoặc Edge / Cốc Cốc / Brave)
1. Mở trình duyệt Chrome, copy dòng sau dán vào thanh địa chỉ rồi nhấn **Enter**:  
   `chrome://extensions/`  
   *(Nếu bạn dùng Microsoft Edge thì truy cập: `edge://extensions/`)*
2. Bật công tắc **`Developer mode`** *(Chế độ cho nhà phát triển)* ở góc trên cùng bên phải màn hình.
3. Nhấp vào nút **`Load unpacked`** *(Tải tiện ích đã giải nén)* ở góc trên bên trái.
4. Trỏ đến và chọn đúng thư mục **`Snap-Decode`** $\rightarrow$ Bấm **`Select Folder`** *(Chọn thư mục)*.
5. **Ghim lên thanh công cụ:** Bấm vào biểu tượng **Mảnh ghép** (🧩) ở góc trên bên phải trình duyệt $\rightarrow$ Nhấp vào biểu tượng **Cái ghim** (📌) cạnh tên `Snap Decode` để tiện sử dụng mọi lúc.

---

## 📖 Hướng dẫn sử dụng

### 1. Quét mã QR & Barcode trên màn hình

- **Cách 1 (Dùng chuột):** Nhấp vào icon Extension trên thanh công cụ $\rightarrow$ Nhấp chọn **Quét QR**.
- **Cách 2 (Phím tắt nhanh):** Nhấn tổ hợp phím tắt (gợi ý: `Alt + X`) bất cứ khi nào đang duyệt web.
- **Thao tác quét:**
  - Con trỏ chuột chuyển sang dạng dấu thập $(+)$.
  - Nhấn giữ chuột trái và kéo chọn vùng chứa mã QR / Barcode trên màn hình $\rightarrow$ Thả chuột.
  - Kết quả giải mã hiển thị tức thì: bạn có thể bấm **Sao chép** để copy văn bản hoặc bấm **Mở liên kết** nếu nội dung là URL.
- **Tùy chỉnh phím tắt theo ý muốn:**
  1. Truy cập `chrome://extensions/shortcuts` trên thanh địa chỉ trình duyệt.
  2. Tìm đến mục **Snap Decode**.
  3. Nhấp vào biểu tượng cây bút tại dòng *Kích hoạt tiện ích* $\rightarrow$ Bấm tổ hợp phím bạn muốn gán (ví dụ: `Alt + X` hoặc `Ctrl + Shift + S`).

---

### 2. Mở khóa & Tải tài liệu (Scribd / StuDocu / SlideShare)

- **Tự động nhận diện:** Khi bạn truy cập trang tài liệu trên Scribd, StuDocu hoặc SlideShare, Extension sẽ tự động nhận diện và hiển thị nút nổi **⚡ Tải PDF** ở góc dưới cùng bên phải màn hình (hoặc bạn có thể mở popup Extension và bấm **Tải Tài Liệu**).
- **Tiến trình xử lý:**
  1. Nhấp nút **⚡ Tải PDF**.
  2. Hộp thoại thông báo tiến trình sẽ hiển thị phần trăm quét tài liệu theo thời gian thực (từ 0% đến 100%). Extension sẽ tự động nạp ảnh chất lượng cao, căn chỉnh khoảng cách, chống chồng chữ và chuẩn hóa từng trang vào khổ in A4.
- **Xuất file PDF:**
  1. Khi tiến trình hoàn tất (100%), hộp thoại in của trình duyệt *(Chrome Print Dialog)* sẽ tự động mở lên.
  2. Kiểm tra các thông số in theo bảng **Cấu hình in PDF chuẩn** bên dưới.
  3. Nhấp **Save** *(Lưu)* để lưu file PDF chất lượng cao về máy tính.

---

## 💡 Lưu ý quan trọng

> [!TIP]
> - **SlideShare:** Khi chuyển từ bài thuyết trình này sang bài khác trong cùng tab (slide $n \rightarrow n+1$), hãy **F5 (Reload lại trang)** trước khi bấm tải để nạp mới toàn bộ danh sách ảnh của bài mới.
> - **StuDocu:** Khi vừa mở tài liệu, hãy **bấm nút `⚡ Tải PDF` ngay** mà không lướt trang xuống dưới để tránh web kích hoạt pop-up bắt mua gói Premium. Nếu lỡ bị chặn, chỉ cần **mở lại link trong Tab ẩn danh (Incognito)** là tải bình thường.
> - **Scribd:** Giữ nguyên tab trong quá trình quét nạp cho đến khi hộp thoại in tự động mở ra.

---

## ⚙️ Cấu hình in PDF chuẩn

<div align="center">
  <img src="assets/print_config_guide.png" alt="Cấu hình Chrome Print" width="560">
</div>

<br>

| Mục | Giá trị chọn | Ghi chú |
|---|---|---|
| **Destination** | **Save as PDF** | Lưu file dạng `.pdf` |
| **Pages** | **All** | In tất cả các trang |
| **Layout** | **Portrait** *(hoặc Landscape)* | Dọc cho văn bản, Ngang cho SlideShare |
| **Paper size** | **A4** | Khổ chuẩn quốc tế |
| **Margins** | **None** | Tràn viền, loại bỏ lề trắng thừa |
| **Scale** | **Default** | Tự động căn chỉnh vừa trang |
| **Options** | ✅ **Background graphics** | **Bắt buộc tích** để hiển thị ảnh, màu và công thức |

*(Chrome sẽ tự động ghi nhớ cấu hình này cho các lần in sau).*
