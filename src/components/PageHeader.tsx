import { useEffect, useRef } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
}

/**
 * Page title. On mount it moves focus to the heading so screen-reader and keyboard
 * users land on the new page after a tab change (WCAG focus management on route change).
 */
export default function PageHeader({ title }: PageHeaderProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // preventScroll: don't jump the page; the heading is already at the top.
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <header className={styles.header}>
      <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
        {title}
      </h1>
    </header>
  );
}
