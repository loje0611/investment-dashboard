/**
 * Investment Dashboard - Google Apps Script
 * 스프레드시트에서 데이터를 읽어 웹 대시보드용 JSON을 반환합니다.
 *
 * 중요: 웹 앱 URL로 호출될 때는 '열린 시트'가 없으므로
 * 스프레드시트 ID로 openById()를 사용해야 합니다.
 * 아래 SPREADSHEET_ID를 본인 스프레드시트 ID로 변경하세요.
 * (URL의 /d/ 다음 부분: docs.google.com/spreadsheets/d/【여기】/edit)
 *
 * 사용 시트 이름 (하단 탭과 정확히 일치해야 함):
 *   - totalAssets  → "총자산"
 *   - portfolio   → "포트(New)"
 *   - rebalancing → "포트_API" (1행=헤더, 계좌명 기준 계좌별 그룹)
 *   - etf         → "ETF" (ETF 현황 탭 전용)
 *   - pension     → "연금" (연금 현황 탭 전용)
 *   - els            → "ELS(투자중)" (상세·리스크·탭 목록)
 *   - elsSheetTotals → "ELS" 시트 고정 셀 B4(투자원금)·C4(평가금액) — 홈 카드「ELS 투자 평가」전용
 *   - elsCompleted   → "ELS(완료)" (상환 완료: 수익·투자기간 등)
 *   - cashOther      → "현금" (기타 평가금)
 *   - ELS 목록 API   → 본 파일 doGet (?api=els_pending), doPost (action create/update)
 *
 * 반환 형식: { totalAssets, portfolio, rebalancing, etf, pension, els, elsSheetTotals, elsCompleted, cashOther }
 */
// 배포 전 본인 스프레드시트 ID로 변경하세요. (URL의 /d/ 다음 부분)
var SPREADSHEET_ID = '1g1VBYupYjmkiF-85CXgjFvu4qzzSjtKTLGgXYNIhKQM';

// ----- 웹앱 진입점 · ELS목록 API (React / Python 공용) -----

/**
 * GET  ?api=els_pending  → 상태「청약 중(대기)」행만 + row_index
 * GET  (그 외)           → 아래 getDashboardData (data 파라미터 동일)
 *
 * POST JSON action:
 *   create (또는 생략) → 신규 행, 상태「청약 중(대기)」
 *   update            → row_index 행 헤더 매핑으로 셀 갱신(빈 값 스킵), 상태「투자 중」
 *   redeem            → 상환 처리: 상태「상환완료」, 상환일·상환금액·투자기간·연수익률·수익 기록
 *
 * 크롤러(update) 권장 헤더: 수익률, 발행일, 낙인, 조기상환조건 1~12차, 티커 1~3, 기준가 1~3,
 * 조기상환평가일 1~12차 (1행 헤더와 body 키는 공백·_ 정규화로 매칭)
 *
 * CORS: ContentService 는 Access-Control-Allow-Origin 등 사용자 정의 HTTP 헤더를 붙일 수 없음.
 */

var ELS_LIST_SHEET_NAME_ = 'ELS목록';
var ELS_PENDING_STATUS_ = '청약 중(대기)';
var ELS_LIVE_STATUS_ = '투자 중';
var ELS_REDEEMED_STATUS_ = '상환완료';

/** 빈 시트일 때만 넣는 최소 헤더 */
var ELS_LIST_MIN_HEADERS_ = ['증권사', '상품회차', '가입금액', '발행일', '상태', '가입일'];

var ELS_REGISTER_BROKERS_ = {
  삼성증권: true,
  키움증권: true,
  미래에셋증권: true,
  KB증권: true,
  메리츠증권: true,
};

function doGet(e) {
  var api = e && e.parameter && e.parameter.api != null ? String(e.parameter.api).trim() : '';
  try {
    if (api === 'els_pending') {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var items = getElsPendingRowsWithIndex_(ss);
      return jsonResponse_({ success: true, items: items });
    }
    var param =
      e && e.parameter && e.parameter.data ? String(e.parameter.data).toLowerCase() : 'all';
    var data = getDashboardData(param);
    return jsonResponse_(data);
  } catch (err) {
    var message = err && err.message ? String(err.message) : String(err);
    if (api === 'els_pending') {
      return jsonResponse_({ success: false, error: message });
    }
    return jsonResponse_({ error: message });
  }
}

function doPost(e) {
  try {
    var raw =
      e && e.postData && e.postData.contents != null ? String(e.postData.contents).trim() : '';
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

    if (action === 'redeem') {
      handleElsRedeem_(ss, body);
      return jsonResponse_({ success: true, message: '상환 처리되었습니다.' });
    }

    if (action === '' || action === 'create') {
      handleElsCreate_(ss, body);
      return jsonResponse_({ success: true, message: '등록되었습니다.' });
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

function ensureElsMinimalHeaderRow_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, ELS_LIST_MIN_HEADERS_.length).setValues([ELS_LIST_MIN_HEADERS_]);
    return;
  }
  var a1 = sheet.getRange(1, 1).getValue();
  if (a1 == null || String(a1).trim() === '') {
    sheet.getRange(1, 1, 1, ELS_LIST_MIN_HEADERS_.length).setValues([ELS_LIST_MIN_HEADERS_]);
  }
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


function handleElsCreate_(ss, body) {
  var check = validateElsCreatePayload_(body);
  if (!check.ok) throw new Error(check.error);

  var sheet = getElsSheetOrThrow_(ss);
  ensureElsMinimalHeaderRow_(sheet);

  var lastCol = Math.max(sheet.getLastColumn(), ELS_LIST_MIN_HEADERS_.length);
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var maps = buildHeaderColumnMaps_(headerRow);

  function requireCol(label) {
    var col = resolveColumnForKey_(maps, label);
    if (col == null) {
      throw new Error('ELS목록 1행에「' + label + '」열이 필요합니다.');
    }
    return col;
  }

  var row = [];
  for (var i = 0; i < lastCol; i++) row.push('');

  row[requireCol('증권사') - 1] = check.brokerage;
  row[requireCol('상품회차') - 1] = check.productRound;
  row[requireCol('가입금액') - 1] = check.amount;

  var tz = Session.getScriptTimeZone() || 'Asia/Seoul';
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  row[requireCol('가입일') - 1] = today;

  row[requireCol('상태') - 1] = ELS_PENDING_STATUS_;

  var issueCol = resolveColumnForKey_(maps, '발행일');
  if (issueCol != null && check.issueDate) {
    row[issueCol - 1] = check.issueDate;
  }

  sheet.appendRow(row);
}

function validateElsCreatePayload_(body) {
  var brokerage =
    body.brokerage != null
      ? String(body.brokerage).trim()
      : body['증권사'] != null
        ? String(body['증권사']).trim()
        : '';
  if (!brokerage || !ELS_REGISTER_BROKERS_[brokerage]) {
    return { ok: false, error: '유효한 증권사를 선택해 주세요.' };
  }
  var roundRaw = body.productRound != null ? body.productRound : body['상품회차'];
  var productRound = Number(roundRaw);
  if (!isFinite(productRound) || productRound <= 0 || Math.floor(productRound) !== productRound) {
    return { ok: false, error: '상품회차는 양의 정수여야 합니다.' };
  }
  var amountRaw = body.amount != null ? body.amount : body['가입금액'];
  var amount = Number(amountRaw);
  if (!isFinite(amount) || amount <= 0) {
    return { ok: false, error: '가입금액은 0보다 큰 숫자여야 합니다.' };
  }
  var issueRaw =
    body.issueDate != null
      ? String(body.issueDate).trim()
      : body['발행일'] != null
        ? String(body['발행일']).trim()
        : '';
  var issueDate = issueRaw || null;
  return { ok: true, brokerage: brokerage, productRound: productRound, amount: amount, issueDate: issueDate };
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

function parseYmdDateGas_(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    var y = Number(m[1]);
    var mo = Number(m[2]) - 1;
    var d = Number(m[3]);
    var dt = new Date(y, mo, d);
    if (dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) return dt;
  }
  return null;
}

function investmentDaysBetween_(start, end) {
  var ms = end.getTime() - start.getTime();
  var days = Math.round(ms / (24 * 60 * 60 * 1000));
  return days < 1 ? 1 : days;
}

/**
 * ELS 상환: 상태·상환일·상환금액·투자기간·연수익률(연복리 환산 %)·수익(상환−가입)
 * body: row_index, 상환일(yyyy-MM-dd), 상환금액(숫자)
 */
function handleElsRedeem_(ss, body) {
  var rowIndex = body.row_index != null ? Number(body.row_index) : NaN;
  if (!isFinite(rowIndex) || rowIndex < 2 || Math.floor(rowIndex) !== rowIndex) {
    throw new Error('유효한 row_index(정수, 2 이상)가 필요합니다.');
  }

  var redeemDateStr =
    body['상환일'] != null
      ? String(body['상환일']).trim()
      : body.redeemDate != null
        ? String(body.redeemDate).trim()
        : '';
  if (!redeemDateStr) {
    throw new Error('상환일을 입력해 주세요.');
  }
  var redeemDate = parseYmdDateGas_(redeemDateStr);
  if (!redeemDate) {
    throw new Error('상환일 형식이 올바르지 않습니다. (YYYY-MM-DD)');
  }

  var amtRaw =
    body['상환금액'] != null ? body['상환금액'] : body.redeemAmount != null ? body.redeemAmount : body.amount;
  var redeemAmt = Number(amtRaw);
  if (!isFinite(redeemAmt) || redeemAmt <= 0) {
    throw new Error('상환금액은 0보다 큰 숫자여야 합니다.');
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

  function colOrThrow(label) {
    var c = resolveColumnForKey_(maps, label);
    if (c == null) {
      throw new Error('ELS목록 1행에「' + label + '」열이 필요합니다.');
    }
    return c;
  }

  var joinAmtCol = colOrThrow('가입금액');
  var joinDateCol = colOrThrow('가입일');
  var statusCol = findStatusColumn_(maps);
  if (statusCol == null) throw new Error('「상태」열을 찾을 수 없습니다.');

  var joinAmt = gasCoerceNumber_(sheet.getRange(rowIndex, joinAmtCol).getValue());
  if (joinAmt == null || joinAmt <= 0) {
    throw new Error('시트의 가입금액을 읽을 수 없습니다.');
  }
  var joinDate = parseYmdDateGas_(sheet.getRange(rowIndex, joinDateCol).getValue());
  if (!joinDate) {
    throw new Error('시트의 가입일을 읽을 수 없습니다. (가입일 형식 확인)');
  }

  var curStatus = sheet.getRange(rowIndex, statusCol).getValue();
  var st = curStatus != null ? String(curStatus).trim() : '';
  if (st === ELS_REDEEMED_STATUS_) {
    throw new Error('이미 상환완료된 상품입니다.');
  }

  if (redeemDate.getTime() < joinDate.getTime()) {
    throw new Error('상환일은 가입일 이후여야 합니다.');
  }

  var days = investmentDaysBetween_(joinDate, redeemDate);
  var profit = redeemAmt - joinAmt;
  var ratio = redeemAmt / joinAmt;
  var annualPct = (Math.pow(ratio, 365 / days) - 1) * 100;
  if (!isFinite(annualPct)) {
    annualPct = 0;
  }

  sheet.getRange(rowIndex, colOrThrow('상환일')).setValue(redeemDateStr);
  sheet.getRange(rowIndex, colOrThrow('상환금액')).setValue(redeemAmt);
  sheet.getRange(rowIndex, colOrThrow('투자기간')).setValue(days);
  sheet.getRange(rowIndex, colOrThrow('연수익률')).setValue(Math.round(annualPct * 100) / 100);
  sheet.getRange(rowIndex, colOrThrow('수익')).setValue(Math.round(profit));
  sheet.getRange(rowIndex, statusCol).setValue(ELS_REDEEMED_STATUS_);
}

// ----- 대시보드 시트 읽기 -----

/**
 * 대시보드에 필요한 시트 데이터를 가져옵니다.
 * @param {string} dataType - 'summary' | 'assets' | 'rebalancing' | 'all'
 *   - summary: 총자산만
 *   - assets: els, etf, pension
 *   - rebalancing: portfolio, rebalancing
 *   - all: 전체
 */
function getDashboardData(dataType) {
  if (!dataType) dataType = 'all';

  var ss;
  try {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    throw new Error('스프레드시트를 열 수 없습니다. SPREADSHEET_ID를 확인하세요.');
  }
  if (!ss) throw new Error('스프레드시트를 찾을 수 없습니다.');

  var totalAssets = [];
  var portfolio = [];
  var rebalancing = [];
  var etf = [];
  var pension = [];
  var els = [];
  var elsSheetTotals = null;
  var elsCompleted = [];
  var cashOther = [];
  var elsListSheetData = [];

  if (dataType === 'summary' || dataType === 'all') {
    try {
      totalAssets = readTotalAssetsSheet(ss);
    } catch (e) {
      totalAssets = [];
    }
  }

  if (dataType === 'rebalancing' || dataType === 'all') {
    try {
      portfolio = readSheetAsObjects(ss, '포트(New)');
    } catch (e) {
      portfolio = [];
    }
    try {
      rebalancing = getRebalancingDataFromPortApi(ss);
    } catch (e) {
      rebalancing = [];
    }
  }

  if (dataType === 'assets' || dataType === 'all') {
    try {
      etf = readSheetAsObjects(ss, 'ETF', 1);
    } catch (e) {
      etf = [];
    }
    try {
      pension = readSheetAsObjects(ss, '연금', 1);
    } catch (e) {
      pension = [];
    }
    try {
      els = readSheetAsObjectsFirstNonEmpty(ss, ['ELS(투자중)', 'ELS (투자중)', '투자중ELS'], 1);
    } catch (e) {
      els = [];
    }
    try {
      elsSheetTotals = readElsSheetTotalsB4C4(ss);
    } catch (e) {
      elsSheetTotals = null;
    }
    try {
      elsCompleted = readSheetAsObjectsFirstNonEmpty(
        ss,
        ['ELS(완료)', 'ELS (완료)', 'ELS완료'],
        1
      );
    } catch (e) {
      elsCompleted = [];
    }
    try {
      cashOther = readSheetAsObjects(ss, '현금', 1);
    } catch (e) {
      try {
        cashOther = readSheetAsObjects(ss, '현금', 0);
      } catch (e2) {
        cashOther = [];
      }
    }
    try {
      elsListSheetData = readElsListSheetWithRowIndex_(ss);
    } catch (e) {
      elsListSheetData = [];
    }
  }

  return {
    totalAssets: totalAssets || [],
    portfolio: portfolio || [],
    rebalancing: rebalancing || [],
    etf: etf || [],
    pension: pension || [],
    els: els || [],
    elsSheetTotals: elsSheetTotals,
    elsCompleted: elsCompleted || [],
    cashOther: cashOther || [],
    elsListSheetData: elsListSheetData || []
  };
}

/**
 * 후보 시트명 중 첫 번째로 존재하는 시트를 headerRowIndex 행을 헤더로 읽습니다.
 * @returns {Object[]}
 */
function readSheetAsObjectsFirstNonEmpty(ss, sheetNames, headerRowIndex) {
  if (!sheetNames || !sheetNames.length) return [];
  var hi = headerRowIndex == null ? 0 : Number(headerRowIndex) || 0;
  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i];
    try {
      var sheet = ss.getSheetByName(name);
      if (!sheet) continue;
      var rows = readSheetAsObjects(ss, name, hi);
      if (rows && rows.length > 0) return rows;
    } catch (e) {}
  }
  for (var j = 0; j < sheetNames.length; j++) {
    try {
      var sh = ss.getSheetByName(sheetNames[j]);
      if (sh) return readSheetAsObjects(ss, sheetNames[j], hi);
    } catch (e2) {}
  }
  return [];
}

/**
 * 「ELS」시트 B4·C4: 투자원금·평가금액 합계 (홈 카드·총자산 집계용).
 * @returns {{ principal: number, valuation: number }|null}
 */
function readElsSheetTotalsB4C4(ss) {
  var sh =
    ss.getSheetByName('ELS') ||
    ss.getSheetByName('els') ||
    ss.getSheetByName('Els');
  if (!sh) return null;
  var vals = sh.getRange(4, 2, 4, 3).getValues();
  if (!vals || !vals[0]) return null;
  var p = gasCoerceNumber_(vals[0][0]);
  var v = gasCoerceNumber_(vals[0][1]);
  if (p == null && v == null) return null;
  return {
    principal: p != null ? p : 0,
    valuation: v != null ? v : 0
  };
}

/** 시트/JSON 숫자 셀을 숫자로 변환 (쉼표·원 문자 제거) */
function gasCoerceNumber_(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && !isNaN(v)) return v;
  var s = String(v).replace(/,/g, '').replace(/원/g, '').replace(/\s/g, '').trim();
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * '포트_API' 시트에서 리밸런싱 데이터를 읽습니다.
 * 1행=헤더(계좌명, 종목명, 현재가, 보유수량, 목표비중, 현재비중, 평가금액 등), 2행~=데이터.
 * 계좌명(또는 계좌) 컬럼 기준으로 계좌별 그룹하여 반환합니다.
 * @returns {Array<{ accountLabel: string, sheet: string, rows: Object[] }>}
 */
function getRebalancingDataFromPortApi(ss) {
  var sheetName = '포트_API';
  var rows = [];
  try {
    rows = readSheetAsObjects(ss, sheetName, 0);
  } catch (e) {
    return [];
  }
  if (!rows || rows.length === 0) return [];

  var byAccount = {};
  var accountOrder = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var label = (row.계좌명 != null && String(row.계좌명).trim() !== '')
      ? String(row.계좌명).trim()
      : (row.계좌 != null && String(row.계좌).trim() !== '')
        ? String(row.계좌).trim()
        : (row.account != null && String(row.account).trim() !== '')
          ? String(row.account).trim()
          : '전체';
    if (!byAccount[label]) {
      byAccount[label] = [];
      accountOrder.push(label);
    }
    byAccount[label].push(row);
  }

  var out = [];
  for (var j = 0; j < accountOrder.length; j++) {
    var accountLabel = accountOrder[j];
    var accountRows = byAccount[accountLabel] || [];
    if (accountRows.length > 0) {
      out.push({
        accountLabel: accountLabel,
        sheet: sheetName,
        rows: accountRows
      });
    }
  }
  return out;
}

/**
 * '총자산' 시트: 1행이 표 제목만 있고 2행이 헤더인 경우가 많아, 상단 몇 행에서
 * '평가일' / '일자'가 포함된 행을 헤더로 자동 선택합니다.
 */
function readTotalAssetsSheet(ss) {
  try {
    var sheet = ss.getSheetByName('총자산');
    if (!sheet) return [];
    var range = sheet.getDataRange();
    if (!range) return [];
    var values = range.getValues();
    if (!values || values.length < 2) return [];

    var maxScan = Math.min(6, values.length);
    for (var r = 0; r < maxScan; r++) {
      var row = values[r];
      var hit = false;
      for (var c = 0; c < row.length; c++) {
        var cell = row[c] != null ? String(row[c]).trim() : '';
        if (
          cell === '평가일' ||
          cell === '일자' ||
          cell === '날짜' ||
          cell.indexOf('평가일') >= 0 ||
          cell.indexOf('일자') >= 0 ||
          cell.indexOf('날짜') >= 0 ||
          cell.indexOf('기준일') >= 0 ||
          cell.indexOf('연월') >= 0 ||
          cell.indexOf('년월') >= 0
        ) {
          hit = true;
          break;
        }
      }
      if (hit) return readSheetAsObjects(ss, '총자산', r);
    }
    return readSheetAsObjects(ss, '총자산', 0);
  } catch (e) {
    return [];
  }
}

/**
 * 시트를 읽어 지정 행을 헤더로, 그 다음 행부터 객체 배열로 반환합니다.
 * 시트가 없거나 데이터가 없으면 빈 배열을 반환합니다.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - 스프레드시트
 * @param {string} sheetName - 시트 이름 (예: '총자산', '포트(New)', 'ELS(투자중)')
 * @param {number} headerRowIndex - 헤더로 쓸 행 (0-based). 기본 0. 1이면 2행을 헤더로 사용(1행이 제목인 경우).
 * @returns {Object[]} [{ 헤더1: 값1, 헤더2: 값2, ... }, ...]
 */
function readSheetAsObjects(ss, sheetName, headerRowIndex) {
  try {
    if (!ss || !sheetName) return [];

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];

    const range = sheet.getDataRange();
    if (!range) return [];

    const values = range.getValues();
    if (!values || !values.length) return [];

    const hi = headerRowIndex == null ? 0 : Number(headerRowIndex) || 0;
    if (values.length < hi + 2) return [];

    const headers = values[hi].map(function (h) {
      if (h == null) return '';
      return String(h)
        .replace(/\u3000/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    });
    const rows = [];

    for (var i = hi + 1; i < values.length; i++) {
      var row = values[i];
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        var key = headers[j] || 'col' + j;
        var val = row[j];
        if (typeof val === 'number' && !isNaN(val)) {
          obj[key] = val;
        } else if (val != null && val !== '') {
          obj[key] = val;
        } else {
          obj[key] = val === 0 ? 0 : null;
        }
      }
      rows.push(obj);
    }

    return rows;
  } catch (e) {
    return [];
  }
}

/** ELS목록: 각 행에 시트 행번호 row_index(1-based, 헤더=1) 부여 — 상환·수정 API용 */
function readElsListSheetWithRowIndex_(ss) {
  var sheet = ss.getSheetByName(ELS_LIST_SHEET_NAME_);
  if (!sheet) return [];
  var range = sheet.getDataRange();
  if (!range) return [];
  var values = range.getValues();
  if (!values || values.length < 2) return [];
  var hi = 0;
  var headers = values[hi].map(function (h) {
    if (h == null) return '';
    return String(h)
      .replace(/\u3000/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  });
  var rows = [];
  for (var i = hi + 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j] || 'col' + j;
      var val = row[j];
      if (typeof val === 'number' && !isNaN(val)) {
        obj[key] = val;
      } else if (val != null && val !== '') {
        obj[key] = val;
      } else {
        obj[key] = val === 0 ? 0 : null;
      }
    }
    obj.row_index = i + 1;
    rows.push(obj);
  }
  return rows;
}
