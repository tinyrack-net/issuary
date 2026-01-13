import type { ReactNode } from 'react';

interface ModalProps {
  /** 모달 열림 상태 */
  isOpen: boolean;
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 모달 제목 */
  title: string;
  /** 모달 설명 (선택) */
  description?: string;
  /** 모달 내용 */
  children: ReactNode;
  /** 모달 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 모달 닫기 방지 (배경 클릭 비활성화) */
  preventClose?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: '',
  lg: 'max-w-lg',
} as const;

/**
 * 공통 모달 컴포넌트
 *
 * DaisyUI의 modal 컴포넌트를 래핑하여 일관된 모달 UI를 제공합니다.
 *
 * @example
 * ```tsx
 * <Modal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="모달 제목"
 *   description="모달 설명"
 * >
 *   <form onSubmit={handleSubmit}>
 *     // 폼 내용
 *     <ModalActions>
 *       <button className="btn" onClick={handleClose}>취소</button>
 *       <button className="btn btn-primary" type="submit">확인</button>
 *     </ModalActions>
 *   </form>
 * </Modal>
 * ```
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  preventClose = false,
}: ModalProps) {
  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = () => {
    if (!preventClose) {
      onClose();
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className={`modal-box ${sizeClasses[size]}`}>
        <h3 className="font-bold text-lg">{title}</h3>
        {description && (
          <p className="py-2 text-base-content/60 text-sm">{description}</p>
        )}
        {children}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={handleBackdropClick}>
          close
        </button>
      </form>
    </dialog>
  );
}

interface ModalActionsProps {
  children: ReactNode;
}

/**
 * 모달 액션 버튼 영역
 *
 * 모달 하단의 버튼들을 감싸는 컨테이너입니다.
 */
export function ModalActions({ children }: ModalActionsProps) {
  return <div className="modal-action">{children}</div>;
}
