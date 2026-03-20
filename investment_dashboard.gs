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
 *
 * 반환 형식: { totalAssets, portfolio, rebalancing, etf, pension, els, elsSheetTotals, elsCompleted, cashOther }
 */
// 배포 전 본인 스프레드시트 ID로 변경하세요. (URL의 /d/ 다음 부분)
var SPREADSHEET_ID = '1g1VBYupYjmkiF-85CXgjFvu4qzzSjtKTLGgXYNIhKQM';

/**
 * 웹 앱으로 GET 요청 시 호출됩니다. JSON을 반환합니다.
 * 쿼리 파라미터 data: summary | assets | rebalancing | all(기본)
 *   - summary: 총자산만 (홈 화면용, 가장 빠름)
 *   - assets: 자산 상세(ELS, ETF, 연금)
 *   - rebalancing: 리밸런싱(포트_API, 포트(New))
 *   - all 또는 생략: 전체 (기존 동작)
 */
function doGet(e) {
  var param = (e && e.parameter && e.parameter.data) ? String(e.parameter.data).toLowerCase() : 'all';
  try {
    var data = getDashboardData(param);
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    var message = err.message || '데이터를 불러오는 중 오류가 발생했습니다.';
    return ContentService.createTextOutput(JSON.stringify({ error: message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

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
      els = readSheetAsObjects(ss, 'ELS(투자중)', 1);
    } catch (e) {
      els = [];
    }
    try {
      elsSheetTotals = readElsSheetTotalsB4C4(ss);
    } catch (e) {
      elsSheetTotals = null;
    }
    try {
      elsCompleted = readSheetAsObjects(ss, 'ELS(완료)', 1);
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
    cashOther: cashOther || []
  };
}

/**
 * 「ELS」시트 요약 행: B4=투자원금 합계, C4=평가금액 합계 (홈 카드·총자산 집계용).
 * 탭 이름은 정확히 'ELS' 여야 합니다.
 * @returns {{ principal: number, valuation: number }|null}
 */
function readElsSheetTotalsB4C4(ss) {
  var sh = ss.getSheetByName('ELS');
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
 * 행이 헤더 행인지 판별합니다.
 * 첫 셀이 "종류", "종류(연금저축)", "종류(IRP)", "종류(해외)", "종목명", "상품명" 등
 * 알려진 키워드로 시작하고, 비어 있지 않은 셀이 3개 이상이면 헤더로 봅니다.
 */
function isHeaderLikeRow(row) {
  if (!row || !row.length) return false;
  var first = row[0] != null ? String(row[0]).trim() : '';
  if (first === '' || first === '합계') return false;
  var keywords = ['종류', '종목명', '상품명', '종목', '계좌'];
  var matched = false;
  for (var k = 0; k < keywords.length; k++) {
    if (first === keywords[k] || first.indexOf(keywords[k]) === 0) {
      matched = true;
      break;
    }
  }
  if (!matched) return false;
  var nonEmpty = 0;
  for (var c = 0; c < row.length; c++) {
    if (row[c] != null && String(row[c]).trim() !== '') nonEmpty++;
  }
  return nonEmpty >= 3;
}

/**
 * 시트 내 여러 표를 파싱합니다 (헤더 행 기반 탐색).
 *
 * 전략: 모든 행을 스캔하여 "헤더 행"(isHeaderLikeRow==true)을 먼저 찾고,
 *   - 헤더 바로 윗 행의 A열 → 계좌명 (비어 있으면 시트명 사용)
 *   - 헤더 아래 행 → 데이터 (빈 행 또는 "합계" 행에서 종료)
 *
 * @returns {Array<{ accountLabel: string, rows: Object[] }>}
 */
function readSheetAsMultipleTables(ss, sheetName) {
  try {
    if (!ss || !sheetName) return [];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    var range = sheet.getDataRange();
    if (!range) return [];
    var values = range.getValues();
    if (!values || values.length < 2) return [];

    // 1) 헤더 행 인덱스 수집
    var headerIndices = [];
    for (var h = 0; h < values.length; h++) {
      if (isHeaderLikeRow(values[h])) {
        headerIndices.push(h);
      }
    }
    if (headerIndices.length === 0) return [];

    var tables = [];

    for (var t = 0; t < headerIndices.length; t++) {
      var hi = headerIndices[t];

      // 2) 계좌명: 헤더 바로 윗 행의 A열
      var accountLabel = sheetName;
      if (hi > 0) {
        var above = values[hi - 1][0];
        var aboveStr = above != null ? String(above).trim() : '';
        if (aboveStr !== '' && aboveStr !== '합계') {
          accountLabel = aboveStr;
        }
      }

      // 3) 헤더 파싱
      var headers = values[hi].map(function (cell) {
        return cell != null ? String(cell).trim() : '';
      });

      // 4) 데이터 행 읽기 (헤더+1 부터, 빈 행 또는 "합계" 또는 다음 헤더 직전까지)
      var nextHeaderIdx = (t + 1 < headerIndices.length) ? headerIndices[t + 1] : values.length;
      var rows = [];
      for (var d = hi + 1; d < nextHeaderIdx && d < values.length; d++) {
        var row = values[d];
        var firstCell = row[0] != null ? String(row[0]).trim() : '';
        if (firstCell === '' || firstCell === '합계') break;
        var obj = {};
        for (var c = 0; c < headers.length; c++) {
          var key = headers[c] || 'col' + c;
          var val = row[c];
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

      if (rows.length > 0) {
        tables.push({ accountLabel: accountLabel, rows: rows });
      }
    }

    return tables;
  } catch (e) {
    return [];
  }
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
        if (cell === '평가일' || cell === '일자' || cell.indexOf('평가일') >= 0 || cell.indexOf('일자') >= 0) {
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
      return h != null ? String(h).trim() : '';
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
