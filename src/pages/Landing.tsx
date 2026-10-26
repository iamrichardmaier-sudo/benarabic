import { useEffect, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLandingHtml } from '@/lib/landing';

/**
 * Public home page for signed-out visitors. The markup is the static landing
 * in index.html (see src/lib/landing.ts), so crawlers and people see the same
 * page. Links into the app (/auth) are handled client-side; the reference
 * pages (/words/, /roots/ …) are static files and load normally.
 */
const Landing = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.remove('has-session');
  }, []);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    const href = a?.getAttribute('href');
    if (href && (href === '/auth' || href.startsWith('/auth?'))) {
      e.preventDefault();
      navigate(href);
    }
  };

  return (
    <div
      id="landing"
      className="lp"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: getLandingHtml() }}
    />
  );
};

export default Landing;
