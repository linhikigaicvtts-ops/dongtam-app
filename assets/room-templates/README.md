# Ảnh mẫu phòng/mái — Xem thử SKU

## Cách thay ảnh placeholder bằng ảnh thật

1. Chụp/chuẩn bị ảnh phòng/mái thật (jpg/png), đặt vào thư mục này, ví dụ `phong-khach-2.jpg`.
2. Tạo file JSON cùng tên (`phong-khach-2.json`) theo mẫu:

```json
{
  "id": "phong-khach-2",
  "name": "Tên hiển thị cho khách chọn",
  "image": "assets/room-templates/phong-khach-2.jpg",
  "width": 900,
  "height": 600,
  "zones": [
    { "name": "san", "label": "Sàn", "points": [[x1,y1],[x2,y2],[x3,y3],[x4,y4]], "tileRepeat": [5,3] }
  ]
}
```

3. Thêm đường dẫn file JSON đó vào `index.json`.

## Quy ước tọa độ `points`

4 điểm theo đúng thứ tự: **[Trên-trái, Trên-phải, Dưới-phải, Dưới-lá]** (TL, TR, BR, BL)
của vùng cần lắp họa tiết (sàn/tường/mái), tính bằng pixel trên ảnh gốc
(kích thước `width` × `height` khai báo trong JSON — không phải kích thước hiển thị trên màn hình).

Cách lấy tọa độ nhanh: mở ảnh trong Photoshop/Paint/trình xem ảnh có hiện tọa độ con trỏ,
rê chuột tới 4 góc của vùng sàn/mái trong ảnh, ghi lại toạ độ (x,y) từng góc theo đúng thứ tự trên.

## `tileRepeat`

`[số lần lặp ngang, số lần lặp dọc]` — quy định ảnh SKU (1 viên gạch/ngói) được lặp lại
bao nhiêu lần để phủ kín vùng, tạo cảm giác lát nhiều viên thay vì kéo giãn 1 viên duy nhất.
Chỉnh số này cho vừa mắt với từng ảnh mẫu thật (thử vài số rồi chọn số đẹp nhất).
