import { Link, NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import CheckPage from "./pages/CheckPage";
import AccountPage from "./pages/AccountPage";
import { ShieldMark } from "./components/icons";
import { isConfigured } from "./lib/supabase";

function Header() {
  const { session } = useAuth();

  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link className="wordmark" to="/">
          <ShieldMark size={22} />
          Scam Check
        </Link>
        <nav className="header-nav">
          {session ? (
            <NavLink className="btn btn--ghost" to="/account">
              Account
            </NavLink>
          ) : (
            <NavLink className="btn btn--secondary" to="/account">
              Sign in
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}

function ConfigWarning() {
  if (isConfigured) return null;
  return (
    <div className="shell" style={{ paddingTop: 20 }}>
      <div className="notice notice--bad">
        Supabase isn't configured yet. Copy <code>.env.example</code> to <code>.env.local</code>,
        fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart
        the dev server.
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app">
        <Header />
        <ConfigWarning />
        <main>
          <Routes>
            <Route path="/" element={<CheckPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="*" element={<CheckPage />} />
          </Routes>
        </main>
        <footer className="site-footer">
          <div className="shell">
            <p>
              Scam Check gives a considered first opinion. It is not financial, legal, or security
              advice, and it can be wrong.
            </p>
            <p>
              If you think you've lost money, contact your bank straight away using the number on
              the back of your card.
            </p>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
