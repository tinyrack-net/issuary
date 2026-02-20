/**
 * API 에러 클래스
 *
 * HTTP 요청 실패 시 발생하는 표준화된 에러입니다.
 * 에러 코드, HTTP 상태 코드, 메시지를 포함합니다.
 *
 * @example
 * ```typescript
 * try {
 *   await etch('/api/endpoint');
 * } catch (error) {
 *   if (error instanceof TinyAuthError) {
 *     if (error.code === 'INVALID_CREDENTIALS') {
 *       // 인증 오류 처리
 *     }
 *     console.log(error.status); // HTTP 상태 코드
 *     console.log(error.message); // 에러 메시지
 *   }
 * }
 * ```
 */
export class TinyAuthError extends Error {
  /** 에러 코드 (서버에서 정의한 코드) */
  readonly code: string;
  /** HTTP 상태 코드 */
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'TinyAuthError';
    this.code = code;
    this.status = status;
  }

  /**
   * Response 객체로부터 TinyAuthError 생성
   *
   * @param res - fetch Response 객체
   * @returns TinyAuthError 인스턴스
   */
  static async fromResponse(res: Response): Promise<TinyAuthError> {
    let code = 'UNKNOWN_ERROR';
    let message = res.statusText || 'An unknown error occurred';

    try {
      const data = await res.json();
      if (data.code) {
        code = data.code;
      }
      if (data.message) {
        message = data.message;
      }
    } catch {
      // JSON 파싱 실패 시 기본값 사용
    }

    return new TinyAuthError(code, res.status, message);
  }
}
