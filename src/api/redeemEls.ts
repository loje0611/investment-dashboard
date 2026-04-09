const getDefaultWebAppUrl = (): string => import.meta.env.VITE_WEB_APP_URL ?? ''

export interface ElsRedeemPayload {
  action: 'redeem'
  row_index: number
  /** YYYY-MM-DD */
  상환일: string
  /** 원 단위 */
  상환금액: number
}

interface GasRedeemResponse {
  success?: boolean
  error?: string
  message?: string
}

export async function redeemElsProduct(
  payload: ElsRedeemPayload,
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
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  let data: GasRedeemResponse
  try {
    data = JSON.parse(text) as GasRedeemResponse
  } catch {
    throw new Error('서버 응답을 JSON으로 읽을 수 없습니다.')
  }

  if (!data.success) {
    throw new Error(data.error ?? '상환 처리에 실패했습니다.')
  }
}
