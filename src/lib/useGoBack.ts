import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Returns a function that goes back to the previous screen. If this page was opened
 * directly (no in-app history), it goes to `fallback` instead of leaving the app.
 */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key !== 'default') {
      void navigate(-1);
    } else {
      void navigate(fallback, { replace: true });
    }
  };
}
