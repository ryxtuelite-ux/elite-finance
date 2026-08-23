# EliteFinance V2.0 Full

## Nâng cấp
- Sửa/xóa giao dịch bằng event delegation, hoạt động sau khi lọc hoặc render lại.
- Swipe trái trên iPhone để hiện nút Sửa/Xóa.
- Nhân bản giao dịch.
- Floating Quick Add và bottom sheet tối ưu iPhone.
- Dashboard: chi hôm nay, chi 7 ngày, thu/chi tháng.
- Tài khoản, ngân sách, mục tiêu tiết kiệm, báo cáo donut CSS.
- GitHub Gist: tạo Gist bí mật, đẩy dữ liệu, tải dữ liệu, tùy chọn tự đẩy.
- IndexedDB, JSON backup, CSV export, Dark mode, PWA.

## Đưa lên GitHub Pages
Thay toàn bộ file V1.0 trong repository bằng các file trong thư mục này rồi commit. Settings → Pages vẫn dùng `main` và `/(root)`.

## Gist Sync
1. Tạo GitHub token có quyền Gist.
2. Trong app chọn Gist Sync, nhập token.
3. Bấm `Tạo Gist mới`; app tự lưu Gist ID.
4. Trên iPhone hoặc máy tính còn lại, nhập cùng token và Gist ID rồi bấm `Tải từ Gist`.

Token chỉ được lưu cục bộ trên từng thiết bị và không nằm trong file JSON backup. Không commit token vào repository.


## Sửa lỗi nền tảng V2.0
- index.html dùng section HTML thật, không còn hiển thị template JavaScript trên trang.
- Hàm clone được khai báo trước khi khởi tạo state.
- Kho IndexedDB và cache service worker dùng khóa V2 riêng.
- Dùng qua GitHub Pages hoặc HTTP/HTTPS để PWA, manifest và Gist Sync hoạt động đầy đủ.
