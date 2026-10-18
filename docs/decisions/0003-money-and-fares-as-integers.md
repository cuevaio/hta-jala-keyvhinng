# 0003 – Integer money and basis points

**Status:** accepted

Persisted money is integer minor units; fare shares are integer basis points (10,000 = 100%).
Fractions are distributed with the largest-remainder method so the total is exact.

**Tradeoff:** callers convert for display. Avoids floating-point drift in anything persisted.
