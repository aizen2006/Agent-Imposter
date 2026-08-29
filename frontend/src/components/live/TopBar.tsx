"use client";

import { formatUnits } from "viem";
import { useBalance } from "wagmi";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TESTNET_ID } from "@/chain/monad";
import { useWallet } from "@/chain/useMarket";

/* These were dead links until §15 gave them somewhere to go. */
const NAV = [
  { label: "Live", href: "/" },
  { label: "Lobby", href: "/lobby" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "My bets", href: "/my-bets" },
];

export function TopBar() {
  const wallet = useWallet();
  const path = usePathname();
  const { data: bal } = useBalance({
    address: wallet.address,
    // Always the testnet balance, even while the wallet sits on another chain.
    chainId: TESTNET_ID,
    query: { enabled: Boolean(wallet.address), refetchInterval: 10000 },
  });

  // wagmi v3 returns { value, decimals, symbol } — no `formatted` field.
  const balance = bal
    ? `${Number(formatUnits(bal.value, bal.decimals)).toFixed(2)} ${bal.symbol}`
    : "—";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "14px 22px",
        background: "var(--color-text)",
        color: "var(--color-bg)",
      }}
    >
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {/* brand mark — the crewmate reduced to a single accent bean */}
        <div
          style={{
            width: 26,
            height: 30,
            borderRadius: "14px 14px 11px 11px",
            background: "var(--color-accent)",
            position: "relative",
            flex: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 7,
              width: 17,
              height: 10,
              borderRadius: 6,
              background: "var(--visor)",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            fontSize: 19,
            letterSpacing: "-.01em",
          }}
        >
          IMPOSTER FLOOR
        </span>
      </Link>

      <nav style={{ display: "flex", gap: 4, marginLeft: 10 }}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-pill"
            aria-current={path === item.href ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        {/* Not decoration — clicking it is the fix. The market only exists on
            Monad testnet, so any other chain means every action would fail. */}
        {wallet.wrongChain && (
          <button
            type="button"
            className="badge badge-accent"
            onClick={() => wallet.switchToTestnet()}
            disabled={wallet.switching}
            style={{
              border: 0,
              cursor: "pointer",
              animation: "pulseDot 1.6s ease-in-out infinite",
            }}
            title="This app runs on Monad testnet only"
          >
            {wallet.switching ? "SWITCHING…" : "SWITCH TO MONAD TESTNET"}
          </button>
        )}

        <button
          type="button"
          className="wallet-pill"
          style={{ border: 0, color: "inherit" }}
          onClick={() => (wallet.isConnected ? wallet.disconnect() : wallet.connect())}
          title={wallet.isConnected ? "Disconnect" : "Connect a wallet"}
        >
          {wallet.isConnected ? (
            <>
              <span className="mono" style={{ fontSize: 14 }}>
                {balance}
              </span>
              <span
                style={{
                  width: 1,
                  height: 14,
                  background: "color-mix(in srgb, #f3f2f2 35%, transparent)",
                }}
              />
              <span className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                {wallet.short}
              </span>
            </>
          ) : (
            <span
              style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 13 }}
            >
              {wallet.connecting ? "Connecting…" : "Connect wallet"}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
