import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "./firebase";

const ERROR_MESSAGES = {
  "auth/invalid-email": "メールアドレスの形式が正しくありません",
  "auth/user-not-found": "メールアドレスまたはパスワードが違います",
  "auth/wrong-password": "メールアドレスまたはパスワードが違います",
  "auth/invalid-credential": "メールアドレスまたはパスワードが違います",
  "auth/email-already-in-use": "そのメールアドレスは既に登録されています",
  "auth/weak-password": "パスワードは6文字以上にしてください",
  "auth/too-many-requests": "試行回数が多すぎます。少し時間をおいてください",
};

function friendlyError(code) {
  return ERROR_MESSAGES[code] || "エラーが発生しました。もう一度お試しください";
}

export default function LoginScreen() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim() || !password) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("パスワードを再設定するメールアドレスを入力してください");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo("パスワード再設定用のメールを送信しました");
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <style>{fontImports}</style>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <span style={styles.brandMark}>帳</span>
          <span style={styles.brandName}>ギャンブル収支帖</span>
        </div>
        <div style={styles.tabRow}>
          <button
            onClick={() => { setMode("login"); setError(""); setInfo(""); }}
            style={{ ...styles.tabBtn, ...(mode === "login" ? styles.tabBtnActive : {}) }}
          >
            ログイン
          </button>
          <button
            onClick={() => { setMode("signup"); setError(""); setInfo(""); }}
            style={{ ...styles.tabBtn, ...(mode === "signup" ? styles.tabBtnActive : {}) }}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>メールアドレス</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={styles.input}
          />
          <label style={{ ...styles.label, marginTop: 14 }}>パスワード</label>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "6文字以上" : ""}
            style={styles.input}
          />

          {error && <div style={styles.errorBox}>{error}</div>}
          {info && <div style={styles.infoBox}>{info}</div>}

          <button type="submit" disabled={busy} style={styles.submitBtn}>
            {busy ? "処理中…" : mode === "login" ? "ログイン" : "登録する"}
          </button>
        </form>

        {mode === "login" && (
          <button onClick={handleResetPassword} disabled={busy} style={styles.linkBtn}>
            パスワードを忘れた場合
          </button>
        )}

        <div style={styles.hint}>
          ログイン情報はこの端末以外（別のスマホやタブレット）と共有されます。
          記録はあなたのアカウントにのみ保存され、他の人には見えません。
        </div>
      </div>
    </div>
  );
}

const fontImports = `
@import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&family=Noto+Sans+JP:wght@400;500;600;700&display=swap');
`;

const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#f3efe7",
    fontFamily: "'Noto Sans JP', sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    boxSizing: "border-box",
  },
  card: {
    background: "#fdfaf5",
    borderRadius: 18,
    padding: "28px 24px",
    width: "100%",
    maxWidth: 380,
    boxShadow: "0 2px 10px rgba(60,50,30,0.10)",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    marginBottom: 22,
  },
  brandMark: {
    fontFamily: "'Shippori Mincho', serif",
    fontSize: 20,
    fontWeight: 700,
    background: "#c9a86a",
    color: "#2f2a23",
    width: 30,
    height: 30,
    borderRadius: 7,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontFamily: "'Shippori Mincho', serif",
    fontSize: 18,
    fontWeight: 700,
    color: "#3a3027",
  },
  tabRow: {
    display: "flex",
    background: "#f0e9da",
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    border: "none",
    background: "transparent",
    color: "#7f7368",
    fontSize: 13,
    fontWeight: 600,
    padding: "9px 0",
    borderRadius: 8,
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "#3a3027",
    color: "#fdfaf5",
  },
  label: {
    fontSize: 12,
    color: "#7f7368",
    fontWeight: 600,
    display: "block",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1.5px solid #d8cfc0",
    background: "#fff",
    borderRadius: 10,
    padding: "12px 14px",
    fontSize: 16,
    color: "#3a3027",
    outline: "none",
  },
  errorBox: {
    marginTop: 14,
    background: "#f6e4e0",
    color: "#9a3f3f",
    fontSize: 12.5,
    borderRadius: 8,
    padding: "9px 12px",
  },
  infoBox: {
    marginTop: 14,
    background: "#e6efe2",
    color: "#3f6b4a",
    fontSize: 12.5,
    borderRadius: 8,
    padding: "9px 12px",
  },
  submitBtn: {
    width: "100%",
    border: "none",
    background: "#9a6b3f",
    color: "#fdfaf5",
    borderRadius: 10,
    padding: "13px 0",
    fontSize: 14.5,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 18,
  },
  linkBtn: {
    display: "block",
    margin: "14px auto 0",
    background: "transparent",
    border: "none",
    color: "#7f7368",
    fontSize: 12.5,
    textDecoration: "underline",
    cursor: "pointer",
  },
  hint: {
    marginTop: 18,
    fontSize: 11,
    color: "#a89c87",
    lineHeight: 1.6,
    textAlign: "center",
  },
};
