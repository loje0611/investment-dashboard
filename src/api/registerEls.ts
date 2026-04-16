const getDefaultWebAppUrl = (): string => import.meta.env.VITE_WEB_APP_URL ?? ''

function getAuthEmail(): string {
  try {
    const raw = localStorage.getItem('investment-dashboard-auth-v1')
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { email?: string }
    return parsed?.email?.trim().toLowerCase() ?? ''
  } catch { return '' }
}

export const ELS_REGISTER_BROKERAGES = [
  '삼성증권',
  '키움증권',
  '미래에셋증권',
  'KB증권',
  '메리츠증권',
] as const

export type ElsRegisterBrokerage = (typeof ELS_REGISTER_BROKERAGES)[number]

export interface ElsRegisterPayload {
  action: 'create'
  brokerage: string
  productRound: number
  amount: number
  /** YYYY-MM-DD → 시트「발행일」열 */
  issueDate?: string
  /** 서버에서 create 시 무시하고「청약 중(대기)」로 고정 */
  status?: string
}

interface GasRegisterResponse {
  success?: boolean
  error?: string
  message?: string
}

/**
 * ELS 등록: GAS 웹앱 doPost로 전송.
 * - `text/plain;charset=utf-8` + JSON 문자열 본문: application/json 대비 Preflight(OPTIONS) 회피
 * - `redirect: 'follow'`: GAS 웹앱 POST 후 리다이렉트 체인 대응
 */
export async function registerElsProduct(
  payload: ElsRegisterPayload,
  endpoint?: string
): Promise<void> {
  const url = endpoint ?? getDefaultWebAppUrl()
  if (!url) throw new Error('VITE_WEB_APP_URL이 설정되지 않았습니다. .env 파일을 확인하세요.')
  if (url.endsWith('/dev')) {
    throw new Error(
      '웹앱 URL이 /dev(테스트 배포)입니다. CORS 문제가 있을 수 있습니다. /exec 로 끝나는 주소를 사용하세요.'
    )
  }

  const res = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ ...payload, authEmail: getAuthEmail() }),
  })

  const text = await res.text()
  let data: GasRegisterResponse
  try {
    data = JSON.parse(text) as GasRegisterResponse
  } catch {
    throw new Error('서버 응답을 JSON으로 읽을 수 없습니다.')
  }

  if (!data.success) {
    throw new Error(data.error ?? '등록에 실패했습니다.')
  }
}
