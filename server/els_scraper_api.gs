/**
 * ELS Scraper API - Google Apps Script
 * 이 파일은 els_kiwoom_scraper.py, els_meritz_scraper.py, els_samsung_scraper.py
 * 스크립트 전용 GAS 백엔드입니다. (대시보드와 분리됨)
 */

var SPREADSHEET_ID = '1g1VBYupYjmkiF-85CXgjFvu4qzzSjtKTLGgXYNIhKQM';

var ELS_LIST_SHEET_NAME_ = 'ELS목록';
var ELS_PENDING_STATUS_ = '청약 중(대기)';
var ELS_LIVE_STATUS_ = '투자 중';

function doGet(e) {
  var api = e && e.parameter && e.parameter.api != null ? String(e.parameter.api).trim() : '';
  try {
    if (api === 'els_pending') {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var items = getElsPendingRowsWithIndex_(ss);
      return jsonResponse_({ success: true, items: items });
    }
    return jsonResponse_({ success: false, error: 'Unknown API endpoint' });
  } catch (err) {
    var message = err && err.message ? String(err.message) : String(err);
    return jsonResponse_({ success: false, error: message });
  }
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents != null ? String(e.postData.contents).trim() : '';
    if (!raw) {
      return jsonResponse_({ success: false, error: '요청 본문이 비어 있습니다.' });
    }
    var body;
    try {
      body = JSON.parse(raw);
    } catch (parseErr) {
      return jsonResponse_({ success: false, error: 'JSON 파싱에 실패했습니다.' });
    }
    if (!body || typeof body !== 'object') {
      return jsonResponse_({ success: false, error: '유효한 JSON 객체가 아닙니다.' });
    }

    var action = body.action != null ? String(body.action).trim().toLowerCase() : '';
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    if (action === 'update') {
      handleElsUpdate_(ss, body);
      return jsonResponse_({ success: true, message: '행이 업데이트되었습니다.' });
    }

    return jsonResponse_({ success: false, error: '알 수 없는 action: ' + body.action });
  } catch (err) {
    var msg = err && err.message ? String(err.message) : String(err);
    return jsonResponse_({ success: false, error: msg });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getElsSheetOrThrow_(ss) {
  var sheet = ss.getSheetByName(ELS_LIST_SHEET_NAME_);
  if (!sheet) {
    throw new Error('ELS목록 시트를 찾을 수 없습니다.');
  }
  return sheet;
}

function normalizeHeaderKey_(s) {
  return String(s || '')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, '')
    .replace(/_/g, '')
    .toLowerCase();
}

function buildHeaderColumnMaps_(headerRow) {
  var exact = {};
  var norm = {};
  for (var c = 0; c < headerRow.length; c++) {
    var h = headerRow[c] != null ? String(headerRow[c]).trim() : '';
    if (!h) continue;
    var col = c + 1;
    if (exact[h] == null) exact[h] = col;
    var nk = normalizeHeaderKey_(h);
    if (nk && norm[nk] == null) norm[nk] = col;
  }
  return { exact: exact, norm: norm };
}

function resolveColumnForKey_(maps, key) {
  if (key == null || key === '') return null;
  var k = String(key).trim();
  if (maps.exact[k] != null) return maps.exact[k];
  var nk = normalizeHeaderKey_(k);
  if (nk && maps.norm[nk] != null) return maps.norm[nk];
  return null;
}

function findStatusColumn_(maps) {
  var c =
    maps.exact['상태'] ||
    maps.norm[normalizeHeaderKey_('상태')] ||
    maps.exact['status'] ||
    maps.norm['status'];
  return c != null ? c : null;
}

function isEmptyValue_(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function getElsPendingRowsWithIndex_(ss) {
  var sheet = getElsSheetOrThrow_(ss);
  if (sheet.getLastRow() < 2) return [];

  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var statusCol = findStatusColumn_(buildHeaderColumnMaps_(headerRow));
  if (statusCol == null) {
    throw new Error('ELS목록 1행에「상태」열이 없습니다.');
  }

  var lastRow = sheet.getLastRow();
  var rows = sheet.getRange(2, 1, lastRow, lastCol).getValues();
  var out = [];

  for (var r = 0; r < rows.length; r++) {
    var sheetRow = r + 2;
    var statusVal = rows[r][statusCol - 1];
    var st = statusVal != null ? String(statusVal).trim() : '';
    if (st !== ELS_PENDING_STATUS_) continue;

    var obj = { row_index: sheetRow };
    for (var c = 0; c < headerRow.length; c++) {
      var name = headerRow[c] != null ? String(headerRow[c]).trim() : '';
      if (!name) continue;
      var v = rows[r][c];
      obj[name] = v === '' ? null : v;
    }
    out.push(obj);
  }
  return out;
}

function handleElsUpdate_(ss, body) {
  var rowIndex = body.row_index != null ? Number(body.row_index) : NaN;
  if (!isFinite(rowIndex) || rowIndex < 2 || Math.floor(rowIndex) !== rowIndex) {
    throw new Error('유효한 row_index(정수, 2 이상)가 필요합니다.');
  }

  var sheet = getElsSheetOrThrow_(ss);
  var lastRow = sheet.getLastRow();
  if (rowIndex > lastRow) {
    throw new Error('row_index가 시트 범위를 벗어났습니다.');
  }

  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) throw new Error('ELS목록에 헤더 행이 없습니다.');

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var maps = buildHeaderColumnMaps_(headerRow);

  var keys = Object.keys(body);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key === 'action' || key === 'row_index') continue;
    var val = body[key];
    if (isEmptyValue_(val)) continue;

    var col = resolveColumnForKey_(maps, key);
    if (col == null) continue;

    sheet.getRange(rowIndex, col).setValue(val);
  }

  var statusCol = findStatusColumn_(maps);
  if (statusCol == null) {
    throw new Error('「상태」열을 찾을 수 없어 투자 중으로 바꿀 수 없습니다.');
  }
  sheet.getRange(rowIndex, statusCol).setValue(ELS_LIVE_STATUS_);
}
