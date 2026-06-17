import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import LoginScreen from "./LoginScreen";
import LedgerApp from "./LedgerApp";

export default function AuthGate() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = logged out
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  if (user === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: "#f3efe7", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans JP', sans-serif", color: "#5c4d3a" }}>
        読み込み中…
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut(auth);
    } finally {
      setSigningOut(false);
    }
  }

  return <LedgerApp user={user} onSignOut={handleSignOut} signingOut={signingOut} />;
}
