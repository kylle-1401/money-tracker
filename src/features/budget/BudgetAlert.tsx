import { dismissBudgetAlerts, useBudgetAlerts } from './budgetAlerts.ts';
import styles from './BudgetAlert.module.css';

/**
 * Banner shown right after a save pushes spending past 80% of a budget or over it.
 * It stays until dismissed (no auto-hide: people need time to read it), and it is an
 * in-app alert only: a home-screen web app can't send phone notifications without a
 * push server, which this app deliberately doesn't have.
 */
export default function BudgetAlert() {
  const alerts = useBudgetAlerts();
  if (alerts.length === 0) return null;
  const over = alerts.some((a) => a.level === 'over');

  return (
    <div className={`${styles.banner} ${over ? styles.over : styles.warning}`} role="alert">
      <span className={styles.icon} aria-hidden="true">
        {over ? '‼️' : '⚠️'}
      </span>
      <div className={styles.text}>
        {alerts.map((alert) => (
          <p key={alert.key}>{alert.message}</p>
        ))}
      </div>
      <button type="button" className={styles.close} onClick={dismissBudgetAlerts}>
        OK
      </button>
    </div>
  );
}
