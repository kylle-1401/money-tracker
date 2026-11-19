import { useEffect, useRef, type ReactNode } from 'react';
import styles from './FullScreenPage.module.css';

interface FullScreenPageProps {
  title: string;
  onCancel: () => void;
  children: ReactNode;
}

/**
 * Frame for full-screen forms (no tab bar): iOS-style header with Cancel and a
 * centered title. Focus moves to the title on open for screen-reader users.
 */
export default function FullScreenPage({ title, onCancel, children }: FullScreenPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          {title}
        </h1>
        <span aria-hidden="true" />
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
