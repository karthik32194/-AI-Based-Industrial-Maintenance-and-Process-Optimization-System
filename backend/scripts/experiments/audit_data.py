"""Phase 2 Step 1 -- analytical re-audit of the dataset (read-only).

Prints statistics needed for Phase 2 decisions. No model training.
"""
from __future__ import annotations

import datetime
import hashlib
from pathlib import Path

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[3]
CSV = REPO_ROOT / "simulated_iiot_dataset.csv"

df = pd.read_csv(CSV)

print("=== FILE HASH ===")
print("SHA256:", hashlib.sha256(CSV.read_bytes()).hexdigest())

print("\n=== DIMENSIONS ===")
print("rows:", df.shape[0], "cols:", df.shape[1])

print("\n=== DTYPES ===")
print(df.dtypes)

print("\n=== NULLS ===")
print(df.isna().sum().sum(), "null cells total")
print(df.isna().sum()[df.isna().sum() > 0] if df.isna().sum().any() else "no null columns")

print("\n=== DUPLICATES ===")
print("duplicate rows:", int(df.duplicated().sum()))
print("duplicate timestamps:", int(df["timestamp"].duplicated().sum()))

print("\n=== TARGET DISTRIBUTION ===")
vc = df["machine_failure"].value_counts().sort_index()
print(vc.to_dict())
print("positive frac:", round(float(df["machine_failure"].mean()), 4))

print("\n=== TS OUTLIERS/DUPLICATES ===")
ts = pd.to_datetime(df["timestamp"])
print("min:", ts.min(), "max:", ts.max())
diffs = ts.sort_values().diff().dropna()
print("delta seconds: min", diffs.min(), "max", diffs.max(), "median", diffs.median())
print("timestamps monotonic in-file:", bool(ts.is_monotonic_increasing))

print("\n=== FEATURE RANGES (numeric, excl target/timestamp) ===")
num = df.select_dtypes(include=[np.number])
for c in [x for x in df.columns if x not in ("machine_failure",)]:
    if c in num.columns:
        s = df[c]
        print(f"{c:22s} min={s.min():12.4f} max={s.max():12.4f} std={s.std():.4f} nunique={s.nunique()}")

print("\n=== CONSTANT / NEAR-CONSTANT ===")
for c in df.columns:
    if c in num.columns:
        u = df[c].nunique()
        if u <= 10:
            print(f"{c}: only {u} unique values")

print("\n=== CORRELATION WITH TARGET (point-biserial, numeric only) ===")
for c in num.columns:
    if c == "machine_failure":
        continue
    corr = df[c].corr(df["machine_failure"])
    print(f"{c:22s} corr_target={corr:+.4f}")

print("\n=== CLASS-CONDITIONAL MEANS (0=normal, 1=failure) ===")
g = df.groupby("machine_failure")
for c in df.columns:
    if c not in g and c not in num.columns:
        continue
    if c not in num.columns:
        continue
    if c == "machine_failure":
        continue
    m0, m1 = g[c].mean().loc[0], g[c].mean().loc[1]
    s0, s1 = g[c].std().loc[0], g[c].std().loc[1]
    # separation: cohen-style d
    pool = np.sqrt((s0 ** 2 + s1 ** 2) / 2) if (s0 + s1) > 0 else 0.0
    d = (m1 - m0) / pool if pool > 0 else 0.0
    print(f"{c:22s} mean[0]={m0:10.4f} mean[1]={m1:10.4f} cohen_d={d:+.3f}")

print("\n=== AUTO-CORRELATION OF TARGET (lag 1..8 on original order) ===")
y = df["machine_failure"].to_numpy()
for lag in range(1, 9):
    # serialize the sequence; autocorr over consecutive in-file rows
    a = y[:-lag]
    b = y[lag:]
    if a.std() == 0 or b.std() == 0:
        corr = 0.0
    else:
        corr = np.corrcoef(a, b)[0, 1]
    print(f"lag {lag}: r={corr:+.4f}")

print("\n=== FAILURE RUN LENGTHS (consecutive 1s), file order ===")
runs = 0
current_len = 0
lengths = []
for v in y:
    if v == 1:
        current_len += 1
    else:
        if current_len > 0:
            lengths.append(current_len)
        current_len = 0
if current_len > 0:
    lengths.append(current_len)
print("num failure runs:", len(lengths), "mean_len:", round(float(np.mean(lengths)), 3) if lengths else None,
      "max_len:", max(lengths) if lengths else None)