// ============================================================
// Apps Script v11 – DongTam KV23
// Sheet TEST: 1zDgFO7nYDc4t4WLtZkQWGZpv_kY9l3fezdRJ-od3VaQ
// Đồng bộ với HTML SalesTool __4_.html
//
// THAY ĐỔI SO VỚI v10:
// - Đăng nhập thật qua tab "Users" (password lưu hash SHA-256, không
//   còn để lộ plaintext trong index.html). Tab Users tự tạo lần đầu
//   chạy với 3 tài khoản cũ (linh/nhanvien1/nhanvien2) nên không cần
//   sửa Sheet tay.
// - Cảnh báo tự động qua email nếu cấu trúc cột 1 tab giá bị đổi
//   (chèn/xóa cột) — tránh tính sai giá âm thầm.
// - Lưu "Mã đơn" cho mỗi đơn hàng + action getDonHang để nhân viên
//   xem lại lịch sử đơn mình đã lập.
// - Mini-CRM: tab "Khách hàng" tự tạo, lưu lại khách đã đặt để gợi ý
//   tự động (autocomplete) ở lần lập đơn sau.
// ============================================================
var SHEET_ID = '1zDgFO7nYDc4t4WLtZkQWGZpv_kY9l3fezdRJ-od3VaQ';
var EMAIL_TO = 'linhikigai.cv.tts@gmail.com';
// Sheet riêng cho Tồn kho (chị điều phối) + Ảnh sản phẩm (nhân viên) — tách
// khỏi Sheet chính để 2 nhóm này không thấy được giá/khách hàng/đơn hàng.
var SHEET_ID_PHU = '1fu-8IglhU_akZTbjOw4bNXQLWIC1gNy_sOdvaeYs0O4';
var TAB_PHU = { tonkho: 'Tồn kho', anh: 'Ảnh sản phẩm' };

var TAB = {
  gach: '🧱 Gạch không Sale',
  ct1:  '🔥 CT1 - Sale tháng',
  ct2:  '📦 CT2 - Xả kho',
  ngoi: 'Bảng giá Ngói',
  keo:  'Bảng giá Keo',
  kinh: 'Bảng giá Kính',
  anh:  'Ảnh sản phẩm',
  don:  'Đơn hàng',
  users: 'Users',
  khachhang: 'Khách hàng',
  tonkhochitiet: 'TonKhoChiTiet',
  trongluong: 'TrongLuongSP'
};

function doGet(e) {
  var action = e.parameter.action || '';
  var cb     = e.parameter.callback || '';
  var result;
  try {
    if      (action === 'getGia')      result = getGia(e);
    else if (action === 'getCT')       result = getCT(e);
    else if (action === 'getImages')   result = getImages();
    else if (action === 'luuDon')      result = luuDon(e);
    else if (action === 'getTonKho')   result = getTonKho(e);
    else if (action === 'login')       result = login(e);
    else if (action === 'themUser')    result = themUser(e);
    else if (action === 'getDonHang')  result = getDonHang(e);
    else if (action === 'getKhachHang')result = getKhachHang();
    else if (action === 'listTabs')    result = listTabs();
    else if (action === 'getTonKhoChiTiet') result = getTonKhoChiTiet();
    else if (action === 'getTrongLuong')    result = getTrongLuong();
    else if (action === 'getThuocTinhSP')   result = getThuocTinhSP();
    else result = {status:'error', msg:'Unknown action: ' + action};
  } catch(err) {
    result = {status:'error', msg: err.toString()};
  }
  var json = JSON.stringify(result);
  var out  = cb ? cb + '(' + json + ')' : json;
  var mime = cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(out).setMimeType(mime);
}

// ── Helper ──────────────────────────────────────────────────
function pg(v) {
  if (v === null || v === undefined || v === '' || v === '–' || v === '-') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/\./g,'').replace(',','.')) || 0;
}
function openTab(name) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Không tìm thấy tab: ' + name);
  return sh;
}
function openTabPhu(name) {
  var ss = SpreadsheetApp.openById(SHEET_ID_PHU);
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Không tìm thấy tab "' + name + '" trong Sheet phụ (Tồn kho/Ảnh sản phẩm)');
  return sh;
}
function findHeaderRow(rows) {
  for (var i = 0; i < Math.min(rows.length, 5); i++) {
    var joined = rows[i].join('|');
    if (joined.indexOf('Mã') >= 0 || joined.indexOf('mã') >= 0) return i;
  }
  return 0;
}
// Bỏ dấu tiếng Việt + lowercase, chỉ giữ a-z0-9, dùng để so khớp tên cột
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
// Cảnh báo tối đa 1 email / 24h cho mỗi "key" để tránh spam hộp mail
function alertOnce(key, msg) {
  try {
    var props = PropertiesService.getScriptProperties();
    var last  = props.getProperty(key);
    var now   = Date.now();
    if (last && (now - Number(last)) < 24 * 3600 * 1000) return;
    props.setProperty(key, String(now));
    MailApp.sendEmail({ to: EMAIL_TO, subject: '⚠️ Cảnh báo cấu trúc Sheet đã đổi', body: msg });
  } catch (e) { /* không để lỗi gửi mail làm crash request chính */ }
}
// So khớp lỏng: kiểm tra header thực tế của tab có chứa các từ khóa kỳ vọng
// không. Nếu thiếu → có khả năng ai đó chèn/xóa/đổi tên cột → giá có thể
// đang đọc sai lệch âm thầm. KHÔNG đổi cách đọc dữ liệu (vẫn theo index cũ
// để không phá vỡ hành vi hiện tại) — chỉ cảnh báo sớm cho admin.
function checkHeaderDrift(rows, hi, expectedKeywords, tabName, alertKey) {
  var headerLine = norm(rows[hi].join('|'));
  var missing = [];
  expectedKeywords.forEach(function (kw) {
    if (headerLine.indexOf(norm(kw)) < 0) missing.push(kw);
  });
  if (missing.length) {
    var msg = 'Tab "' + tabName + '" có thể đã đổi cấu trúc cột.\n'
      + 'Không tìm thấy các tiêu đề mong đợi: ' + missing.join(', ') + '\n'
      + 'Header hiện tại: ' + rows[hi].join(' | ') + '\n\n'
      + 'Hãy kiểm tra lại Sheet — nếu cột bị chèn/xóa, giá hiển thị trên App có thể SAI.';
    Logger.log('⚠️ ' + msg);
    alertOnce(alertKey, msg);
  }
  return missing;
}

// ============================================================
// GET GIÁ: gach / ngoi / keo / kinh
// ?action=getGia&loai=gach|ngoi|keo|kinh&callback=cb
// ============================================================
function getGia(e) {
  var loai = (e.parameter.loai || 'gach').toLowerCase();
  if (loai === 'gach') return getGiGach();
  if (loai === 'ngoi') return getGiaNgoi();
  if (loai === 'keo')  return getGiaKeo();
  if (loai === 'kinh') return getGiaKinh();
  return {status:'error', msg:'loai không hợp lệ: ' + loai};
}

// GẠCH
// Cột Sheet: [0]Mã SAP [1]Mã SP [2]Kích cỡ [3]Loại [4]Danh mục
// [5]Giá lẻ [6]Giá ĐL Nhận kho [7]Giá ĐL Đi giao
// [8]Giá Sale NK [9]Giá Sale GH [10]%Margin NK [11]%Margin GH
// [12]Ghi chú [13]CT150 NK [14]CT150 GH [15]%Margin CT150
function getGiGach() {
  var sh   = openTab(TAB.gach);
  var rows = sh.getDataRange().getValues();
  var hi   = findHeaderRow(rows);
  checkHeaderDrift(rows, hi,
    ['Mã SP', 'Kích cỡ', 'Loại', 'Giá lẻ', 'Nhận kho', 'Đi giao'],
    TAB.gach, 'warn_gach');
  var data = [];
  for (var i = hi + 1; i < rows.length; i++) {
    var r  = rows[i];
    var ma = String(r[1] || '').trim();
    if (!ma || ma.length < 2) continue;
    var loai = String(r[3] || '').toLowerCase();
    var dm   = String(r[4] || '');
    data.push({
      ma:   ma,
      kc:   String(r[2] || ''),
      cat:  loai.indexOf('por') >= 0 ? 'porcelain' : 'ceramic',
      gio:  dm.indexOf('Chiến') >= 0 ? '★' : (dm || ''),
      le:   pg(r[5]),
      nhan: pg(r[6]),
      giao: pg(r[7]),
      ns:   pg(r[8]),   // Giá Sale Nhận kho
      gs:   pg(r[9]),   // Giá Sale Đi giao
      ct150nk: pg(r[17]), // Giá CT150 Nhận kho (cột R = index 17)
      ct150gh: pg(r[18])  // Giá CT150 Đi giao (cột S = index 18)
    });
  }
  return {status:'ok', loai:'gach', count:data.length, data:data};
}

// NGÓI
// Cột: [0]Mã SP [1]Tên [2]Kích cỡ [3]Đóng gói [4]Giá lẻ
// [5]NK<1500 [6]GH<1500 [7]NK≥1500 [8]GH≥1500 [9]Margin
function getGiaNgoi() {
  var sh   = openTab(TAB.ngoi);
  var rows = sh.getDataRange().getValues();
  var hi   = findHeaderRow(rows);
  checkHeaderDrift(rows, hi, ['Mã SP', 'Kích cỡ', 'Giá lẻ'], TAB.ngoi, 'warn_ngoi');
  var data = [];
  for (var i = hi + 1; i < rows.length; i++) {
    var r  = rows[i];
    var ma = String(r[0] || '').trim();
    if (!ma || ma.length < 2) continue;
    data.push({
      ma:       ma,
      ten:      String(r[1] || ''),
      kc:       String(r[2] || ''),
      dong_goi: String(r[3] || ''),
      le:    pg(r[4]),
      nhan:  pg(r[5]),   // NK < 1500
      giao:  pg(r[6]),   // GH < 1500
      nhan2: pg(r[7]),   // NK ≥ 1500
      giao2: pg(r[8])    // GH ≥ 1500
    });
  }
  return {status:'ok', loai:'ngoi', count:data.length, data:data};
}

// KEO
// Cột: [0]Mã SP [1]Tên [2]Quy cách [3]ĐV [4]Giá lẻ
// [5]NK<50 [6]GH<50 [7]NK≥50 [8]GH≥50 [9]Margin
function getGiaKeo() {
  var sh   = openTab(TAB.keo);
  var rows = sh.getDataRange().getValues();
  var hi   = findHeaderRow(rows);
  checkHeaderDrift(rows, hi, ['Mã SP', 'Giá lẻ'], TAB.keo, 'warn_keo');
  var data = [];
  for (var i = hi + 1; i < rows.length; i++) {
    var r  = rows[i];
    var ma = String(r[0] || '').trim();
    if (!ma || ma.length < 2) continue;
    data.push({
      ma:   ma,
      ten:  String(r[1] || ''),
      qc:   String(r[2] || ''),
      dv:   String(r[3] || 'bao'),
      le:    pg(r[4]),
      nhan:  pg(r[5]),
      giao:  pg(r[6]),
      nhan2: pg(r[7]),
      giao2: pg(r[8])
    });
  }
  return {status:'ok', loai:'keo', count:data.length, data:data};
}

// KÍNH
// Cột: [0]Mã SP [1]Tên [2]Kích cỡ [3]Đóng gói [4]Giá lẻ
// [5]NK≤20 [6]NK21-49 [7]NK≥50 [8]ĐV bán
function getGiaKinh() {
  var sh   = openTab(TAB.kinh);
  var rows = sh.getDataRange().getValues();
  var hi   = findHeaderRow(rows);
  checkHeaderDrift(rows, hi, ['Mã SP', 'Giá lẻ'], TAB.kinh, 'warn_kinh');
  var data = [];
  for (var i = hi + 1; i < rows.length; i++) {
    var r  = rows[i];
    var ma = String(r[0] || '').trim();
    if (!ma || ma.length < 2) continue;
    data.push({
      ma:    ma,
      ten:   String(r[1] || ''),
      kc:    String(r[2] || ''),
      dong_goi: String(r[3] || ''),
      le:    pg(r[4]),
      nhan:  pg(r[5]),
      nhan2: pg(r[6]),
      nhan3: pg(r[7]),
      dv:    String(r[8] || 'thùng')
    });
  }
  return {status:'ok', loai:'kinh', count:data.length, data:data};
}

// ============================================================
// GET CT1 / CT2
// ?action=getCT&loai=ct1|ct2&callback=cb
// Cột CT1/CT2: [0]Mã SAP [1]Mã SP [2]Tên NM [3]Ngành hàng
// [4]Kích cỡ [5]Chương trình [6]Giá lẻ
// [7]Giá ĐL Sale NK (có VAT) [8]Giá ĐL Sale GH (có VAT)
// [9]CT150 NK [10]CT150 GH [11]%Margin Sale [12]%Margin CT150
// ============================================================
function getCT(e) {
  var loai    = (e.parameter.loai || 'ct1').toLowerCase();
  var tabName = loai === 'ct1' ? TAB.ct1 : TAB.ct2;
  var sh      = openTab(tabName);
  var rows    = sh.getDataRange().getValues();
  var hi      = findHeaderRow(rows);
  checkHeaderDrift(rows, hi, ['Mã SP', 'Kích cỡ', 'Giá lẻ'], tabName, 'warn_' + loai);
  var data    = [];
  for (var i = hi + 1; i < rows.length; i++) {
    var r  = rows[i];
    var ma = String(r[1] || '').trim();
    if (!ma || ma.length < 2) continue;
    var cat = String(r[3] || '').toLowerCase();
    data.push({
      ma:    ma,
      tenNM: String(r[2] || ''),
      cat:   cat.indexOf('por') >= 0 ? 'porcelain' : 'ceramic',
      kc:    String(r[4] || ''),
      ct:    String(r[5] || ''),
      le:    pg(r[6]),
      // Giá sale đã có VAT (dùng cho tab Sale)
      nhan:  pg(r[7]),
      giao:  pg(r[8]),
      // CT150 = giá sale × 95%
      ct150nk: pg(r[9]),
      ct150gh: pg(r[10]),
      loai_sale: loai
    });
  }
  return {status:'ok', loai:loai, count:data.length, data:data};
}

// ============================================================
// GET IMAGES
// ============================================================
function getImages() {
  try {
    var sh = openTabPhu(TAB_PHU.anh);
    var rows = sh.getDataRange().getValues();
    var images = {}, imagesMulti = {};
    for (var i = 0; i < rows.length; i++) {
      var ma  = String(rows[i][0] || '').trim();
      var url = String(rows[i][2] || '').trim();
      if (!ma || !url || url.indexOf('http') < 0) continue;
      var m   = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
      var du  = m ? 'https://lh3.googleusercontent.com/d/' + m[1] : url;
      if (!images[ma]) images[ma] = du;
      if (!imagesMulti[ma]) imagesMulti[ma] = [];
      imagesMulti[ma].push(du);
    }
    return {status:'ok', images:images, imagesMulti:imagesMulti};
  } catch(err) {
    return {status:'ok', images:{}, imagesMulti:{}};
  }
}

// ============================================================
// ĐĂNG NHẬP – tab "Users" (PasswordHash = SHA-256, không lưu plaintext)
// Tab tự tạo + tự nạp 3 tài khoản cũ ở lần chạy đầu tiên, không cần
// chỉnh Sheet tay. Đổi mật khẩu: sửa trực tiếp ô PasswordHash bằng
// hàm sha256('mật khẩu mới') chạy thử trong Apps Script editor.
// ?action=login&username=...&password=...&callback=cb
// ============================================================
function sha256(str) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return raw.map(function (b) {
    b = (b < 0) ? b + 256 : b;
    return (b < 16 ? '0' : '') + b.toString(16);
  }).join('');
}
function ensureUsersTab() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(TAB.users);
  if (!sh) {
    sh = ss.insertSheet(TAB.users);
    sh.getRange(1, 1, 1, 4).setValues([['Username', 'PasswordHash', 'Name', 'Role']])
      .setFontWeight('bold').setBackground('#C0232A').setFontColor('#fff');
    sh.setFrozenRows(1);
    sh.appendRow(['linh',      sha256('Linh@2024'), 'Lê Chí Linh', 'admin']);
    sh.appendRow(['nhanvien1', sha256('NV1@2024'),  'Nhân viên 1', 'nv']);
    sh.appendRow(['nhanvien2', sha256('NV2@2024'),  'Nhân viên 2', 'nv']);
  }
  return sh;
}
function login(e) {
  var u  = String(e.parameter.username || '').trim().toLowerCase();
  var pw = String(e.parameter.password || '');
  if (!u || !pw) return {status:'error', msg:'Thiếu tài khoản hoặc mật khẩu'};
  var sh   = ensureUsersTab();
  var iGhiNho = ensureCol(sh, 'Mật khẩu (xem để nhớ)');
  var rows = sh.getDataRange().getValues();
  var hash = sha256(pw);
  // Đọc thêm cột thông tin khách hàng (Tên Công Ty, MST, Địa chỉ, Email, Tên
  // khách hàng) nếu Sheet có — dò theo TÊN cột, không bắt buộc đúng thứ tự.
  // QUAN TRỌNG: không dùng vị trí cột cứng (row[2], row[3]...) vì cột có thể
  // bị chèn/đổi vị trí (vd "Mật khẩu xem để nhớ" chèn giữa bảng) — luôn dò
  // theo TÊN cột cho TẤT CẢ field, kể cả Username/Name/Role/PasswordHash.
  var header = rows[0] || [];
  var idx = {};
  header.forEach(function (h, i) { idx[norm(h)] = i; });
  function col(name, fallback) { return idx[norm(name)] !== undefined ? idx[norm(name)] : fallback; }
  var iUser = col('Username', 0), iHash = col('PasswordHash', 1),
      iName = col('Name', 2),     iRole = col('Role', 3);
  var iCty = col('Tên Công Ty'), iMst = col('Mã số thuế'),
      iDc  = col('Địa chỉ'),     iEmail = col('Email'),
      iTenKH = col('Tên khách hàng'), iKhoPT = col('Kho phụ trách');

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (String(row[iUser] || '').trim().toLowerCase() === u) {
      // Ưu tiên so khớp trực tiếp với cột "Mật khẩu (xem để nhớ)" — cho phép
      // admin tự cấp tài khoản bằng cách gõ tay thẳng vào Sheet, không cần
      // qua màn "Quản lý tài khoản" trong app. Nếu cột đó trống (tài khoản
      // cũ chưa có), vẫn so khớp theo PasswordHash như trước để không phá
      // các tài khoản đã tạo qua app.
      var ghiNho = String(row[iGhiNho - 1] || '');
      var khopDung = ghiNho ? (ghiNho === pw) : (String(row[iHash] || '') === hash);
      if (khopDung) {
        // Tự đồng bộ PasswordHash khi đăng nhập bằng mật khẩu gõ tay trong
        // Sheet, để các action khác (nếu có) vẫn nhất quán.
        if (ghiNho && String(row[iHash] || '') !== hash) sh.getRange(i + 1, iHash + 1).setValue(hash);
        return {
          status: 'ok', name: row[iName] || u, role: row[iRole] || 'nv',
          tenCty: iCty   !== undefined ? String(row[iCty]   || '') : '',
          mst:    iMst   !== undefined ? String(row[iMst]   || '') : '',
          diaChi: iDc    !== undefined ? String(row[iDc]    || '') : '',
          email:  iEmail !== undefined ? String(row[iEmail] || '') : '',
          tenKH:  iTenKH !== undefined ? String(row[iTenKH] || '') : '',
          khoPhuTrach: iKhoPT !== undefined ? String(row[iKhoPT] || '') : ''
        };
      }
      return {status:'error', msg:'Sai tài khoản hoặc mật khẩu'};
    }
  }
  return {status:'error', msg:'Sai tài khoản hoặc mật khẩu'};
}

// Tìm cột theo tên header, tự tạo thêm cột mới ở cuối nếu chưa có.
function ensureCol(sh, ten) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var header  = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < header.length; i++) {
    if (norm(header[i]) === norm(ten)) return i + 1;
  }
  var newCol = lastCol + 1;
  sh.getRange(1, newCol).setValue(ten).setFontWeight('bold');
  return newCol;
}

// ============================================================
// THÊM / SỬA TÀI KHOẢN (admin dùng trong app, không cần đụng Sheet/Apps Script)
// ?action=themUser&username=...&password=...&name=...&role=...&callback=cb
// Nếu username đã tồn tại → cập nhật (đổi tên/role/mật khẩu mới nếu có nhập).
// Mật khẩu thật (chữ thường) cũng được lưu vào cột riêng "Mật khẩu (xem để
// nhớ)" để admin xem lại được — chỉ vì Sheet này riêng tư, chỉ admin truy cập.
// ============================================================
function themUser(e) {
  var u    = String(e.parameter.username || '').trim().toLowerCase();
  var pw   = String(e.parameter.password || '');
  var name = String(e.parameter.name || '').trim();
  var role = String(e.parameter.role || 'nv').trim();
  if (!u || !name) return {status:'error', msg:'Thiếu tài khoản hoặc tên hiển thị'};

  var sh      = ensureUsersTab();
  var iGhiNho = ensureCol(sh, 'Mật khẩu (xem để nhớ)');
  var rows    = sh.getDataRange().getValues();
  // Dò cột theo TÊN, không dùng vị trí cứng — cột có thể bị chèn/đổi vị trí.
  var header = rows[0] || [];
  var idx = {};
  header.forEach(function (h, i) { idx[norm(h)] = i; });
  function col(name2, fallback) { return idx[norm(name2)] !== undefined ? idx[norm(name2)] : fallback; }
  var iUser = col('Username', 0), iHash = col('PasswordHash', 1),
      iName = col('Name', 2),     iRole = col('Role', 3);

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][iUser] || '').trim().toLowerCase() === u) {
      // Đã có username → cập nhật. Chỉ đổi mật khẩu nếu có nhập mật khẩu mới.
      sh.getRange(i + 1, iName + 1).setValue(name);
      sh.getRange(i + 1, iRole + 1).setValue(role);
      if (pw) {
        sh.getRange(i + 1, iHash + 1).setValue(sha256(pw));
        sh.getRange(i + 1, iGhiNho).setValue(pw);
      }
      return {status:'ok', msg:'Đã cập nhật tài khoản "' + u + '"'};
    }
  }
  // Username mới → phải có mật khẩu. Ghi đúng theo vị trí cột đã xác định
  // (không appendRow theo thứ tự cố định, vì cột có thể đã bị xáo trộn).
  if (!pw) return {status:'error', msg:'Tài khoản mới phải nhập mật khẩu'};
  var newRow = sh.getLastRow() + 1;
  sh.getRange(newRow, iUser + 1).setValue(u);
  sh.getRange(newRow, iHash + 1).setValue(sha256(pw));
  sh.getRange(newRow, iName + 1).setValue(name);
  sh.getRange(newRow, iRole + 1).setValue(role);
  sh.getRange(newRow, iGhiNho).setValue(pw);
  return {status:'ok', msg:'Đã tạo tài khoản "' + u + '"'};
}

// ============================================================
// LƯU ĐƠN + GỬI EMAIL PDF
// ============================================================
function ensureDonHeader(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var header  = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (header.indexOf('Mã đơn') < 0) {
    sheet.insertColumnAfter(1);
    sheet.getRange(1, 2).setValue('Mã đơn')
      .setFontWeight('bold').setBackground('#C0232A').setFontColor('#fff');
  }
}
function luuDon(e) {
  var raw = e.parameter.data || '{}';
  var don;
  try { don = JSON.parse(raw); } catch(x) { return {status:'error', msg:'JSON lỗi'}; }

  var maDon = don.id || ('DH' + Date.now());

  // Lưu vào Sheet Đơn hàng
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(TAB.don);
    if (!sheet) {
      sheet = ss.insertSheet(TAB.don);
      sheet.getRange(1,1,1,12).setValues([[
        'STT','Mã đơn','Ngày','Người lập','Khách hàng','SĐT','Địa chỉ',
        'Mã SP','Kích cỡ','SL','ĐV','Thành tiền ĐL'
      ]]).setFontWeight('bold').setBackground('#C0232A').setFontColor('#fff');
      sheet.setFrozenRows(1);
    } else {
      ensureDonHeader(sheet);
    }
    var ngay  = don.ngay || new Date().toLocaleString('vi-VN');
    var items = don.items || [];
    var stt   = sheet.getLastRow();
    items.forEach(function(item, idx) {
      var thanh = (item.gia_nhan || 0) * (item.so_luong || 0);
      sheet.appendRow([
        stt + idx + 1, maDon, ngay,
        don.nguoi_lap || '', don.ten || '', don.sdt || '', don.diachi || '',
        item.ma || '', item.kc || '', item.so_luong || 0,
        item.unit || 'm²', thanh
      ]);
    });
  } catch(err) {
    Logger.log('Lỗi lưu Sheet: ' + err.toString());
  }

  // Lưu/cập nhật khách hàng (mini-CRM, dùng để autocomplete lần sau)
  try { upsertKhachHang(don); } catch(err) { Logger.log('Lỗi lưu khách hàng: ' + err.toString()); }

  // Gửi email
  try { guiEmail(don); } catch(err) { Logger.log('Lỗi email: ' + err.toString()); }

  return {status:'ok', msg:'Đã lưu ' + (don.items||[]).length + ' dòng', maDon: maDon};
}

function fmt(n) {
  if (!n || n === 0) return '–';
  return Number(n).toLocaleString('vi-VN') + 'đ';
}

function guiEmail(don) {
  var items  = don.items || [];
  var ngay   = don.ngay || new Date().toLocaleString('vi-VN');
  var ten    = don.ten || '';
  var tLe = 0, tNhan = 0;
  var rows = items.map(function(x, i) {
    var le   = (x.gia_le   || 0) * (x.so_luong || 0);
    var nhan = (x.gia_nhan || 0) * (x.so_luong || 0);
    tLe += le; tNhan += nhan;
    return '<tr><td>' + (i+1) + '</td><td><b>' + (x.ma||'') + '</b></td>'
      + '<td>' + (x.kc||'') + '</td><td>' + (x.so_luong||0) + ' ' + (x.unit||'m²') + '</td>'
      + '<td>' + fmt(x.gia_le) + '</td><td>' + fmt(le) + '</td>'
      + '<td>' + fmt(x.gia_nhan) + '</td><td>' + fmt(nhan) + '</td></tr>';
  }).join('');
  var margin = tLe - tNhan;
  var pct    = tLe > 0 ? Math.round(margin / tLe * 100) : 0;

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<style>body{font-family:Arial,sans-serif;font-size:13px;padding:20px}'
    + '.hd{background:#C0232A;color:#fff;padding:14px;border-radius:8px;margin-bottom:14px}'
    + '.hd h1{font-size:16px;margin:0 0 3px}.hd p{font-size:11px;margin:0;opacity:.85}'
    + '.info{background:#f5f5f5;border-radius:8px;padding:11px;margin-bottom:12px;font-size:12px}'
    + 'table{width:100%;border-collapse:collapse;font-size:12px}'
    + 'th{background:#C0232A;color:#fff;padding:7px;text-align:left}'
    + 'td{padding:6px 7px;border-bottom:1px solid #eee}tr:nth-child(even){background:#fafafa}'
    + '.tf td{font-weight:700;background:#FDECEA;border-top:2px solid #C0232A}'
    + '.mb{background:#E8F5E9;border:1.5px solid #4CAF50;border-radius:8px;padding:10px;text-align:center;margin:10px 0}'
    + '</style></head><body>'
    + '<div class="hd"><h1>📦 ĐƠN ĐẶT HÀNG – ĐỒNG TÂM KV23</h1>'
    + '<p>Người lập: ' + (don.nguoi_lap||'') + ' · ' + ngay + '</p></div>'
    + '<div class="info">'
    + '<p><b>Khách:</b> ' + ten + '</p>'
    + '<p><b>SĐT:</b> ' + (don.sdt||'') + '</p>'
    + (don.diachi ? '<p><b>Địa chỉ:</b> ' + don.diachi + '</p>' : '')
    + (don.ghichu ? '<p><b>Ghi chú:</b> ' + don.ghichu + '</p>' : '')
    + '</div>'
    + '<table><thead><tr><th>#</th><th>Mã SP</th><th>Kích cỡ</th><th>SL</th>'
    + '<th>Giá lẻ</th><th>T.Tiền lẻ</th><th>Giá ĐL NK</th><th>T.Tiền ĐL</th></tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '<tfoot><tr class="tf"><td colspan="5" align="right">TỔNG</td>'
    + '<td>' + fmt(tLe) + '</td><td></td><td>' + fmt(tNhan) + '</td></tr></tfoot></table>'
    + '<div class="mb"><p style="font-size:14px;font-weight:700;color:#1B5E20;margin:0">'
    + '💰 Lợi nhuận dự kiến: +' + fmt(margin) + ' (' + pct + '%)</p></div>'
    + '<p style="font-size:11px;color:#888;text-align:center">Lê Chí Linh · ĐT KV23 · 0819 548 908</p>'
    + '</body></html>';

  var pdf = Utilities.newBlob(html, 'text/html', 'don.html').getAs('application/pdf');
  pdf.setName('DonHang_' + ten + '_' + new Date().toLocaleDateString('vi-VN').replace(/\//g,'-') + '.pdf');

  MailApp.sendEmail({
    to: EMAIL_TO,
    subject: '📦 ĐẶT HÀNG – ' + ten + ' | ' + ngay,
    htmlBody: html,
    attachments: [pdf]
  });
}

// ============================================================
// LỊCH SỬ ĐƠN HÀNG
// ?action=getDonHang&username=...&role=admin|nv&callback=cb
// Nhân viên (role=nv) chỉ thấy đơn do chính mình lập; admin thấy tất cả.
// ============================================================
function getDonHang(e) {
  var username = String(e.parameter.username || '').trim();
  var role     = String(e.parameter.role || 'nv');
  var sh       = openTab(TAB.don);
  var rows     = sh.getDataRange().getValues();
  if (rows.length < 2) return {status:'ok', count:0, data:[]};

  var header = rows[0];
  var idx = {};
  header.forEach(function (h, i) { idx[String(h).trim()] = i; });

  var orders = {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var nguoiLap = String(r[idx['Người lập']] || '');
    if (role !== 'admin' && nguoiLap !== username) continue;
    var maDon = String(idx['Mã đơn'] !== undefined ? (r[idx['Mã đơn']] || '') : '');
    if (!maDon) maDon = String(r[idx['STT']] || i);
    if (!orders[maDon]) {
      orders[maDon] = {
        maDon: maDon,
        ngay: r[idx['Ngày']] || '',
        nguoiLap: nguoiLap,
        khach: r[idx['Khách hàng']] || '',
        sdt: r[idx['SĐT']] || '',
        diachi: r[idx['Địa chỉ']] || '',
        items: []
      };
    }
    orders[maDon].items.push({
      ma: r[idx['Mã SP']] || '',
      kc: r[idx['Kích cỡ']] || '',
      sl: r[idx['SL']] || 0,
      dv: r[idx['ĐV']] || '',
      thanh: r[idx['Thành tiền ĐL']] || 0
    });
  }

  var list = Object.keys(orders).map(function (k) { return orders[k]; });
  list.sort(function (a, b) { return (a.maDon < b.maDon) ? 1 : -1; }); // mới nhất trước
  return {status:'ok', count:list.length, data:list.slice(0, 50)};
}

// ============================================================
// MINI-CRM: KHÁCH HÀNG
// ?action=getKhachHang&callback=cb
// ============================================================
function ensureKhachHangTab() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(TAB.khachhang);
  if (!sh) {
    sh = ss.insertSheet(TAB.khachhang);
    sh.getRange(1, 1, 1, 4).setValues([['SĐT', 'Tên khách', 'Địa chỉ', 'Lần cuối đặt']])
      .setFontWeight('bold').setBackground('#C0232A').setFontColor('#fff');
    sh.setFrozenRows(1);
  }
  return sh;
}
function upsertKhachHang(don) {
  var sdt = String(don.sdt || '').trim();
  if (!sdt) return;
  var sh   = ensureKhachHangTab();
  var rows = sh.getDataRange().getValues();
  var ngay = don.ngay || new Date().toLocaleString('vi-VN');
  var found = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === sdt) { found = i; break; }
  }
  if (found >= 0) {
    sh.getRange(found + 1, 2, 1, 3).setValues([[
      don.ten || rows[found][1], don.diachi || rows[found][2], ngay
    ]]);
  } else {
    sh.appendRow([sdt, don.ten || '', don.diachi || '', ngay]);
  }
}
function getKhachHang() {
  try {
    var sh   = ensureKhachHangTab();
    var rows = sh.getDataRange().getValues();
    var data = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0]) continue;
      data.push({ sdt: String(r[0]), ten: String(r[1] || ''), diachi: String(r[2] || '') });
    }
    return {status:'ok', count:data.length, data:data};
  } catch (err) {
    return {status:'ok', count:0, data:[]};
  }
}

// ============================================================
// GET TỒN KHO
// ?action=getTonKho&callback=cb
// Đọc sheet Tổng hợp, lấy cột:
// [5]Mã App [20]Tình trạng [21]Khả dụng(TH) [22]Có sẵn(TH) [23]Số kho [24]Còn hàng?
// ============================================================
function getTonKho(e) {
  try {
    var sh   = openTab('Tổng hợp');
    var rows = sh.getDataRange().getValues();

    checkHeaderDrift(rows, 0,
      ['Tên báo giá App', 'Tình trạng', 'Khả dụng', 'Có sẵn', 'Còn hàng'],
      'Tổng hợp', 'warn_tonghop');

    // Header ở row 0, data bắt đầu từ row 1
    // Columns (0-based) theo file Excel thực tế:
    // [0]Ngành hàng [1]Qui cách [2]Mã SAP [3]Tên SP NM [4]Tên SP(Mã Sap)
    // [5]Tên báo giá App ← MÃ SP DÙNG TRONG APP
    // [6]Men [7]Giỏ hàng [8]Loại giá [9]Giá lẻ [10]Giá ĐL NK [11]Giá ĐL GH
    // [12]Giá Sale NK [13]Giá Sale GH [14]%Margin NK [15]%Margin GH [16]Ghi chú
    // [17]Giá CT150 NK [18]Giá CT150 GH [19]%Margin CT150
    // [20]Tình trạng [21]Khả dụng(TH) [22]Có sẵn(TH) [23]Số kho [24]Còn hàng?

    var data = {};
    for (var r = 1; r < rows.length; r++) {  // Bỏ qua header row 0
      var row = rows[r];
      var ma = String(row[5] || '').trim();   // [5] = Tên báo giá App
      if (!ma || ma.length < 2 || ma === '-') continue;

      var tt           = String(row[20] || '').trim();  // Tình trạng
      var vienKD       = parseFloat(String(row[21] || '0').replace(/[^0-9.,]/g,'').replace(/\./g,'').replace(',','.')) || 0;  // Khả dụng (viên)
      var vienCS       = parseFloat(String(row[22] || '0').replace(/[^0-9.,]/g,'').replace(/\./g,'').replace(',','.')) || 0;  // Có sẵn (viên)
      var vienPerThung = parseFloat(String(row[23] || '0').replace(/[^0-9.,]/g,'').replace(/\./g,'').replace(',','.')) || 1;  // Số kho (viên/thùng)
      var con          = String(row[24] || '').trim();  // Còn hàng?

      // Tính thùng = viên / viên_per_thùng
      var thungKD = vienPerThung > 0 ? Math.floor(vienKD / vienPerThung) : 0;
      var thungCS = vienPerThung > 0 ? Math.floor(vienCS / vienPerThung) : 0;

      data[ma] = {
        ma:          ma,
        tinh_trang:  tt,
        kha_dung:    thungKD,
        co_san:      thungCS,
        vien_kd:     vienKD,
        so_kho:      vienPerThung,
        con_hang:    con    // "Còn" hoặc "Hết"
      };
    }
    return { status: 'ok', count: Object.keys(data).length, data: data };
  } catch(err) {
    return { status: 'error', msg: err.toString() };
  }
}

// ============================================================
// TỒN KHO CHI TIẾT THEO KHO + SỐ LÔ
// ?action=getTonKhoChiTiet&callback=cb
//
// Đọc tab "TonKhoChiTiet" (dán tay từ file Excel tồn kho công ty xuất ra).
// Cột cần có (theo đúng tên header của file Excel gốc, không cần đúng thứ
// tự — code tự dò theo TÊN cột):
//   Kho | Mã SP | Tên SP | Màu | Số lô | ĐVT | Khả dụng | Tên báo giá
// ("Tên báo giá" = mã dùng trong App, giống cách tab "Tổng hợp" đang map).
//
// Phân loại tốc độ giao theo TÊN KHO (3 mức, theo thực tế kinh doanh —
// KHÔNG dùng cột "Mức ưu tiên" có sẵn trong file vì file gốc chỉ chia 2
// nhóm, không đủ chi tiết):
//   "nhanh" (giao ngay)   : Tân Kiên, Bình Dương
//   "mai"   (chuyển hôm nay, mai có hàng) : Long An, Bến Lức, BMP, Dotalia
//   "cho15" (chờ 15 ngày) : tất cả kho còn lại
// ============================================================
var TIER_NHANH = ['tankien', 'binhduong'];
var TIER_MAI   = ['longan', 'benluc', 'bmp', 'dotalia', 'thuongmaihq'];

function tierKho(tenKho) {
  var n = norm(tenKho);
  for (var i = 0; i < TIER_NHANH.length; i++) if (n.indexOf(TIER_NHANH[i]) >= 0) return 'nhanh';
  for (var i = 0; i < TIER_MAI.length; i++)   if (n.indexOf(TIER_MAI[i]) >= 0)   return 'mai';
  return 'cho15';
}

// Nối Material Number (mã SAP, cột "Mã SAP" cột A) ↔ mã dùng trong App (cột
// "Mã SP" cột B) — lấy từ các tab giá đã có sẵn 2 cột này trong Sheet chính.
// Nhờ vậy chị điều phối chỉ cần paste đúng bản thô từ ERP (Plant, Name 1,
// Material Number...), không cần biết/đụng gì tới mã App hay mapping.
function buildSapToAppMap() {
  var map = {};
  [TAB.gach, TAB.ct1, TAB.ct2].forEach(function (tabName) {
    try {
      var sh   = openTab(tabName);
      var rows = sh.getDataRange().getValues();
      var hi   = findHeaderRow(rows);
      for (var i = hi + 1; i < rows.length; i++) {
        var sap = String(rows[i][0] || '').trim();
        var ma  = String(rows[i][1] || '').trim();
        if (sap && ma && !map[sap]) map[sap] = ma;
      }
    } catch (e) { /* tab lỗi thì bỏ qua, không chặn toàn bộ tồn kho */ }
  });
  return map;
}

function getTonKhoChiTiet() {
  try {
    var sh   = openTabPhu(TAB_PHU.tonkho);
    var rows = sh.getDataRange().getValues();
    if (rows.length < 2) return { status: 'ok', count: 0, data: {} };

    var header = rows[0];
    var idx = {};
    header.forEach(function (h, i) { idx[norm(h)] = i; });
    function col(name) { return idx[norm(name)]; }

    // Đúng tên cột bản thô xuất từ ERP (chị điều phối paste y nguyên, không
    // chỉnh sửa gì) — KHÔNG có sẵn mã App, phải tự map qua Material Number.
    var iKho     = col('Name 1');
    var iMaSAP   = col('Material Number');
    var iSoLo    = col('Batch');
    var iMau     = col('Màu');
    var iKD      = col('Khả dụng');
    var iDvt     = col('Base Unit of Measure');

    if (iKho === undefined || iMaSAP === undefined || iKD === undefined) {
      return { status: 'error', msg: 'Tab "Tồn kho" thiếu cột Name 1 / Material Number / Khả dụng — kiểm tra lại chị điều phối có paste đúng bản gốc không.' };
    }

    var sapToApp = buildSapToAppMap();
    var data = {};
    for (var r = 1; r < rows.length; r++) {
      var row  = rows[r];
      var sap  = String(row[iMaSAP] || '').trim();
      if (!sap) continue;
      var ma = sapToApp[sap];
      if (!ma) continue; // mã không bán qua app (phụ kiện, mũi cọc...) → bỏ qua
      var kd = parseFloat(String(row[iKD] || '0').replace(/[^0-9.\-]/g, '')) || 0;
      if (kd <= 0) continue;

      var kho  = String(row[iKho] || '').trim();
      var solo = iSoLo !== undefined ? String(row[iSoLo] || '').trim() : '';
      var mau  = iMau  !== undefined ? String(row[iMau]  || '').trim() : '';
      var dvt  = iDvt  !== undefined ? String(row[iDvt]  || '').trim() : '';
      // Chuẩn hóa đơn vị: "TH" trong file gốc = Thùng
      dvt = (dvt.toUpperCase() === 'TH' || !dvt) ? 'thùng' : dvt;
      var tier = tierKho(kho);

      if (!data[ma]) data[ma] = { tong: 0, dvt: dvt, tier: { nhanh: 0, mai: 0, cho15: 0 }, kho: {} };
      data[ma].tong += kd;
      data[ma].tier[tier] += kd;
      if (!data[ma].kho[kho]) data[ma].kho[kho] = { tier: tier, tong: 0, lo: [] };
      data[ma].kho[kho].tong += kd;
      data[ma].kho[kho].lo.push({ so_lo: solo, sl: kd, mau: mau });
    }

    var tierOrder = { nhanh: 0, mai: 1, cho15: 2 };
    Object.keys(data).forEach(function (ma) {
      var khoArr = Object.keys(data[ma].kho).map(function (k) {
        var o = data[ma].kho[k]; o.ten = k; return o;
      });
      khoArr.sort(function (a, b) {
        if (tierOrder[a.tier] !== tierOrder[b.tier]) return tierOrder[a.tier] - tierOrder[b.tier];
        return b.tong - a.tong;
      });
      khoArr.forEach(function (k) { k.lo.sort(function (a, b) { return b.sl - a.sl; }); });
      data[ma].kho = khoArr;
    });

    return { status: 'ok', count: Object.keys(data).length, data: data };
  } catch (err) {
    return { status: 'error', msg: err.toString() };
  }
}

// ============================================================
// TRỌNG LƯỢNG CHÍNH XÁC THEO MÃ SAP
// ?action=getTrongLuong&callback=cb
//
// Đọc tab "TrongLuongSP" (dán tay từ file "DANH MỤC MÃ HÀNG" — sheet
// DATA_WEB). Cột cần có (dò theo TÊN cột, không cần đúng thứ tự):
//   Mã hàng | Tên báo giá App | Tên SP | KL tịnh (kg) | KL tổng (kg) | ĐVT
// "Tên báo giá App" = mã dùng trong App. "KL tổng (kg)" = kg/viên (gồm bao
// bì) — dùng số này để tính kg thật của 1 viên khi lên đơn, vì khách cần
// số kg chính xác để thuê xe vận chuyển.
// ============================================================
function getTrongLuong() {
  try {
    var sh   = openTab(TAB.trongluong);
    var rows = sh.getDataRange().getValues();
    if (rows.length < 2) return { status: 'ok', count: 0, data: {} };

    var header = rows[0];
    var idx = {};
    header.forEach(function (h, i) { idx[norm(h)] = i; });
    function col(name) { return idx[norm(name)]; }

    var iMaApp  = col('Tên báo giá App');
    var iKgTinh = col('KL tịnh (kg)');
    var iKgTong = col('KL tổng (kg)');
    var iDvt    = col('ĐVT');

    if (iMaApp === undefined || iKgTong === undefined) {
      return { status: 'error', msg: 'Tab "TrongLuongSP" thiếu cột "Tên báo giá App" hoặc "KL tổng (kg)" — kiểm tra lại tên cột.' };
    }

    var data = {};
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var ma  = String(row[iMaApp] || '').trim();
      if (!ma) continue;
      var kgTong = parseFloat(String(row[iKgTong] || '0').replace(',', '.')) || 0;
      if (kgTong <= 0) continue;
      var kgTinh = iKgTinh !== undefined ? (parseFloat(String(row[iKgTinh] || '0').replace(',', '.')) || 0) : 0;
      var dvt    = iDvt !== undefined ? String(row[iDvt] || '').trim() : '';
      data[ma] = { kg_tinh: kgTinh, kg_tong: kgTong, dvt: dvt };
    }
    return { status: 'ok', count: Object.keys(data).length, data: data };
  } catch (err) {
    return { status: 'error', msg: err.toString() };
  }
}

// ============================================================
// LIỆT KÊ TÊN TẤT CẢ TAB TRONG SHEET — dùng để chẩn đoán khi đổi tên tab
// làm các action khác báo "Không tìm thấy tab".
// ?action=listTabs&callback=cb
// ============================================================
function listTabs() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var names = ss.getSheets().map(function (s) { return s.getName(); });
  return { status: 'ok', tabs: names };
}

// ============================================================
// THUỘC TÍNH SẢN PHẨM (Màu, Công năng, Tính năng, Hoa văn, Men)
// Đọc tab "Tổng hợp" trong Sheet chính, map theo "Tên báo giá App".
// Dùng cho tính năng lọc nâng cao ở tab Gạch + Sale.
// ?action=getThuocTinhSP&callback=cb
// ============================================================
function getThuocTinhSP() {
  try {
    var sh   = openTab('Tổng hợp');
    var rows = sh.getDataRange().getValues();
    if (rows.length < 2) return { status: 'ok', count: 0, data: {} };

    // Tab "Tổng hợp" có 2 dòng đầu là banner tiêu đề lớn, KHÔNG phải tên cột
    // thật — phải dò đúng dòng chứa tên cột (chứa chữ "Mã") bằng findHeaderRow,
    // không lấy thẳng rows[0] như các tab giá khác.
    var hi = findHeaderRow(rows);
    var header = rows[hi];
    var idx = {};
    header.forEach(function (h, i) { idx[norm(h)] = i; });
    function col(name) { return idx[norm(name)]; }

    var iMaApp = col('Tên báo giá App');
    var iMau = col('Màu'), iCongNang = col('Công năng'),
        iTinhNang = col('Tính năng'), iHoaVan = col('Hoa văn'), iMen = col('Men');

    if (iMaApp === undefined) {
      return { status: 'error', msg: 'Tab "Tổng hợp" thiếu cột "Tên báo giá App". Header dò được: ' + header.join(' | ') };
    }

    var data = {};
    for (var r = hi + 1; r < rows.length; r++) {
      var row = rows[r];
      var ma = String(row[iMaApp] || '').trim();
      if (!ma || data[ma]) continue;
      var mau = iMau !== undefined ? String(row[iMau] || '').trim() : '';
      var congNang = iCongNang !== undefined ? String(row[iCongNang] || '').trim() : '';
      var tinhNang = iTinhNang !== undefined ? String(row[iTinhNang] || '').trim() : '';
      var hoaVan = iHoaVan !== undefined ? String(row[iHoaVan] || '').trim() : '';
      var men = iMen !== undefined ? String(row[iMen] || '').trim() : '';
      if (!mau && !congNang && !tinhNang && !hoaVan && !men) continue;
      data[ma] = { mau: mau, congNang: congNang, tinhNang: tinhNang, hoaVan: hoaVan, men: men };
    }
    return { status: 'ok', count: Object.keys(data).length, data: data };
  } catch (err) {
    return { status: 'error', msg: err.toString() };
  }
}
