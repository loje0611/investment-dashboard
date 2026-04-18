/**
 * Investment Dashboard - Google Apps Script
 * 스프레드시트에서 데이터를 읽어 웹 대시보드용 JSON을 반환합니다.
 *
 * 중요: 웹 앱 URL로 호출될 때는 '열린 시트'가 없으므로
 * 스프레드시트 ID로 openById()를 사용해야 합니다.
 * 아래 SPREADSHEET_ID를 본인 스프레드시트 ID로 변경하세요.
 *
 * 반환 형식: { totalAssets, summaryCards, etfList, pensionList, elsListSheetData, cashOther, rebalancing }
 */
var SPREADSHEET_ID = '1MEr9roiooSY-BOG02gO_jJ-UNSaWOmnNmFLyLBKfdI4';

/** 대시보드·자산 상세: 띄어쓰기 없이 시트 탭 이름과 정확히 일치해야 함 */
var ETF_DASHBOARD_SHEET_ = 'ETF현황';
var PENSION_DASHBOARD_SHEET_ = '연금현황';
var ETF_HISTORY_SHEET_ = 'ETF기록';
var PENSION_HISTORY_SHEET_ = '연금기록';

var ELS_LIST_SHEET_NAME_ = 'ELS목록';
var ELS_PENDING_STATUS_ = '청약 중(대기)';
var ELS_LIVE_STATUS_ = '투자 중';
var ELS_REDEEMED_STATUS_ = '상환완료';
var ELS_LIST_MIN_HEADERS_ = ['증권사', '상품회차', '가입금액', '발행일', '상태', '가입일'];

var ELS_REGISTER_BROKERS_ = {
  삼성증권: true, 키움증권: true, 미래에셋증권: true, KB증권: true, 메리츠증권: true,
};

/** POST 요청 body.authEmail을 검증합니다. 비어있거나 허용 목록에 없으면 에러를 던집니다. */
var ALLOWED_EMAILS_ = { 'loje0611@gmail.com': true };

function validateAuthEmail_(body) {
  var email = body && body.authEmail != null ? String(body.authEmail).trim().toLowerCase() : '';
  if (!email || !ALLOWED_EMAILS_[email]) {
    throw new Error('인증되지 않은 요청입니다. (authEmail 누락 또는 미허용 이메일)');
  }
}

// --- Sheet Data Cache Manager ---
// 시트 데이터 2차원 배열을 메모리에 캐싱하여 중복 I/O를 최소화합니다.
var SHEET_CACHE_ = {};

function getSheetValuesCached_(ss, sheetName) {
  if (SHEET_CACHE_[sheetName] !== undefined) {
    return SHEET_CACHE_[sheetName];
  }
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    SHEET_CACHE_[sheetName] = null;
    return null;
  }
  var range = sheet.getDataRange();
  if (!range) {
    SHEET_CACHE_[sheetName] = null;
    return null;
  }
  var values = range.getValues();
  SHEET_CACHE_[sheetName] = values;
  return values;
}

// ----- 웹앱 진입점 -----

function doGet(e) {
  SHEET_CACHE_ = {};
  var api = e && e.parameter && e.parameter.api != null ? String(e.parameter.api).trim() : '';
  try {
    if (api === 'els_pending') {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var items = getElsPendingRowsWithIndex_(ss);
      return jsonResponse_({ success: true, items: items });
    }
    var param = e && e.parameter && e.parameter.data ? String(e.parameter.data).toLowerCase() : 'all';
    var data = getDashboardData(param);
    return jsonResponse_(data);
  } catch (err) {
    var message = err && err.message ? String(err.message) : String(err);
    if (api === 'els_pending') return jsonResponse_({ success: false, error: message });
    return jsonResponse_({ error: message });
  }
}

function doPost(e) {
  SHEET_CACHE_ = {};
  try {
    var raw = e && e.postData && e.postData.contents != null ? String(e.postData.contents).trim() : '';
    if (!raw) return jsonResponse_({ success: false, error: '요청 본문이 비어 있습니다.' });
    var body;
    try { body = JSON.parse(raw); } catch (parseErr) { return jsonResponse_({ success: false, error: 'JSON 파싱에 실패했습니다.' }); }
    if (!body || typeof body !== 'object') return jsonResponse_({ success: false, error: '유효한 JSON 객체가 아닙니다.' });

    validateAuthEmail_(body);

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
    if (action === 'syncall') {
      syncAllInvestmentData(ss);
      return jsonResponse_({ success: true, message: '모든 데이터가 성공적으로 기록되었습니다.' });
    }
    if (action === 'gethistory') {
      var pname = body.productName != null ? String(body.productName).trim() : '';
      var ptype = body.type != null ? String(body.type).trim().toUpperCase() : '';
      if (!pname) return jsonResponse_({ success: false, error: 'productName이 필요합니다.' });
      if (ptype !== 'ETF' && ptype !== 'PENSION') {
        return jsonResponse_({ success: false, error: 'type은 ETF 또는 PENSION이어야 합니다.' });
      }
      var historyRows = getProductHistory(pname, ptype);
      return jsonResponse_({ success: true, history: historyRows });
    }
    if (action === '' || action === 'create') {
      handleElsCreate_(ss, body);
      return jsonResponse_({ success: true, message: '등록되었습니다.' });
    }
    return jsonResponse_({ success: false, error: '알 수 없는 action: ' + body.action });
  } catch (err) {
    return jsonResponse_({ success: false, error: err && err.message ? String(err.message) : String(err) });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 총자산·ETF·연금 시트에 현재 자산 데이터를 순서대로 기록합니다.
 * recordAssetHistory / updateEtfHistory / updatePensionHistory 에 실제 기록 로직을 두세요.
 * (이미 다른 스크립트 파일에 동일 이름으로 구현했다면, 여기의 스텁 함수는 삭제하세요.)
 */
function syncAllInvestmentData(ssOpt) {
  var ss = ssOpt || SpreadsheetApp.openById(SPREADSHEET_ID);
  recordAssetHistory(ss);
  updateEtfHistory(ss);
  updatePensionHistory(ss);
}



function getElsSheetOrThrow_(ss) {
  var sheet = ss.getSheetByName(ELS_LIST_SHEET_NAME_);
  if (!sheet) throw new Error('ELS목록 시트를 찾을 수 없습니다.');
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
  return String(s || '').replace(/\u3000/g, ' ').replace(/\s+/g, '').replace(/_/g, '').toLowerCase();
}

function buildHeaderColumnMaps_(headerRow) {
  var exact = {}, norm = {};
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
  var c = maps.exact['상태'] || maps.norm[normalizeHeaderKey_('상태')] || maps.exact['status'] || maps.norm['status'];
  return c != null ? c : null;
}

function isEmptyValue_(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function gasCoerceNumber_(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && !isNaN(v)) return v;
  var n = parseFloat(String(v).replace(/[₩원%,]/g, '').replace(/\s/g, '').trim());
  return isNaN(n) ? null : n;
}

/**
 * 시트에서 읽은 수익률(Yield)을 API용 백분율(%) 숫자로 통일합니다.
 * 셀 서식이 백분율이면 원본이 0.438처럼 비율로 저장되는 경우가 많으므로,
 * |값| ≤ 1 이면 100을 곱해 43.8(%)로 환산합니다. 이미 43.8처럼 백분율이면 그대로 둡니다.
 * @param {*} v 셀 원본 값
 * @returns {number|null} 소수 둘째 자리까지 반올림한 백분율, 파싱 불가 시 null
 */
function normalizeSheetYieldPercent_(v) {
  var n = gasCoerceNumber_(v);
  if (n === null || isNaN(n)) return null;
  var pct = Math.abs(n) <= 1 ? n * 100 : n;
  return Math.round(pct * 100) / 100;
}

/**
 * 객체(row)에서 여러 후보 키를 순서대로 시도하여 첫 번째로 값이 있는 것을 반환.
 * 공백 유무 차이(예: '평가금 총액' vs '평가금총액')에 모두 대응하기 위해
 * 각 후보를 있는 그대로 + 공백 제거 버전 양쪽으로 비교합니다.
 */
function findRowValue_(row, candidates) {
  if (!row || !candidates) return undefined;
  // 먼저 정확한(exact) 키로 시도
  for (var i = 0; i < candidates.length; i++) {
    var v = row[candidates[i]];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  // row 키를 공백 제거한 맵으로 변환 후 비교
  var keys = Object.keys(row);
  var stripped = {};
  for (var k = 0; k < keys.length; k++) {
    stripped[keys[k].replace(/\s+/g, '')] = keys[k];
  }
  for (var i = 0; i < candidates.length; i++) {
    var norm = candidates[i].replace(/\s+/g, '');
    var realKey = stripped[norm];
    if (realKey != null) {
      var v = row[realKey];
      if (v !== undefined && v !== null && v !== '') return v;
    }
  }
  return undefined;
}

function getElsPendingRowsWithIndex_(ss) {
  var values = getSheetValuesCached_(ss, ELS_LIST_SHEET_NAME_);
  if (!values || values.length < 2) return [];

  var headerRow = values[0];
  var maps = buildHeaderColumnMaps_(headerRow);
  var statusCol = findStatusColumn_(maps);
  if (statusCol == null) throw new Error('ELS목록 1행에「상태」열이 없습니다.');

  var out = [];
  for (var r = 1; r < values.length; r++) {
    var sheetRow = r + 1;
    var st = values[r][statusCol - 1] != null ? String(values[r][statusCol - 1]).trim() : '';
    if (st !== ELS_PENDING_STATUS_) continue;

    var obj = { row_index: sheetRow };
    for (var c = 0; c < headerRow.length; c++) {
      var name = headerRow[c] != null ? String(headerRow[c]).trim() : '';
      if (!name) continue;
      var v = values[r][c];
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
    if (col == null) throw new Error('ELS목록 1행에「' + label + '」열이 필요합니다.');
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
  if (issueCol != null && check.issueDate) row[issueCol - 1] = check.issueDate;

  sheet.appendRow(row);
  // Cache invalidate as we appended row (not easily modifiable array since length changed)
  SHEET_CACHE_[ELS_LIST_SHEET_NAME_] = undefined;
}

function validateElsCreatePayload_(body) {
  var brokerage = body.brokerage != null ? String(body.brokerage).trim() : body['증권사'] != null ? String(body['증권사']).trim() : '';
  if (!brokerage || !ELS_REGISTER_BROKERS_[brokerage]) return { ok: false, error: '유효한 증권사를 선택해 주세요.' };
  var productRound = Number(body.productRound != null ? body.productRound : body['상품회차']);
  if (!isFinite(productRound) || productRound <= 0 || Math.floor(productRound) !== productRound) return { ok: false, error: '상품회차는 양의 정수여야 합니다.' };
  var amount = Number(body.amount != null ? body.amount : body['가입금액']);
  if (!isFinite(amount) || amount <= 0) return { ok: false, error: '가입금액은 0보다 큰 숫자여야 합니다.' };
  var issueDate = (body.issueDate != null ? String(body.issueDate).trim() : body['발행일'] != null ? String(body['발행일']).trim() : '') || null;
  return { ok: true, brokerage: brokerage, productRound: productRound, amount: amount, issueDate: issueDate };
}

function handleElsUpdate_(ss, body) {
  var rowIndex = body.row_index != null ? Number(body.row_index) : NaN;
  if (!isFinite(rowIndex) || rowIndex < 2 || Math.floor(rowIndex) !== rowIndex) throw new Error('유효한 row_index(정수, 2 이상)가 필요합니다.');

  var values = getSheetValuesCached_(ss, ELS_LIST_SHEET_NAME_);
  if (!values || values.length < 1) throw new Error('ELS목록에 헤더 행이 없습니다.');
  if (rowIndex > values.length) throw new Error('row_index가 시트 범위를 벗어났습니다.');

  var sheet = getElsSheetOrThrow_(ss);
  var maps = buildHeaderColumnMaps_(values[0]);
  var arrayRow = rowIndex - 1;

  var lastCol = sheet.getLastColumn();
  var rowRange = sheet.getRange(rowIndex, 1, 1, lastCol);
  var rowData = rowRange.getValues()[0];

  var keys = Object.keys(body);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key === 'action' || key === 'row_index' || key === 'authEmail') continue;
    var val = body[key];
    if (isEmptyValue_(val)) continue;

    var col = resolveColumnForKey_(maps, key);
    if (col == null) continue;

    rowData[col - 1] = val;
    values[arrayRow][col - 1] = val;
  }

  var statusCol = findStatusColumn_(maps);
  if (statusCol == null) throw new Error('「상태」열을 찾을 수 없어 투자 중으로 바꿀 수 없습니다.');

  rowData[statusCol - 1] = ELS_LIVE_STATUS_;
  values[arrayRow][statusCol - 1] = ELS_LIVE_STATUS_;

  rowRange.setValues([rowData]);
}

function parseYmdDateGas_(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  var m = String(v).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    var y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]), dt = new Date(y, mo, d);
    if (dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) return dt;
  }
  return null;
}

function investmentDaysBetween_(start, end) {
  var days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return days < 1 ? 1 : days;
}

function handleElsRedeem_(ss, body) {
  var rowIndex = body.row_index != null ? Number(body.row_index) : NaN;
  if (!isFinite(rowIndex) || rowIndex < 2 || Math.floor(rowIndex) !== rowIndex) throw new Error('유효한 row_index(정수, 2 이상)가 필요합니다.');

  var redeemDateStr = body['상환일'] != null ? String(body['상환일']).trim() : body.redeemDate != null ? String(body.redeemDate).trim() : '';
  if (!redeemDateStr) throw new Error('상환일을 입력해 주세요.');
  var redeemDate = parseYmdDateGas_(redeemDateStr);
  if (!redeemDate) throw new Error('상환일 형식이 올바르지 않습니다. (YYYY-MM-DD)');

  var redeemAmt = Number(body['상환금액'] != null ? body['상환금액'] : body.redeemAmount != null ? body.redeemAmount : body.amount);
  if (!isFinite(redeemAmt) || redeemAmt <= 0) throw new Error('상환금액은 0보다 큰 숫자여야 합니다.');

  var values = getSheetValuesCached_(ss, ELS_LIST_SHEET_NAME_);
  if (!values || values.length < 1) throw new Error('ELS목록에 헤더 행이 없습니다.');
  if (rowIndex > values.length) throw new Error('row_index가 시트 범위를 벗어났습니다.');

  var sheet = getElsSheetOrThrow_(ss);
  var maps = buildHeaderColumnMaps_(values[0]);
  function colOrThrow(label) {
    var c = resolveColumnForKey_(maps, label);
    if (c == null) throw new Error('ELS목록 1행에「' + label + '」열이 필요합니다.');
    return c;
  }

  var arrayRow = rowIndex - 1;
  var statusCol = findStatusColumn_(maps);
  if (statusCol == null) throw new Error('「상태」열을 찾을 수 없습니다.');

  var joinAmt = gasCoerceNumber_(values[arrayRow][colOrThrow('가입금액') - 1]);
  if (joinAmt == null || joinAmt <= 0) throw new Error('시트의 가입금액을 읽을 수 없습니다.');
  var joinDate = parseYmdDateGas_(values[arrayRow][colOrThrow('가입일') - 1]);
  if (!joinDate) throw new Error('시트의 가입일을 읽을 수 없습니다. (가입일 형식 확인)');

  var curStatus = values[arrayRow][statusCol - 1] != null ? String(values[arrayRow][statusCol - 1]).trim() : '';
  if (curStatus === ELS_REDEEMED_STATUS_) throw new Error('이미 상환완료된 상품입니다.');
  if (redeemDate.getTime() < joinDate.getTime()) throw new Error('상환일은 가입일 이후여야 합니다.');

  var days = investmentDaysBetween_(joinDate, redeemDate);
  var profit = redeemAmt - joinAmt;
  var ratio = redeemAmt / joinAmt;
  var annualPct = isFinite((Math.pow(ratio, 365 / days) - 1) * 100) ? (Math.pow(ratio, 365 / days) - 1) * 100 : 0;
  var roundedPct = Math.round(annualPct * 100) / 100;
  var roundedProfit = Math.round(profit);

  var colRedeemDate = colOrThrow('상환일');
  var colRedeemAmt = colOrThrow('상환금액');
  var colPeriod = colOrThrow('투자기간');
  var colAnnualRate = colOrThrow('연수익률');
  var colProfit = colOrThrow('수익');

  var lastCol = sheet.getLastColumn();
  var rowRange = sheet.getRange(rowIndex, 1, 1, lastCol);
  var rowData = rowRange.getValues()[0];

  rowData[colRedeemDate - 1] = redeemDateStr;
  rowData[colRedeemAmt - 1] = redeemAmt;
  rowData[colPeriod - 1] = days;
  rowData[colAnnualRate - 1] = roundedPct;
  rowData[colProfit - 1] = roundedProfit;
  rowData[statusCol - 1] = ELS_REDEEMED_STATUS_;

  rowRange.setValues([rowData]);

  values[arrayRow][colRedeemDate - 1] = redeemDateStr;
  values[arrayRow][colRedeemAmt - 1] = redeemAmt;
  values[arrayRow][colPeriod - 1] = days;
  values[arrayRow][colAnnualRate - 1] = roundedPct;
  values[arrayRow][colProfit - 1] = roundedProfit;
  values[arrayRow][statusCol - 1] = ELS_REDEEMED_STATUS_;
}

// ----- 대시보드 시트 계산 최적화 (Map/Reduce/Filter 연산) -----

function getDashboardData(dataType) {
  if (!dataType) dataType = 'all';
  var ss;
  try { ss = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (e) { throw new Error('스프레드시트를 열 수 없습니다. SPREADSHEET_ID를 확인하세요.'); }

  var totalAssets = [];
  var summaryCards = [];
  var etfList = [];
  var pensionList = [];
  var elsListSheetData = [];
  var cashOther = [];
  var rebalancing = [];

  if (dataType === 'summary' || dataType === 'all') {
    try { totalAssets = readTotalAssetsSheet_(ss); } catch (e) { totalAssets = []; }
  }

  if (dataType === 'rebalancing' || dataType === 'all') {
    try { rebalancing = getRebalancingDataFromPortApi_(ss); } catch (e) { rebalancing = []; }
  }

  if (dataType === 'assets' || dataType === 'summary' || dataType === 'all') {
    var etfPack = readEtfOrPensionStatusSheet_(ss, ETF_DASHBOARD_SHEET_);
    etfList = etfPack.list;
    var penPack = readEtfOrPensionStatusSheet_(ss, PENSION_DASHBOARD_SHEET_);
    pensionList = penPack.list;
    var pensionSummary = penPack.summary;

    try {
      cashOther = readSheetAsObjects_(ss, '현금', 1);
      if (!cashOther || cashOther.length === 0) cashOther = readSheetAsObjects_(ss, '현금', 0);
    } catch (e) { cashOther = []; }
    try { elsListSheetData = readElsListSheetWithRowIndex_(ss); } catch (e) { elsListSheetData = []; }

    // --- 요약 카드 (파이 차트는 프론트에서 totalAssets 기반 계산) ---
    try {
      var totalValuation = 0, totalRate = null;
      if (totalAssets && totalAssets.length > 0) {
        var latestRow = totalAssets[totalAssets.length - 1];
        var v = gasCoerceNumber_(findRowValue_(latestRow, ['평가금 총액', '평가금총액', '평가금액']));
        var p = gasCoerceNumber_(findRowValue_(latestRow, ['원금 총액', '원금총액', '투자원금', '원금']));
        if (v != null) totalValuation = v;
        if (v != null && p != null && p > 0) {
          totalRate = ((v - p) / p) * 100;
        }
      }
      summaryCards.push({ id: 'total', title: '총 자산 평가', amount: totalValuation || 0, rate: totalRate });

      var penValuation = null, penRate = null;
      var penScan = pensionList ? pensionList.slice() : [];
      if (pensionSummary) penScan.push(pensionSummary);
      if (penScan.length > 0) {
        for (var i = 0; i < penScan.length; i++) {
          var row = penScan[i];
          var title = String(findRowValue_(row, ['상품명', '종목명', '이름', '항목']) || row[Object.keys(row)[0]] || '').trim();
          if (title.indexOf('개인연금 합계') !== -1) {
            penValuation = gasCoerceNumber_(findRowValue_(row, ['평가금액', '평가금']));
            var rPen = normalizeSheetYieldPercent_(findRowValue_(row, ['수익률']));
            if (rPen != null) {
              penRate = rPen;
            }
            break;
          }
        }
      }
      if (penValuation == null) penValuation = 0;
      summaryCards.push({ id: 'pension', title: '연금 평가', amount: penValuation, rate: penRate });

      var etfValuation = 0, etfPrincipal = 0;
      if (etfList) {
        for (var j = 0; j < etfList.length; j++) {
          var titleE = String(findRowValue_(etfList[j], ['상품명', '종목명']) || '').trim();
          if (!/합계|소계|^계$/.test(titleE)) {
            etfValuation += gasCoerceNumber_(findRowValue_(etfList[j], ['평가금액', '평가금'])) || 0;
            etfPrincipal += gasCoerceNumber_(findRowValue_(etfList[j], ['투자원금', '매수금액', '원금'])) || 0;
          }
        }
      }
      var etfRate = etfPrincipal > 0 ? ((etfValuation - etfPrincipal) / etfPrincipal) * 100 : null;
      summaryCards.push({ id: 'etf', title: 'ETF 평가', amount: etfValuation, rate: etfRate });

      var elsValuation = null, elsInvRate = null;
      var elsSummarySheet = [];
      try {
        elsSummarySheet = readSheetAsObjects_(ss, 'ELS', 1);
        if (!elsSummarySheet || elsSummarySheet.length === 0) {
          elsSummarySheet = readSheetAsObjects_(ss, 'ELS', 0);
        }
      } catch (e2) { Logger.log('ELS 요약 시트 읽기 오류: ' + (e2 && e2.message ? e2.message : String(e2))); }

      if (elsSummarySheet && elsSummarySheet.length > 0) {
        for (var k = 0; k < elsSummarySheet.length; k++) {
          var rowEls = elsSummarySheet[k];
          var titleEls = String(findRowValue_(rowEls, ['상품명', '이름', '항목']) || rowEls[Object.keys(rowEls)[0]] || '').trim();
          if (titleEls.indexOf('합계') !== -1) {
            elsValuation = gasCoerceNumber_(findRowValue_(rowEls, ['평가금액', '평가금']));
            var rEls = normalizeSheetYieldPercent_(findRowValue_(rowEls, ['수익률']));
            if (rEls != null) {
              elsInvRate = rEls;
            }
            break;
          }
        }
      }
      if (elsValuation == null) elsValuation = 0;
      summaryCards.push({ id: 'els', title: 'ELS 평가', amount: elsValuation, rate: elsInvRate });

      var elsProfitSum = 0, elsCompleteRateSum = 0, elsCompleteCount = 0;
      if (elsListSheetData) {
        for (var m = 0; m < elsListSheetData.length; m++) {
          var rowLs = elsListSheetData[m];
          var pf = gasCoerceNumber_(rowLs['수익']);
          if (pf != null) elsProfitSum += pf;
          var cr = normalizeSheetYieldPercent_(rowLs['연수익률']);
          if (cr != null) {
            elsCompleteRateSum += cr;
            elsCompleteCount++;
          }
        }
      }
      var rawCompleteRate = elsCompleteCount > 0 ? (elsCompleteRateSum / elsCompleteCount) : null;
      var elsCompleteRate = rawCompleteRate != null ? Math.round(rawCompleteRate * 100) / 100 : null;
      summaryCards.push({ id: 'els-profit', title: 'ELS 누적 수익금', amount: elsProfitSum, rate: elsCompleteRate });
    } catch (e3) { Logger.log('summaryCards 생성 중 오류: ' + (e3 && e3.message ? e3.message : String(e3))); }
  }

  return {
    totalAssets: totalAssets,
    summaryCards: summaryCards,
    etfList: etfList,
    pensionList: pensionList,
    elsListSheetData: elsListSheetData,
    cashOther: cashOther,
    rebalancing: rebalancing
  };
}

function readTotalAssetsSheet_(ss) {
  var values = getSheetValuesCached_(ss, '총자산');
  if (!values || values.length < 2) return [];

  var maxScan = Math.min(6, values.length);
  for (var r = 0; r < maxScan; r++) {
    var hit = values[r].some(function(cell) {
      var c = cell != null ? String(cell).trim() : '';
      return /평가일|일자|날짜|기준일|연월|년월/.test(c);
    });
    if (hit) return convertValuesToObjects_(values, r);
  }
  return convertValuesToObjects_(values, 0);
}

function convertValuesToObjects_(values, hi) {
  if (!values || values.length < hi + 2) return [];
  var headers = values[hi].map(function (h) {
    return h == null ? '' : String(h).replace(/\u3000|\t|\s+/g, ' ').trim();
  });
  
  return values.slice(hi + 1).map(function(row) {
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
    return obj;
  });
}

function readSheetAsObjects_(ss, sheetName, hi) {
  var values = getSheetValuesCached_(ss, sheetName);
  return convertValuesToObjects_(values, hi != null ? hi : 0);
}

/** ETF현황·연금현황 헤더 후보 행 점수 (숫자만 있는 행은 데이터로 간주) */
function rowHeaderScoreForAssetStatus_(row) {
  if (!row || !row.length) return 0;
  var score = 0;
  var seen = { p: 0, a: 0, v: 0, y: 0 };
  for (var c = 0; c < row.length; c++) {
    var nk = normalizeHeaderKey_(row[c]);
    if (!nk || nk.length < 2) continue;
    if (/^-?[\d.,%\s]+$/.test(nk)) continue;
    if (!seen.p && /(상품명|종목명|종목|품목|이름|항목)/.test(nk)) { score += 2; seen.p = 1; }
    if (!seen.a && /(투자원금|매수금액|매입금액|매입|^원금$)/.test(nk)) { score += 2; seen.a = 1; }
    if (!seen.v && /(평가금액|평가금|평가액|현재평가)/.test(nk)) { score += 2; seen.v = 1; }
    if (!seen.y && /(수익률|수익율|누적수익률)/.test(nk)) { score += 2; seen.y = 1; }
  }
  return score;
}

/**
 * 시트 상단 몇 행 중 헤더로 보이는 행 인덱스(0-based).
 * 첫 데이터 행이 키로 쓰이는 오류를 막기 위해 점수가 충분할 때만 채택합니다.
 */
function findEtfPensionHeaderRowIndex_(values) {
  if (!values || !values.length) return 0;
  var maxR = Math.min(6, values.length);
  var bestI = 0;
  var bestScore = -1;
  for (var r = 0; r < maxR; r++) {
    var sc = rowHeaderScoreForAssetStatus_(values[r]);
    if (sc > bestScore) {
      bestScore = sc;
      bestI = r;
    }
  }
  if (bestScore >= 4) return bestI;
  for (var r2 = 0; r2 < maxR; r2++) {
    var row = values[r2];
    if (!row) continue;
    for (var c = 0; c < row.length; c++) {
      var nk = normalizeHeaderKey_(row[c]);
      if (nk.indexOf('상품') >= 0 || nk.indexOf('종목') >= 0 || nk.indexOf('수익률') >= 0 || nk.indexOf('평가금') >= 0) {
        return r2;
      }
    }
  }
  return 0;
}

/**
 * 시트 헤더 셀 문자열 → API 고정 키(상품명, 투자원금, 평가금액, 수익률).
 * 매핑되지 않는 열은 trim 한 원본 헤더를 키로 유지(월별 수익률 등).
 */
function resolveCanonicalAssetStatusKey_(headerTrim) {
  if (!headerTrim) return null;
  var nk = normalizeHeaderKey_(headerTrim);
  if (!nk) return null;
  if (nk.indexOf('상품명') >= 0 || nk === '종목명' || nk === '종목' || nk === '품목' || nk === '이름' || nk === '항목') return '상품명';
  if (nk.indexOf('투자원금') >= 0 || nk.indexOf('매수금액') >= 0 || nk.indexOf('매입금액') >= 0 || nk.indexOf('매입가') >= 0 || nk === '원금') return '투자원금';
  if (nk.indexOf('평가금액') >= 0 || nk === '평가금' || nk.indexOf('평가액') >= 0 || nk.indexOf('현재평가') >= 0) return '평가금액';
  if (nk.indexOf('수익률') >= 0 || nk.indexOf('수익율') >= 0 || nk.indexOf('누적수익률') >= 0) return '수익률';
  return null;
}

function buildCanonicalAssetStatusRow_(headers, rowArr) {
  if (!headers) headers = [];
  if (!rowArr) rowArr = [];
  var obj = { '상품명': null, '투자원금': null, '평가금액': null, '수익률': null };
  var len = Math.max(headers.length, rowArr.length);
  for (var j = 0; j < len; j++) {
    var hk = j < headers.length ? headers[j] : '';
    var val = rowArr && j < rowArr.length ? rowArr[j] : null;
    var canon = hk ? resolveCanonicalAssetStatusKey_(hk) : null;
    if (canon) {
      if (obj[canon] === null || obj[canon] === '' || typeof obj[canon] === 'undefined') {
        if (val === '') {
          obj[canon] = null;
        } else if (canon === '수익률') {
          var ny = normalizeSheetYieldPercent_(val);
          if (ny !== null) {
            obj[canon] = ny;
          } else if (val === 0) {
            obj[canon] = 0;
          } else {
            obj[canon] = null;
          }
        } else if (typeof val === 'number' && !isNaN(val)) {
          obj[canon] = val;
        } else if (val != null && val !== '') {
          obj[canon] = val;
        } else {
          obj[canon] = val === 0 ? 0 : null;
        }
      }
    } else if (hk) {
      if (typeof val === 'number' && !isNaN(val)) obj[hk] = val;
      else if (val != null && val !== '') obj[hk] = val;
      else obj[hk] = val === 0 ? 0 : null;
    }
  }
  return obj;
}

function isAssetStatusRowEmpty_(obj) {
  for (var k in obj) {
    if (!obj.hasOwnProperty(k)) continue;
    var v = obj[k];
    if (v != null && v !== '' && !(typeof v === 'number' && !isNaN(v) && v === 0)) return false;
  }
  return true;
}

function isAssetStatusSummaryRow_(obj) {
  var t = String(obj['상품명'] != null ? obj['상품명'] : '').trim();
  return /합계|소계|^계$/.test(t);
}

/** 연금 시트 등에 있는 날짜 구분 행 — 목록에서 제외 */
function isAssetStatusMetaRow_(obj) {
  var t = String(obj['상품명'] != null ? obj['상품명'] : '').trim();
  return /^날짜$/i.test(t);
}

/**
 * ETF현황 / 연금현황: getValues() 2차원 배열에서 헤더 행을 찾고,
 * headers = values[hi], data = values.slice(hi + 1) 로 분리 후
 * 각 데이터 행을 { 상품명, 투자원금, 평가금액, 수익률, … } 고정 키로 매핑합니다.
 * 합계·소계·계 행은 list 에서 제외하고 summary 에만 둡니다.
 */
function readEtfOrPensionStatusSheet_(ss, sheetName) {
  var result = { list: [], summary: null };
  var values = getSheetValuesCached_(ss, sheetName);
  if (!values || values.length < 2) {
    if (!values) Logger.log('시트를 찾을 수 없습니다: ' + sheetName);
    return result;
  }

  var hi = findEtfPensionHeaderRowIndex_(values);
  var headerCells = values[hi];
  var headers = headerCells.map(function (h) {
    return h == null ? '' : String(h).replace(/\u3000|\t|\s+/g, ' ').trim();
  });
  var dataArrays = values.slice(hi + 1);
  var summaryCandidates = [];

  for (var r = 0; r < dataArrays.length; r++) {
    var rowArr = dataArrays[r];
    var obj = buildCanonicalAssetStatusRow_(headers, rowArr);
    if (isAssetStatusRowEmpty_(obj)) continue;
    if (isAssetStatusMetaRow_(obj)) continue;
    if (isAssetStatusSummaryRow_(obj)) summaryCandidates.push(obj);
    else result.list.push(obj);
  }
  if (summaryCandidates.length > 0) {
    result.summary = summaryCandidates[summaryCandidates.length - 1];
  }
  return result;
}

function getRebalancingDataFromPortApi_(ss) {
  var rows = readSheetAsObjects_(ss, '포트_API', 0);
  if (!rows || rows.length === 0) return [];

  var byAccount = {};
  var accountOrder = [];

  rows.forEach(function(row) {
    var label = (row.계좌명 != null && String(row.계좌명).trim() !== '') ? String(row.계좌명).trim() :
                (row.계좌 != null && String(row.계좌).trim() !== '') ? String(row.계좌).trim() :
                (row.account != null && String(row.account).trim() !== '') ? String(row.account).trim() : '전체';
    if (!byAccount[label]) {
      byAccount[label] = [];
      accountOrder.push(label);
    }
    byAccount[label].push(row);
  });

  return accountOrder.map(function(accountLabel) {
    return { accountLabel: accountLabel, sheet: '포트_API', rows: byAccount[accountLabel] };
  });
}

function readElsListSheetWithRowIndex_(ss) {
  var values = getSheetValuesCached_(ss, ELS_LIST_SHEET_NAME_);
  var rows = convertValuesToObjects_(values, 0);
  // add row_index properly since header=0 -> i(mapped)=0 array row map is 2 (values index + 2)
  rows.forEach(function(r, i) { r.row_index = i + 2; });
  return rows;
}

/**
 * 자산 변동 내역 기록 스크립트 (오름차순/하단 추가 방식)
 * - 14개 열 구조 반영 완료
 */
function recordAssetHistory(ssOpt) {
  const ss = ssOpt || SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("총자산");

  if (!sheet) {
    Logger.log("오류: '총자산' 시트를 찾을 수 없습니다.");
    throw new Error("'총자산' 시트를 찾을 수 없습니다.");
  }

  // 1. 이름 정의된 범위에서 데이터 가져오기
  const getVal = (name) => {
    try {
      const range = ss.getRangeByName(name);
      return range ? range.getValue() : 0;
    } catch (e) {
      return 0;
    }
  };

  const p_pension = getVal("연금원금");
  const p_els = getVal("ELS원금");
  const p_etf = getVal("ETF원금");
  const p_cash = getVal("기타원금");

  const v_pension = getVal("연금평가금");
  const v_els = getVal("ELS평가금");
  const v_etf = getVal("ETF평가금");
  const v_cash = getVal("기타평가금");

  // 2. 현재 상태 계산
  const today = new Date();
  const totalPrincipal = p_pension + p_els + p_etf + p_cash; 
  const totalValue = v_pension + v_els + v_etf + v_cash;     
  
  let yieldRate = 0; 
  if (totalPrincipal > 0) {
    yieldRate = (totalValue - totalPrincipal) / totalPrincipal;
  }

  // 3. 기록할 위치 찾기 (가장 아래 빈 행)
  const lastRow = sheet.getLastRow();
  const insertRow = lastRow + 1; 
  const prevRow = lastRow; // 직전 기록은 현재의 마지막 행

  // 4. 직전 기록과 비교 (증감액 계산)
  let prevPrincipal = 0;
  let prevValue = 0;

  if (prevRow >= 2) {
    const prevData = sheet.getRange(prevRow, 10, 1, 2).getValues()[0];
    if (typeof prevData[0] === 'number') {
      prevPrincipal = prevData[0];
      prevValue = prevData[1];
    }
  }

  const deltaPrincipal = totalPrincipal - prevPrincipal; 
  const deltaValue = totalValue - prevValue;             

  // 5. 데이터 입력 (변경된 14개 열 순서에 맞춤)
  const recordData = [[
    today,           // 1. 평가일
    p_pension,       // 2. 연금 원금
    v_pension,       // 3. 연금 평가금
    p_els,           // 4. ELS 원금
    v_els,           // 5. ELS 평가금
    p_etf,           // 6. ETF 원금
    v_etf,           // 7. ETF 평가금
    p_cash,          // 8. 현금 원금
    v_cash,          // 9. 현금 평가금
    totalPrincipal,  // 10. 원금 총액
    totalValue,      // 11. 평가금 총액
    yieldRate,       // 12. 수익률
    deltaPrincipal,  // 13. 원금 증감액
    deltaValue       // 14. 평가 증감액
  ]];

  // 14개 열에 데이터 쓰기
  sheet.getRange(insertRow, 1, 1, 14).setValues(recordData);

  // 6. 서식 복사 (디자인 유지 - 14개 열 복사)
  try {
    if (prevRow >= 2) { 
      const styleSource = sheet.getRange(prevRow, 1, 1, 14);
      styleSource.copyTo(
        sheet.getRange(insertRow, 1, 1, 14), 
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT, 
        false
      );
    }
  } catch (e) {
    // 서식 복사 실패 시 무시
  }

  SpreadsheetApp.flush(); 
  ss.toast("자산 현황 하단 기록 완료!", "완료", 3);
}

/** 헬퍼함수: 텍스트로 행 위치 찾기 (기존 유지) */
function findRowByText(sheet, text) {
  const finder = sheet.createTextFinder(text);
  const match = finder.findNext();
  if (match) return match.getRow();
  return -1;
}

/**
 * ETF기록 또는 연금기록 시트에서 상품명이 일치하는 모든 행을 찾아
 * [날짜(yyyy-MM-dd), 수익률(%)] 배열로 반환합니다. 날짜 기준 오름차순 정렬.
 * 수익률 열은 normalizeSheetYieldPercent_ 로 비율(0.438)→백분율(43.8) 환산 및 소수 둘째 자리 반올림을 적용합니다.
 *
 * @param {string} productName 시트 A열 상품명과 trim 후 정확히 일치
 * @param {string} type 'ETF' → ETF기록, 'PENSION' → 연금기록
 * @returns {Array<Array>} 예: [["2025-01-01", 12.34], ...]
 */
function getProductHistory(productName, type) {
  var t = String(type || '').trim().toUpperCase();
  var sheetName = t === 'ETF' ? ETF_HISTORY_SHEET_ : PENSION_HISTORY_SHEET_;
  if (t !== 'ETF' && t !== 'PENSION') {
    return [];
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var values = getSheetValuesCached_(ss, sheetName);
  if (!values || values.length < 2) {
    return [];
  }

  var tz = Session.getScriptTimeZone() || 'Asia/Seoul';
  var needle = String(productName || '').trim();
  var tmp = [];

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var nameCell = row[0];
    var name = nameCell != null ? String(nameCell).trim() : '';
    if (name !== needle) {
      continue;
    }

    var dateVal = row[1];
    var dateObj = null;
    if (Object.prototype.toString.call(dateVal) === '[object Date]') {
      dateObj = dateVal;
    } else if (dateVal != null && dateVal !== '') {
      dateObj = new Date(dateVal);
    }
    if (!dateObj || isNaN(dateObj.getTime())) {
      continue;
    }

    var rateCell = row[2];
    var rate = normalizeSheetYieldPercent_(rateCell);
    if (rate === null) {
      continue;
    }

    tmp.push({ ms: dateObj.getTime(), ymd: Utilities.formatDate(dateObj, tz, 'yyyy-MM-dd'), rate: rate });
  }

  tmp.sort(function (a, b) {
    if (a.ms !== b.ms) return a.ms - b.ms;
    return 0;
  });

  var out = [];
  for (var i = 0; i < tmp.length; i++) {
    out.push([tmp[i].ymd, tmp[i].rate]);
  }
  return out;
}

/**
 * ETF 현재 수익률을 'ETF기록' 시트에 스냅샷으로 저장
 * - 'ETF' 시트의 A열(상품명)과 E열(현재 수익률)을 읽어옴
 * - 오늘 날짜와 함께 'ETF_기록' 시트 하단에 추가
 */
function updateEtfHistory(ssOpt) {
  const ss = ssOpt || SpreadsheetApp.openById(SPREADSHEET_ID);
  let targetSheet = ss.getSheetByName(ETF_HISTORY_SHEET_);

  if (!targetSheet) {
    targetSheet = ss.insertSheet(ETF_HISTORY_SHEET_);
    targetSheet.appendRow(["상품명", "평가일", "수익률"]);
  }

  const values = getSheetValuesCached_(ss, ETF_DASHBOARD_SHEET_);
  if (!values || values.length < 2) {
    ss.toast("기록할 데이터가 없습니다.", "알림", 3);
    return;
  }

  const today = new Date();
  const historyData = [];

  for (let i = 1; i < values.length; i++) {
    const productName = values[i][0];
    const currentYield = values[i][4];

    if (productName && productName !== "합계" && currentYield !== "") {
      var yEtf = normalizeSheetYieldPercent_(currentYield);
      if (yEtf !== null) {
        historyData.push([productName, today, yEtf]);
      }
    }
  }

  if (historyData.length > 0) {
    targetSheet.getRange(targetSheet.getLastRow() + 1, 1, historyData.length, 3).setValues(historyData);

    const lastRowBeforeInsert = targetSheet.getLastRow() - historyData.length;
    if (lastRowBeforeInsert >= 2) {
      targetSheet.getRange(lastRowBeforeInsert, 1, 1, 3).copyTo(
        targetSheet.getRange(lastRowBeforeInsert + 1, 1, historyData.length, 3),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
    }

    ss.toast("ETF 수익률 기록 완료!", "완료", 3);
  } else {
    ss.toast("기록할 데이터가 없습니다.", "알림", 3);
  }
}

/**
 * 연금 현재 수익률을 '연금기록' 시트에 스냅샷으로 저장
 * - '연금' 시트의 상품명(A열)과 수익률(E열)을 읽어옴
 * - '연금기록' 시트의 구조 [상품명, 평가일, 수익률]에 맞춰 저장
 */
function updatePensionHistory(ssOpt) {
  const ss = ssOpt || SpreadsheetApp.openById(SPREADSHEET_ID);
  let targetSheet = ss.getSheetByName(PENSION_HISTORY_SHEET_);

  if (!targetSheet) {
    targetSheet = ss.insertSheet(PENSION_HISTORY_SHEET_);
    targetSheet.appendRow(["상품명", "평가일", "수익률"]);
  }

  const values = getSheetValuesCached_(ss, PENSION_DASHBOARD_SHEET_);
  if (!values || values.length < 3) {
    ss.toast("기록할 데이터가 없습니다.", "알림", 3);
    return;
  }

  const today = new Date();
  const historyData = [];

  // 데이터 시작: 3행(인덱스 2)부터
  for (let i = 2; i < values.length; i++) {
    const productName = values[i][0];
    const currentYield = values[i][4];

    if (productName && !String(productName).includes("합계") && currentYield !== "") {
      var yPen = normalizeSheetYieldPercent_(currentYield);
      if (yPen !== null) {
        historyData.push([productName, today, yPen]);
      }
    }
  }

  if (historyData.length > 0) {
    const targetLastRow = targetSheet.getLastRow();
    targetSheet.getRange(targetLastRow + 1, 1, historyData.length, 3).setValues(historyData);

    if (targetLastRow >= 2) {
      targetSheet.getRange(targetLastRow, 1, 1, 3).copyTo(
        targetSheet.getRange(targetLastRow + 1, 1, historyData.length, 3),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
    }

    ss.toast("연금 수익률 기록 완료!", "완료", 3);
  } else {
    ss.toast("기록할 데이터가 없습니다.", "알림", 3);
  }
}
