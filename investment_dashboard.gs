/**
 * Investment Dashboard - Google Apps Script
 * 스프레드시트에서 데이터를 읽어 웹 대시보드용 JSON을 반환합니다.
 *
 * 중요: 웹 앱 URL로 호출될 때는 '열린 시트'가 없으므로
 * 스프레드시트 ID로 openById()를 사용해야 합니다.
 * 아래 SPREADSHEET_ID를 본인 스프레드시트 ID로 변경하세요.
 *
 * 반환 형식: { totalAssets, portfolio, rebalancing, etf, pension, els, elsSheetTotals, elsCompleted, cashOther, elsListSheetData }
 */
var SPREADSHEET_ID = '1g1VBYupYjmkiF-85CXgjFvu4qzzSjtKTLGgXYNIhKQM';

var ELS_LIST_SHEET_NAME_ = 'ELS목록';
var ELS_PENDING_STATUS_ = '청약 중(대기)';
var ELS_LIVE_STATUS_ = '투자 중';
var ELS_REDEEMED_STATUS_ = '상환완료';
var ELS_LIST_MIN_HEADERS_ = ['증권사', '상품회차', '가입금액', '발행일', '상태', '가입일'];

var ELS_REGISTER_BROKERS_ = {
  삼성증권: true, 키움증권: true, 미래에셋증권: true, KB증권: true, 메리츠증권: true,
};

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
    return jsonResponse_({ success: false, error: err && err.message ? String(err.message) : String(err) });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
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
  var n = parseFloat(String(v).replace(/,/g, '').replace(/원/g, '').replace(/\s/g, '').trim());
  return isNaN(n) ? null : n;
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

  var keys = Object.keys(body);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key === 'action' || key === 'row_index') continue;
    var val = body[key];
    if (isEmptyValue_(val)) continue;

    var col = resolveColumnForKey_(maps, key);
    if (col == null) continue;

    sheet.getRange(rowIndex, col).setValue(val);
    values[arrayRow][col - 1] = val; // Update cache
  }

  var statusCol = findStatusColumn_(maps);
  if (statusCol == null) throw new Error('「상태」열을 찾을 수 없어 투자 중으로 바꿀 수 없습니다.');
  
  sheet.getRange(rowIndex, statusCol).setValue(ELS_LIVE_STATUS_);
  values[arrayRow][statusCol - 1] = ELS_LIVE_STATUS_;
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

  sheet.getRange(rowIndex, colRedeemDate).setValue(redeemDateStr);   values[arrayRow][colRedeemDate - 1] = redeemDateStr;
  sheet.getRange(rowIndex, colRedeemAmt).setValue(redeemAmt);        values[arrayRow][colRedeemAmt - 1] = redeemAmt;
  sheet.getRange(rowIndex, colPeriod).setValue(days);                values[arrayRow][colPeriod - 1] = days;
  sheet.getRange(rowIndex, colAnnualRate).setValue(roundedPct);      values[arrayRow][colAnnualRate - 1] = roundedPct;
  sheet.getRange(rowIndex, colProfit).setValue(roundedProfit);       values[arrayRow][colProfit - 1] = roundedProfit;
  sheet.getRange(rowIndex, statusCol).setValue(ELS_REDEEMED_STATUS_); values[arrayRow][statusCol - 1] = ELS_REDEEMED_STATUS_;
}

// ----- 대시보드 시트 계산 최적화 (Map/Reduce/Filter 연산) -----

function getDashboardData(dataType) {
  if (!dataType) dataType = 'all';
  var ss;
  try { ss = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (e) { throw new Error('스프레드시트를 열 수 없습니다. SPREADSHEET_ID를 확인하세요.'); }

  var totalAssets = [], portfolio = [], rebalancing = [], etf = [], pension = [], els = [], elsCompleted = [], cashOther = [], elsListSheetData = [];
  var elsSheetTotals = null;
  var summaryCards = [];
  var pieData = [];

  if (dataType === 'summary' || dataType === 'all') {
    try { totalAssets = readTotalAssetsSheet_(ss); } catch (e) { totalAssets = []; }
  }

  if (dataType === 'rebalancing' || dataType === 'all') {
    try { portfolio = readSheetAsObjects_(ss, '포트(New)', 0); } catch (e) { portfolio = []; }
    try { rebalancing = getRebalancingDataFromPortApi_(ss); } catch (e) { rebalancing = []; }
  }

  if (dataType === 'assets' || dataType === 'all') {
    try { etf = readSheetAsObjects_(ss, 'ETF', 1); } catch (e) { etf = []; }
    try { pension = readSheetAsObjects_(ss, '연금', 1); } catch (e) { pension = []; }
    try { els = readSheetAsObjectsFirstNonEmpty_(ss, ['ELS(투자중)', 'ELS (투자중)', '투자중ELS'], 1); } catch (e) { els = []; }
    try { elsCompleted = readSheetAsObjectsFirstNonEmpty_(ss, ['ELS(완료)', 'ELS (완료)', 'ELS완료'], 1); } catch (e) { elsCompleted = []; }
    
    // JS reduce 로 메모리 상에서 합산 계산 (다중 참조 제거, 초고속 연산 처리)
    if (els && els.length > 0) {
      elsSheetTotals = els.reduce(function(acc, item) {
        var p = gasCoerceNumber_(item['투자원금'] != null ? item['투자원금'] : item['가입금액']);
        var v = gasCoerceNumber_(item['평가금액']);
        return {
          principal: acc.principal + (p || 0),
          valuation: acc.valuation + (v || 0)
        };
      }, { principal: 0, valuation: 0 });
    } else {
      elsSheetTotals = { principal: 0, valuation: 0 };
    }

    try {
      cashOther = readSheetAsObjects_(ss, '현금', 1);
      if (!cashOther || cashOther.length === 0) cashOther = readSheetAsObjects_(ss, '현금', 0);
    } catch (e) { cashOther = []; }
    try { elsListSheetData = readElsListSheetWithRowIndex_(ss); } catch (e) { elsListSheetData = []; }

    // --- 요약 카드 및 파이 차트 데이터 계산 ---
    try {
      // 1) 총 자산 평가
      var totalValuation = 0, totalRate = null;
      if (totalAssets && totalAssets.length > 0) {
        // 가장 상위 행(3행) 즉, 배열의 첫 번째 요소 추출 (최신 데이터 상단 삽입 구조)
        var latestRow = totalAssets[0];
        var v = gasCoerceNumber_(latestRow['평가금총액']) || gasCoerceNumber_(latestRow['평가금액']);
        var p = gasCoerceNumber_(latestRow['원금총액']) || gasCoerceNumber_(latestRow['투자원금']);
        if (v != null) totalValuation = v;
        if (v != null && p != null && p > 0) {
          totalRate = ((v - p) / p) * 100;
        }
      }
      summaryCards.push({ id: 'total', title: '총 자산 평가', amount: totalValuation || 0, rate: totalRate });
      
      // 2) 연금 평가
      var penValuation = null, penRate = null;
      if (pension) {
        for (var i = 0; i < pension.length; i++) {
          var row = pension[i];
          // A열 혹은 대표 열에 해당하는 객체 키 찾기
          var title = String(row['상품명'] || row['종목명'] || row['이름'] || row['항목'] || row[Object.keys(row)[0]] || '').trim();
          if (title.indexOf('개인연금 합계') !== -1) {
            penValuation = gasCoerceNumber_(row['평가금액']) || gasCoerceNumber_(row['평가금']);
            var r = gasCoerceNumber_(row['수익률']);
            if (r != null) {
              penRate = Math.abs(r) < 1.5 ? r * 100 : r;
            } else {
              // 수익률 열이 제대로 파싱 안된 경우 (예: 문자로 인식됨)
              var rawRate = String(row['수익률'] || '').replace(/%/g, '').trim();
              var parsed = parseFloat(rawRate);
              if (!isNaN(parsed)) {
                penRate = Math.abs(parsed) < 1.5 ? parsed * 100 : parsed;
              }
            }
            break;
          }
        }
      }
      if (penValuation == null) penValuation = 0;
      summaryCards.push({ id: 'pension', title: '연금 평가', amount: penValuation, rate: penRate });

      // 3) ETF 평가
      var etfValuation = 0, etfPrincipal = 0;
      if (etf) {
        for (var i = 0; i < etf.length; i++) {
          var title = String(etf[i]['상품명'] || etf[i]['종목명'] || '').trim();
          if (!/합계|소계|^계$/.test(title)) {
             etfValuation += gasCoerceNumber_(etf[i]['평가금액']) || gasCoerceNumber_(etf[i]['평가금']) || 0;
             etfPrincipal += gasCoerceNumber_(etf[i]['투자원금']) || gasCoerceNumber_(etf[i]['매수금액']) || gasCoerceNumber_(etf[i]['원금']) || 0;
          }
        }
      }
      var etfRate = etfPrincipal > 0 ? ((etfValuation - etfPrincipal) / etfPrincipal) * 100 : null;
      summaryCards.push({ id: 'etf', title: 'ETF 평가', amount: etfValuation, rate: etfRate });
      
      // 4) ELS 투자 평가 (ELS 시트 명시적 조회)
      var elsValuation = null, elsInvRate = null;
      var elsSummarySheet = [];
      try {
        elsSummarySheet = readSheetAsObjects_(ss, 'ELS', 1);
        if (!elsSummarySheet || elsSummarySheet.length === 0) {
          elsSummarySheet = readSheetAsObjects_(ss, 'ELS', 0);
        }
      } catch(e) {}
      
      if (elsSummarySheet && elsSummarySheet.length > 0) {
        for (var i = 0; i < elsSummarySheet.length; i++) {
          var row = elsSummarySheet[i];
          var title = String(row['상품명'] || row['이름'] || row['항목'] || row[Object.keys(row)[0]] || '').trim();
          if (title.indexOf('합계') !== -1) {
            elsValuation = gasCoerceNumber_(row['평가금액']) || gasCoerceNumber_(row['평가금']);
            var r = gasCoerceNumber_(row['수익률']);
            if (r != null) {
              elsInvRate = Math.abs(r) < 1.5 ? r * 100 : r;
            } else {
              var rawRate = String(row['수익률'] || '').replace(/%/g, '').trim();
              var parsed = parseFloat(rawRate);
              if (!isNaN(parsed)) {
                elsInvRate = Math.abs(parsed) < 1.5 ? parsed * 100 : parsed;
              }
            }
            break;
          }
        }
      }
      if (elsValuation == null) elsValuation = 0;
      summaryCards.push({ id: 'els', title: 'ELS 투자 평가', amount: elsValuation, rate: elsInvRate });
      
      // 5) ELS 누적 수익금
      var elsProfitSum = 0, elsCompleteRateSum = 0, elsCompleteCount = 0;
      if (elsListSheetData) {
        for (var i = 0; i < elsListSheetData.length; i++) {
          var row = elsListSheetData[i];
          var pf = gasCoerceNumber_(row['수익']);
          if (pf != null) elsProfitSum += pf;
          var cr = gasCoerceNumber_(row['연수익률']);
          if (cr != null) {
            elsCompleteRateSum += cr;
            elsCompleteCount++;
          }
        }
      }
      var rawCompleteRate = elsCompleteCount > 0 ? (elsCompleteRateSum / elsCompleteCount) : null;
      var elsCompleteRate = rawCompleteRate != null ? (Math.abs(rawCompleteRate) < 1.5 ? rawCompleteRate * 100 : rawCompleteRate) : null;
      summaryCards.push({ id: 'els-profit', title: 'ELS 누적 수익금', amount: elsProfitSum, rate: elsCompleteRate });

      // 파이 차트 데이터 생성 (pieData용 평가금액 변수는 앞선 개별 항목의 Valuation을 그대로 사용하거나, 기존 방식 유지)
      var otherValuation = 0;
      if (cashOther) {
         for (var i = 0; i < cashOther.length; i++) {
            var title = String(cashOther[i]['항목'] || cashOther[i]['이름'] || '').trim();
            if (!/합계|소계|^계$/.test(title)) {
               otherValuation += gasCoerceNumber_(cashOther[i]['평가금액']) || gasCoerceNumber_(cashOther[i]['잔여금']) || gasCoerceNumber_(cashOther[i]['잔액']) || 0;
            }
         }
      }
      // pieSum 연산 시 수정된 penValuation, elsValuation 활용
      var pieSum = etfValuation + elsValuation + penValuation + otherValuation;
      if (pieSum > 0) {
        if (etfValuation > 0) pieData.push({ name: 'ETF', value: Math.round((etfValuation / pieSum) * 1000) / 10, color: '#6366f1' });
        if (elsValuation > 0) pieData.push({ name: 'ELS', value: Math.round((elsValuation / pieSum) * 1000) / 10, color: '#f59e0b' });
        if (penValuation > 0) pieData.push({ name: '연금', value: Math.round((penValuation / pieSum) * 1000) / 10, color: '#10b981' });
        if (otherValuation > 0) pieData.push({ name: '기타', value: Math.round((otherValuation / pieSum) * 1000) / 10, color: '#64748b' });
      }
    } catch(e) {}
  }

  return {
    totalAssets: totalAssets,
    portfolio: portfolio,
    rebalancing: rebalancing,
    etf: etf,
    pension: pension,
    els: els,
    elsSheetTotals: elsSheetTotals,
    elsCompleted: elsCompleted,
    cashOther: cashOther,
    elsListSheetData: elsListSheetData,
    summaryCards: summaryCards,
    pieData: pieData
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

function readSheetAsObjectsFirstNonEmpty_(ss, sheetNames, hi) {
  if (!sheetNames || !sheetNames.length) return [];
  for (var i = 0; i < sheetNames.length; i++) {
    var values = getSheetValuesCached_(ss, sheetNames[i]);
    if (values && values.length > 0) {
      var rows = convertValuesToObjects_(values, hi);
      if (rows && rows.length > 0) return rows;
    }
  }
  return [];
}

function readElsListSheetWithRowIndex_(ss) {
  var values = getSheetValuesCached_(ss, ELS_LIST_SHEET_NAME_);
  var rows = convertValuesToObjects_(values, 0);
  // add row_index properly since header=0 -> i(mapped)=0 array row map is 2 (values index + 2)
  rows.forEach(function(r, i) { r.row_index = i + 2; });
  return rows;
}
