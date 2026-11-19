import { NavLink } from 'react-router-dom';
import { HomeIcon, ListIcon, SettingsIcon } from './icons.tsx';
import styles from './TabBar.module.css';

const tabs = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/transactions', label: 'List', Icon: ListIcon, end: false },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon, end: false },
] as const;

/**
 * Bottom tab bar, iOS style. Sits in the thumb zone and pads for the home indicator.
 * NavLink sets aria-current="page" on the active tab, which screen readers announce.
 */
export default function TabBar() {
  return (
    <nav className={styles.bar} aria-label="Main">
      <ul className={styles.list}>
        {tabs.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                isActive ? `${styles.tab} ${styles.active}` : styles.tab
              }
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
