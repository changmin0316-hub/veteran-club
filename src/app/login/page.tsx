"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "./Logo";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.status !== 200) throw new Error(data.message ?? "로그인 실패");
      router.replace(data.ref ?? "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <Logo />
      <p
        style={{
          color: "#fff",
          letterSpacing: "4px",
          fontSize: "15px",
          margin: "8px 0 28px",
        }}
      >
        VETERAN CLUB
      </p>

      <form
        name="login"
        onSubmit={onSubmit}
        style={{ width: "min(420px, 90vw)", display: "grid", gap: "10px" }}
      >
        <input
          name="id"
          type="text"
          placeholder="캐릭터 이름"
          autoComplete="off"
          autoFocus
          style={inputStyle}
        />
        <input
          name="password"
          type="password"
          placeholder="비밀번호"
          autoComplete="off"
          style={inputStyle}
        />

        {error && (
          <p style={{ color: "#ff6b6b", fontSize: "13px", margin: "2px 0" }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} style={buttonStyle(loading)}>
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  height: "48px",
  padding: "0 14px",
  borderRadius: "6px",
  border: "none",
  outline: "none",
  background: "#fff",
  fontSize: "15px",
};

function buttonStyle(loading: boolean): React.CSSProperties {
  return {
    height: "48px",
    borderRadius: "6px",
    border: "none",
    marginTop: "6px",
    background: loading ? "#cfcfcf" : "#eceff1",
    color: "#1a1a1a",
    fontSize: "15px",
    fontWeight: 600,
    cursor: loading ? "default" : "pointer",
  };
}
