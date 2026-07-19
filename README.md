# ĐỒNG TÂM KV23 – Sales Tool

## Thông tin dự án
- **GitHub Pages:** https://linhikigaicvtts-ops.github.io/dongtam-app/
- **Repo:** github.com/linhikigaicvtts-ops/dongtam-app
- **Sheet TEST:** 1zDgFO7nYDc4t4WLtZkQWGZpv_kY9l3fezdRJ-od3VaQ
- **Apps Script URL:** AKfycbzA3UV86ClaGXtttl3Fvb2e_MYaUSUOqjPqquLjySrL-_MDIeIIUxV82UydwyXLuc2brQ
- **Email nhận đơn:** linhikigai.cv.tts@gmail.com
- **SĐT:** 0819 548 908

## Login (v11 – đã sửa bảo mật)
- 3 tài khoản: 1 admin + 2 nhân viên. **Mật khẩu KHÔNG ghi ở đây** — xem
  trực tiếp tab "Users" trong Sheet (cột "Mật khẩu (xem để nhớ)", chỉ admin
  truy cập được Sheet).
- Mật khẩu **không** lưu plaintext trong index.html/script.js. Tab "Users"
  lưu password đã hash SHA-256. Đổi mật khẩu: dùng màn "Quản lý tài khoản"
  trong app (admin), hoặc sửa trực tiếp ô "Mật khẩu (xem để nhớ)" trong Sheet.

## Cấu trúc Sheet TEST
| Tab | Nội dung |
|-----|----------|
| Bảng giá Đồng Tâm 🧱 Gạch | Giá gạch thường (cột R[17]=CT150 NK, S[18]=CT150 GH) |
| CT1 - Sale tháng 🔥 | 186 mã sale tháng 07 |
| CT2 - Xả kho 📦 | 315 mã xả kho |
| Bảng giá Ngói | Ngói tráng men |
| Bảng giá Keo | Keo GECKO |
| Bảng giá Kính | Gạch kính |
| Ảnh sản phẩm | Mã SP + Link Drive (KHÔNG dùng Google Photos) |
| Tổng hợp | Tồn kho: [5]=Mã, [21]=Khả dụng viên, [22]=Có sẵn viên, [23]=viên/thùng, [24]=Còn/Hết |
| Đơn hàng | Lưu đơn đặt hàng |

## Apps Script v11 – Actions
- `?action=getGia&loai=gach|ngoi|keo|kinh` → giá thường
- `?action=getCT&loai=ct1|ct2` → giá sale CT1/CT2
- `?action=getImages` → ảnh Drive
- `?action=getTonKho` → tồn kho từ Tổng hợp (có cảnh báo email nếu cột Sheet đổi cấu trúc)
- `?action=luuDon&data=JSON` → lưu đơn + email PDF + lưu khách hàng vào mini-CRM
- `?action=login&username=&password=` → đăng nhập thật qua tab "Users" (hash SHA-256)
- `?action=getDonHang&username=&role=` → lịch sử đơn (nv chỉ thấy đơn của mình, admin thấy tất cả)
- `?action=getKhachHang` → danh sách khách hàng đã từng đặt (autocomplete)

## Sửa lỗi quan trọng trong v11
- **Bug nghiêm trọng đã sửa:** form gửi đơn (`guiDonHang`) trước đây gọi
  Apps Script thiếu tham số `action=luuDon`, và dùng `fetch(..., {mode:'no-cors'})`
  nên luôn báo "Gửi đơn thành công" dù request có thể đã thất bại — đơn có
  thể đã không được lưu/gửi email mà không ai biết. Đã đổi sang JSONP để
  đọc đúng kết quả thật từ server trước khi báo thành công.
- Password đăng nhập không còn lưu plaintext trong index.html.
- Tab giá đổi cấu trúc cột (chèn/xóa cột) → tự gửi email cảnh báo cho admin
  (tối đa 1 email/24h/tab) thay vì tính sai giá âm thầm.

## Tính năng đã có
- [x] Tab Gạch: filter Porcelain/Ceramic/★CL/Sale, sidebar kích cỡ
- [x] CT1/CT2 gộp vào DATA (tìm kiếm được ở tab Gạch)
- [x] Tab Sale: CT1/CT2 + sidebar kích cỡ + tìm kiếm
- [x] Detail popup: giá đầy đủ, ảnh lướt nhiều ảnh (‹›), viên·kg
- [x] Zalo format: SP thường + SP Sale đúng format
- [x] Giỏ hàng: thêm/sửa/xóa, thùng/viên/kg tự cập nhật
- [x] Xuất PDF báo giá đẹp
- [x] Xuất Excel format giống PDF (thùng/viên/kg)
- [x] Gửi đơn → Sheet + Email PDF
- [x] Tab Ngói, Keo, Kính
- [x] Tồn kho (badge trong popup, tab riêng, cảnh báo hết hàng)
- [x] Đăng nhập thật qua Apps Script (hash, không lộ password trong code)
- [x] Lịch sử đơn hàng (nhân viên xem lại đơn mình đã lập)
- [x] Mini-CRM khách hàng: autocomplete tên/SĐT/địa chỉ khi lập đơn mới
- [x] Cảnh báo email khi cấu trúc cột bảng giá trong Sheet bị thay đổi
- [x] Sửa bug gửi đơn không xác nhận được thành công/thất bại thật

## CT150 tháng 06-07
- Gạch thường: lấy từ cột CT150 NK trong Sheet (r[17])
- SP Sale: lấy từ cột CT150 NK trong Sheet CT1/CT2
- Fallback: NK × 95% nếu không có

## Checklist trước khi deploy
- [ ] URL Apps Script đúng (5 chỗ trong index.html: getGia, getImages, getTonKho, guiDonHang, getKhachHang/getDonHang)
- [ ] CT1_DATA: 186 mã, CT2_DATA: 315 mã
- [ ] Syntax JS PASS (node --check)
- [ ] mergeCTintoDATA chạy khi load
- [ ] shareZalo format đúng
- [ ] Deploy lại Apps Script (v11): Trong Apps Script editor → Deploy → Manage deployments → sửa deployment hiện có → New version (KHÔNG tạo deployment mới, giữ nguyên URL)
- [ ] Sau khi deploy v11 lần đầu: mở app, thử đăng nhập 1 lần để Apps Script tự tạo tab "Users" + "Khách hàng" trong Sheet
- [ ] Test gửi 1 đơn hàng thật, kiểm tra: (1) tab "Đơn hàng" có dòng mới với cột "Mã đơn", (2) nhận được email PDF, (3) mở lại "Lịch sử đơn" trong app thấy đơn vừa gửi

## Zalo format
**SP Sale:**
```
GẠCH ĐỒNG TÂM KV23
📌 Mã: [mã]  🔥 Sale tháng 07
📐 Kích cỡ: [kc]
━━━━━━━━━━━━━━
1. Giá lẻ: [le]đ/m²

2. Giá Sale đại lý nhận kho: [saleNK]đ/m²
---->>> Chương trình tháng 7 nhận kho giảm thêm 5% còn: [ct150]đ/m²

3. Giá Sale đại lý đi giao tận nơi Hồ Chí Minh: [saleGH]đ/m²
```

**SP thường:**
```
GẠCH ĐỒNG TÂM KV23
📌 Mã: [mã]
📐 Kích cỡ: [kc]
━━━━━━━━━━━━━━
1. Giá lẻ: [le]đ/m²

2. Giá đại lý nhận kho: [nk]đ/m²
---->>> Chương trình tháng 7 nhận kho giảm thêm 5% còn: [ct150]đ/m²

3. Giá đại lý đi giao tận nơi Hồ Chí Minh: [gh]đ/m²
```
